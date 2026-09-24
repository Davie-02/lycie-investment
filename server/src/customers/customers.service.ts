import { BadRequestException, ConflictException, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import { randomBytes, createHash } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { EmailService } from "../email/email.service";
import { emailChangedNoticeEmail, passwordChangedEmail, passwordResetEmail, verifyEmailEmail } from "../email/email-templates";
import { CLEARED_LOCK_STATE, isLocked, lockedMessage, recordUnknownEmailFailure, stateAfterFailure, unknownEmailLockedUntil } from "../security/lockout";
import { checkEmailDeliverable, normalizeEmail } from "../security/email-check";
import type { VerifiedIdentity } from "../auth/social-identity";
import { SessionService, type IssuedSession } from "../auth/session.service";
import { RegisterCustomerDto } from "./dto/register-customer.dto";
import { CreateCustomerCaseDto } from "./dto/create-customer-case.dto";
import { CreateCustomerCaseUpdateDto } from "./dto/create-customer-case-update.dto";
import { UpdateCustomerProfileDto } from "./dto/update-customer-profile.dto";
import { ChangeCustomerPasswordDto } from "./dto/change-customer-password.dto";
import { ReferralsService } from "../referrals/referrals.service";

const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000; // 1 hour
const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/** Same purpose as the admin one in auth.service.ts: keeps "no such email" as slow as "wrong password". */
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 12);

function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

export interface CustomerRequestSummary {
  id: string;
  type: "inquiry" | "import" | "clearing" | "hire" | "contact";
  summary: string;
  status: string;
  createdAt: Date;
  // Hire requests are real bookings with dates/pricing worth showing
  // precisely rather than collapsing into the generic summary string.
  hireDetails?: {
    vehicleName: string;
    pickupDate: Date;
    returnDate: Date;
    days: number;
    totalCost: number;
    currency: string;
  };
}

const CUSTOMER_SELECT = {
  id: true,
  name: true,
  email: true,
  isActive: true,
  createdAt: true,
  emailVerifiedAt: true,
  phone: true,
} as const;

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly sessions: SessionService,
    private readonly referrals: ReferralsService
  ) {}

  /** Mints the signed session for a customer. Used by every way of signing in. */
  issueSession(customer: { id: string; name: string; email: string }, remember: boolean): Promise<IssuedSession> {
    return this.sessions.issue({ sub: customer.id, role: "CUSTOMER", name: customer.name, email: customer.email }, remember);
  }

  /** Creates a one-time email-confirmation link and emails it. Failure to send is logged by EmailService and never blocks sign-up. */
  private async sendVerificationEmail(customer: { id: string; name: string; email: string }): Promise<void> {
    const rawToken = randomBytes(32).toString("hex");
    await this.prisma.emailVerificationToken.create({
      data: {
        customerId: customer.id,
        tokenHash: hashToken(rawToken),
        expiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS),
      },
    });
    const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:5173";
    await this.emailService.send({
      to: customer.email,
      ...verifyEmailEmail(customer.name, `${frontendUrl}/account/verify-email?token=${rawToken}`),
    });
  }

  async register(dto: RegisterCustomerDto) {
    const email = normalizeEmail(dto.email);

    // Refuse addresses whose domain can't receive mail (typos, made-up or
    // throwaway domains) before creating anything we could never contact.
    const verdict = await checkEmailDeliverable(email, { verifyMailbox: true });
    if (!verdict.ok) throw new BadRequestException(verdict.reason);

    const existing = await this.prisma.customerUser.findUnique({ where: { email } });
    if (existing) {
      // Worded to help the real owner without spelling out "this email is registered".
      throw new ConflictException("We couldn't create an account with this email. If it's yours, sign in or reset your password.");
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const customer = await this.prisma.$transaction(async (tx) => {
      const created = await tx.customerUser.create({
        data: {
          name: dto.name.trim(),
          email,
          passwordHash,
          account: { create: {} },
        },
        select: CUSTOMER_SELECT,
      });
      await tx.auditLog.create({
        data: {
          actorUserId: created.id,
          action: "CREATE",
          entityType: "CustomerUser",
          entityId: created.id,
        },
      });
      return created;
    });

    // A friend's share link: never blocks signing up if the code is wrong.
    await this.referrals.linkNewCustomer(customer.id, dto.referralCode).catch(() => undefined);

    // Fire and forget: the account exists either way, and can ask for another link later.
    void this.sendVerificationEmail(customer).catch(() => undefined);
    return customer;
  }

  /**
   * Checks an email + password. Wrong attempts are counted against the
   * account and lock it after five (see security/lockout.ts); a locked
   * account is refused even with the right password until the lock ends.
   */
  async authenticate(email: string, password: string) {
    const phantomLock = unknownEmailLockedUntil(email);
    if (phantomLock) throw new UnauthorizedException(lockedMessage(phantomLock));
    const check = await this.checkPassword(email, password);
    if (check.customer && check.locked) throw new UnauthorizedException(lockedMessage(check.customer.lockedUntil!));
    if (!check.customer || !check.matches) {
      if (check.customer) await this.recordFailure(check.customer);
      else {
        const lock = recordUnknownEmailFailure(email);
        if (lock) throw new UnauthorizedException(lockedMessage(lock));
      }
      throw new UnauthorizedException("Invalid email or password.");
    }
    return this.completePasswordSignIn(check.customer);
  }

  /** Checks a password against the customer account with this email, without deciding anything (one bcrypt compare always). */
  async checkPassword(email: string, password: string) {
    const customer = await this.prisma.customerUser.findUnique({ where: { email: normalizeEmail(email) } });
    const locked = Boolean(customer?.lockedUntil && isLocked(customer.lockedUntil));
    const matches = await bcrypt.compare(password, customer?.passwordHash ?? DUMMY_HASH);
    return { customer, locked, matches: Boolean(customer && customer.isActive && matches && !locked) };
  }

  async recordFailure(customer: { id: string; failedLoginCount: number }): Promise<void> {
    await this.prisma.customerUser.update({ where: { id: customer.id }, data: stateAfterFailure(customer.failedLoginCount) });
  }

  async completePasswordSignIn(customer: { id: string; name: string; email: string; emailVerifiedAt: Date | null }) {
    await this.prisma.customerUser.update({ where: { id: customer.id }, data: { ...CLEARED_LOCK_STATE, lastLoginAt: new Date() } });
    return { id: customer.id, name: customer.name, email: customer.email, role: "CUSTOMER", emailVerifiedAt: customer.emailVerifiedAt };
  }

  /**
   * "Continue with Google/Facebook". The provider has already proven who the
   * person is (see auth/social-identity.ts); this decides which account that is:
   *  1. an account already linked to this provider id → that one;
   *  2. else an account with the same email → link it, but ONLY if the
   *     provider vouches for that email (otherwise anyone could claim an
   *     address they don't own);
   *  3. else create a new account. It gets a random unusable password — the
   *     person can set a real one later via "Forgot password".
   */
  async signInWithIdentity(identity: VerifiedIdentity) {
    // Which column holds this provider's id. Spelled out per provider (rather
    // than a computed key) so Prisma can check every query below at compile time.
    const providerLink: { googleId: string } | { facebookId: string } =
      identity.provider === "google" ? { googleId: identity.providerId } : { facebookId: identity.providerId };

    const linked = await this.prisma.customerUser.findUnique({ where: providerLink });
    if (linked) return this.finishSocialSignIn(linked);

    if (!identity.emailVerified) {
      throw new UnauthorizedException("Your email address isn't verified with that provider, so we can't sign you in with it.");
    }

    const byEmail = await this.prisma.customerUser.findUnique({ where: { email: identity.email } });
    if (byEmail) {
      // Account "pre-hijacking" defence: if nobody ever proved they own this
      // email, the existing account may have been registered by someone else
      // with a password they know, waiting for the real owner to sign in with
      // Google. The real owner has now proven the address, so that unproven
      // password is replaced (and any sessions it opened are signed out).
      const unproven = !byEmail.emailVerifiedAt;
      const linkedNow = await this.prisma.customerUser.update({
        where: { id: byEmail.id },
        // The provider verified the email, so it counts as verified here too.
        data: {
          ...providerLink,
          emailVerifiedAt: byEmail.emailVerifiedAt ?? new Date(),
          ...(unproven ? { passwordHash: await bcrypt.hash(randomBytes(32).toString("hex"), 12), passwordChangedAt: new Date() } : {}),
        },
      });
      if (unproven) this.sessions.forget("CUSTOMER", byEmail.id);
      return this.finishSocialSignIn(linkedNow);
    }

    const passwordHash = await bcrypt.hash(randomBytes(32).toString("hex"), 12);
    const created = await this.prisma.$transaction(async (tx) => {
      const customer = await tx.customerUser.create({
        data: {
          name: identity.name,
          email: identity.email,
          passwordHash,
          emailVerifiedAt: new Date(),
          ...providerLink,
          account: { create: {} },
        },
      });
      await tx.auditLog.create({
        data: { actorUserId: customer.id, action: "CREATE", entityType: "CustomerUser", entityId: customer.id },
      });
      return customer;
    });
    return this.finishSocialSignIn(created);
  }

  private async finishSocialSignIn(customer: { id: string; name: string; email: string; isActive: boolean; emailVerifiedAt: Date | null }) {
    if (!customer.isActive) throw new UnauthorizedException("This account is no longer active.");
    await this.prisma.customerUser.update({ where: { id: customer.id }, data: { ...CLEARED_LOCK_STATE, lastLoginAt: new Date() } });
    return { id: customer.id, name: customer.name, email: customer.email, role: "CUSTOMER", emailVerifiedAt: customer.emailVerifiedAt };
  }

  /** The signed-in customer's own details (also how the browser proves its session works). */
  async getSession(customerId: string) {
    const customer = await this.prisma.customerUser.findUnique({ where: { id: customerId }, select: { ...CUSTOMER_SELECT } });
    if (!customer || !customer.isActive) throw new UnauthorizedException("This account is no longer active.");
    return { user: customer };
  }

  /** Consumes an emailed confirmation link. */
  async verifyEmail(rawToken: string): Promise<{ verified: true }> {
    const invalid = () =>
      new BadRequestException("This confirmation link is invalid or has expired. Request a new one from your account page.");
    const token = await this.prisma.emailVerificationToken.findUnique({ where: { tokenHash: hashToken(rawToken) } });
    if (!token || token.usedAt || token.expiresAt < new Date()) throw invalid();

    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.emailVerificationToken.updateMany({ where: { id: token.id, usedAt: null }, data: { usedAt: now } });
      if (claimed.count !== 1) throw invalid();
      await tx.customerUser.update({ where: { id: token.customerId }, data: { emailVerifiedAt: now } });
    });
    return { verified: true };
  }

  async resendVerification(customerId: string): Promise<{ sent: true }> {
    const customer = await this.prisma.customerUser.findUnique({ where: { id: customerId } });
    if (!customer) throw new NotFoundException("Customer not found.");
    if (customer.emailVerifiedAt) return { sent: true };
    await this.sendVerificationEmail(customer);
    return { sent: true };
  }

  /**
   * Always resolves the same way regardless of whether the email matches an
   * account — same reasoning as login's identical error for "no such user"
   * vs. "wrong password": don't let this endpoint be used to enumerate
   * which emails have accounts.
   */
  async requestPasswordReset(email: string): Promise<{ requested: true }> {
    const customer = await this.prisma.customerUser.findUnique({
      where: { email: normalizeEmail(email) },
    });

    if (customer && customer.isActive) {
      const rawToken = randomBytes(32).toString("hex");
      await this.prisma.passwordResetToken.create({
        data: {
          customerId: customer.id,
          tokenHash: hashToken(rawToken),
          expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
        },
      });

      const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:5173";
      const resetUrl = `${frontendUrl}/account/reset-password?token=${rawToken}`;
      const template = passwordResetEmail(resetUrl);
      // Not awaited, so "account exists" isn't measurably slower than "no such account".
      void this.emailService.send({ to: customer.email, ...template }).catch(() => undefined);
    }

    return { requested: true };
  }

  async resetPassword(rawToken: string, newPassword: string): Promise<{ reset: true }> {
    const tokenHash = hashToken(rawToken);
    const resetToken = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash } });

    if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
      throw new BadRequestException("This password reset link is invalid or has expired.");
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      // Claim the link atomically so two simultaneous uses can't both succeed.
      const claimed = await tx.passwordResetToken.updateMany({
        where: { id: resetToken.id, usedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now },
      });
      if (claimed.count !== 1) throw new BadRequestException("This password reset link is invalid or has expired.");

      await tx.customerUser.update({
        where: { id: resetToken.customerId },
        // A reset also lifts any lockout and signs the account out everywhere.
        // Opening the emailed link also proves the customer owns the address.
        data: { passwordHash, passwordChangedAt: now, ...CLEARED_LOCK_STATE, emailVerifiedAt: now },
      });
      // Other reset links still sitting in the inbox stop working too.
      await tx.passwordResetToken.updateMany({ where: { customerId: resetToken.customerId, usedAt: null }, data: { usedAt: now } });
    });
    this.sessions.forget("CUSTOMER", resetToken.customerId);

    return { reset: true };
  }

  async updateProfile(customerId: string, dto: UpdateCustomerProfileDto) {
    let emailChanged = false;
    let previous: { name: string; email: string } | null = null;
    if (dto.email) {
      const email = normalizeEmail(dto.email);
      const current = await this.prisma.customerUser.findUnique({ where: { id: customerId } });
      previous = current ? { name: current.name, email: current.email } : null;
      emailChanged = Boolean(current && current.email !== email);

      if (emailChanged) {
        const verdict = await checkEmailDeliverable(email, { verifyMailbox: true });
        if (!verdict.ok) throw new BadRequestException(verdict.reason);
      }
      const existing = await this.prisma.customerUser.findUnique({ where: { email } });
      if (existing && existing.id !== customerId) {
        throw new ConflictException("A customer with this email already exists.");
      }
    }

    const updated = await this.prisma.customerUser.update({
      where: { id: customerId },
      data: {
        name: dto.name?.trim(),
        email: dto.email ? normalizeEmail(dto.email) : undefined,
        phone: dto.phone === undefined ? undefined : dto.phone.trim() || null,
        // A different address hasn't been proven yet.
        ...(emailChanged ? { emailVerifiedAt: null } : {}),
      },
      select: CUSTOMER_SELECT,
    });

    if (emailChanged) {
      void this.sendVerificationEmail(updated).catch(() => undefined);
      // Tell the OLD address, so a change made by someone else is spotted.
      if (previous) {
        void this.emailService
          .send({ to: previous.email, ...emailChangedNoticeEmail({ name: previous.name, newEmail: updated.email }) })
          .catch(() => undefined);
      }
    }
    return updated;
  }

  /**
   * Changes the password, signs every OTHER device out (via passwordChangedAt),
   * emails a heads-up, and returns a fresh session so this device stays in.
   */
  async changePassword(customerId: string, dto: ChangeCustomerPasswordDto, remember: boolean) {
    const customer = await this.prisma.customerUser.findUnique({ where: { id: customerId } });
    if (!customer) {
      throw new NotFoundException("Customer not found.");
    }

    const currentMatches = await bcrypt.compare(dto.currentPassword, customer.passwordHash);
    if (!currentMatches) {
      throw new UnauthorizedException("Current password is incorrect.");
    }
    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException("Choose a password you haven't been using.");
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.customerUser.update({ where: { id: customerId }, data: { passwordHash, passwordChangedAt: new Date() } });
    this.sessions.forget("CUSTOMER", customerId);

    void this.emailService.send({ to: customer.email, ...passwordChangedEmail(customer.name) }).catch(() => undefined);
    return { session: await this.issueSession(customer, remember), user: { id: customer.id, name: customer.name, email: customer.email } };
  }

  /** "Sign out everywhere" for customers. Returns a fresh session so this device stays signed in. */
  async signOutEverywhere(customerId: string, remember: boolean) {
    const customer = await this.prisma.customerUser.findUnique({ where: { id: customerId }, select: CUSTOMER_SELECT });
    if (!customer) throw new NotFoundException("Customer not found.");
    await this.sessions.revokeAll("CUSTOMER", customerId);
    return { session: await this.issueSession(customer, remember), user: customer };
  }

  async findMyRequests(customerId: string): Promise<CustomerRequestSummary[]> {
    const [inquiries, importRequests, clearingRequests, hireRequests, contactMessages] = await Promise.all([
      this.prisma.inquiry.findMany({
        where: { customerId },
        include: { vehicle: { select: { make: true, model: true, year: true } } },
      }),
      this.prisma.importRequest.findMany({ where: { customerId } }),
      this.prisma.clearingRequest.findMany({ where: { customerId } }),
      this.prisma.hireRequest.findMany({ where: { customerId }, include: { vehicle: true } }),
      this.prisma.contactMessage.findMany({ where: { customerId } }),
    ]);

    const summaries: CustomerRequestSummary[] = [
      ...inquiries.map((r) => ({
        id: r.id,
        type: "inquiry" as const,
        summary: r.vehicle ? `${r.vehicle.make} ${r.vehicle.model} (${r.vehicle.year})` : "General inquiry",
        status: r.status,
        createdAt: r.createdAt,
      })),
      ...importRequests.map((r) => ({
        id: r.id,
        type: "import" as const,
        summary: `${r.preferredMake} ${r.preferredModel ?? ""}`.trim(),
        status: r.status,
        createdAt: r.createdAt,
      })),
      ...clearingRequests.map((r) => ({
        id: r.id,
        type: "clearing" as const,
        summary: `${r.vehicleMake} ${r.vehicleModel ?? ""} (VIN ${r.vin})`.trim(),
        status: r.status,
        createdAt: r.createdAt,
      })),
      ...hireRequests.map((r) => ({
        id: r.id,
        type: "hire" as const,
        summary: r.vehicle.name,
        status: r.status,
        createdAt: r.createdAt,
        hireDetails: {
          vehicleName: r.vehicle.name,
          pickupDate: r.pickupDate,
          returnDate: r.returnDate,
          days: r.days,
          totalCost: r.totalCost,
          currency: r.currency,
        },
      })),
      ...contactMessages.map((r) => ({
        id: r.id,
        type: "contact" as const,
        summary: r.subject,
        status: r.status,
        createdAt: r.createdAt,
      })),
    ];

    return summaries.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  findCases(customerId: string) {
    return this.prisma.customerCase.findMany({
      where: { customerId },
      orderBy: { updatedAt: "desc" },
      include: {
        vehicle: { select: { make: true, model: true, year: true, images: true } },
        hireVehicle: { select: { name: true, image: true } },
        updates: { orderBy: { createdAt: "desc" } },
      },
    });
  }

  findSavedVehicles(customerId: string) {
    return this.prisma.savedVehicle.findMany({
      where: { customerId },
      orderBy: { createdAt: "desc" },
      include: { vehicle: true },
    });
  }

  async saveVehicle(customerId: string, vehicleId: string) {
    const vehicle = await this.prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!vehicle) {
      throw new NotFoundException("Vehicle not found.");
    }

    // Upsert instead of create so saving something already-saved is a
    // harmless no-op rather than a 409 the frontend would need to handle.
    return this.prisma.savedVehicle.upsert({
      where: { customerId_vehicleId: { customerId, vehicleId } },
      update: {},
      // The price at saving time is the baseline for "price dropped" emails (see alerts.service.ts).
      create: { customerId, vehicleId, notifiedPrice: vehicle.price },
    });
  }

  async unsaveVehicle(customerId: string, vehicleId: string) {
    await this.prisma.savedVehicle.deleteMany({ where: { customerId, vehicleId } });
    return { deleted: true };
  }

  createCase(dto: CreateCustomerCaseDto) {
    return this.prisma.customerCase.create({
      data: {
        customerId: dto.customerId,
        title: dto.title.trim(),
        details: dto.details?.trim(),
        vehicleId: dto.vehicleId,
        hireVehicleId: dto.hireVehicleId,
        status: dto.status,
      },
    });
  }

  addCaseUpdate(caseId: string, dto: CreateCustomerCaseUpdateDto) {
    return this.prisma.$transaction(async (tx) => {
      const customerCase = await tx.customerCase.findUnique({ where: { id: caseId } });
      if (!customerCase) throw new NotFoundException("Customer case not found.");

      const update = await tx.customerCaseUpdate.create({
        data: { caseId, status: dto.status, message: dto.message.trim() },
      });
      await tx.customerCase.update({ where: { id: caseId }, data: { status: dto.status } });
      return update;
    });
  }
}