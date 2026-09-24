import { BadRequestException, Injectable, UnauthorizedException } from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import { randomBytes, createHash } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { EmailService } from "../email/email.service";
import { adminSignInAlertEmail, passwordChangedEmail, passwordResetEmail } from "../email/email-templates";
import { SessionService, type IssuedSession, type SessionRole } from "./session.service";
import { CLEARED_LOCK_STATE, isLocked, lockedMessage, stateAfterFailure } from "../security/lockout";
import { normalizeEmail } from "../security/email-check";
import { describeDevice } from "../security/device";
import { effectiveAccess, type AccessMap } from "../access/modules";
import { ownerIpAllowed, ownerTwoFactorRequired } from "../access/system-admin-policy";
import {
  generateRecoveryCodes,
  generateTotpSecret,
  hashRecoveryCode,
  matchTotpStep,
  otpauthUri,
} from "../security/totp";

/** Where a sign-in came from — shown in the "new sign-in" alert email. */
export interface SignInContext {
  ip?: string;
  userAgent?: string;
}

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  role: string;
  /** Whether this admin has switched on two-factor sign-in. */
  twoFactorEnabled: boolean;
  department: string | null;
  jobTitle: string | null;
  /** Module → level this person can use (what the workspace shows them). */
  access: AccessMap;
  /** A system administrator who still has to set up two-step verification before anything else works. */
  mustSetUpTwoFactor: boolean;
}

/** Result of step one of sign-in: you're in, a 2FA code is still needed, or a first password must be chosen. */
export type LoginResult =
  | { kind: "session"; session: IssuedSession; user: AuthenticatedUser }
  | { kind: "two-factor"; challenge: string }
  | { kind: "password-change"; challenge: string; name: string };

type AdminRow = Awaited<ReturnType<PrismaService["adminUser"]["findUniqueOrThrow"]>>;

/** Outcome of checking a password against a staff account, without deciding anything yet (see sign-in.controller.ts). */
export interface StaffPasswordCheck {
  admin: AdminRow | null;
  matches: boolean;
  locked: boolean;
}

/** How long a "confirm it's you" lasts for sensitive actions (changing access, adding administrators…). */
const STEP_UP_MS = 10 * 60 * 1000;

const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * A real bcrypt hash of a throwaway string. When someone signs in with an
 * email we don't have, we still compare against this so the request takes as
 * long as a real wrong-password attempt — otherwise response time would tell
 * an attacker which emails are admin accounts.
 */
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 12);

function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly sessions: SessionService
  ) {}

  toUser(admin: {
    id: string;
    name: string;
    email: string;
    role: string;
    totpEnabled: boolean;
    department?: string | null;
    jobTitle?: string | null;
    permissions?: unknown;
  }): AuthenticatedUser {
    return {
      id: admin.id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
      twoFactorEnabled: admin.totpEnabled,
      department: admin.department ?? null,
      jobTitle: admin.jobTitle ?? null,
      access: effectiveAccess(admin.role, admin.department, admin.permissions),
      mustSetUpTwoFactor: admin.role === "OWNER" && ownerTwoFactorRequired() && !admin.totpEnabled,
    };
  }

  private issueFor(admin: { id: string; name: string; email: string; role: string }, remember: boolean) {
    return this.sessions.issue({ sub: admin.id, role: admin.role as SessionRole, name: admin.name, email: admin.email }, remember);
  }

  /** Records one more wrong attempt on an admin account (and locks it when the limit is reached). */
  private async recordFailure(admin: { id: string; failedLoginCount: number }): Promise<void> {
    await this.prisma.adminUser.update({ where: { id: admin.id }, data: stateAfterFailure(admin.failedLoginCount) });
  }

  /**
   * Checks a password against the staff account with this email (if any),
   * without throwing or deciding anything. Always does one bcrypt compare —
   * against a dummy hash when there's no account — so timing reveals nothing.
   */
  async checkStaffPassword(email: string, password: string): Promise<StaffPasswordCheck> {
    const admin = await this.prisma.adminUser.findFirst({ where: { email: { equals: normalizeEmail(email), mode: "insensitive" } } });
    const locked = Boolean(admin?.lockedUntil && isLocked(admin.lockedUntil));
    const matches = await bcrypt.compare(password, admin?.passwordHash ?? DUMMY_HASH);
    return { admin, matches: Boolean(admin && admin.isActive && matches && !locked), locked };
  }

  /** Counts a wrong password against a staff account (used by the shared site sign-in too). */
  async recordStaffFailure(admin: { id: string; failedLoginCount: number }): Promise<void> {
    await this.recordFailure(admin);
  }

  /**
   * The SYSTEM ADMINISTRATOR PORTAL (/admin/login): only Owner accounts. Other
   * staff are pointed to the normal site sign-in (after a correct password, so
   * this reveals nothing to someone guessing). Owners never get "keep me signed
   * in", may be restricted to listed networks, and must use two-step verification.
   *
   * Every failure gives the identical "Invalid email or password" (except the
   * lockout notice after five wrong passwords).
   */
  async login(email: string, password: string, _remember: boolean, context: SignInContext = {}): Promise<LoginResult> {
    const { admin, matches, locked } = await this.checkStaffPassword(email, password);
    if (admin && locked) throw new UnauthorizedException(lockedMessage(admin.lockedUntil!));
    if (!admin || !matches) {
      if (admin) await this.recordFailure(admin);
      throw new UnauthorizedException("Invalid email or password.");
    }
    if (admin.role !== "OWNER") {
      throw new UnauthorizedException("Staff accounts sign in on the website's main sign-in page, not the system administrator portal.");
    }
    if (!ownerIpAllowed(context.ip)) {
      throw new UnauthorizedException("System administrator accounts can't be used from this network.");
    }
    return this.continueSignIn(admin, false, context);
  }

  /**
   * After a correct password (portal or site sign-in): a one-time invitation
   * password must be replaced first; then two-step verification if it's on;
   * otherwise the session.
   */
  async continueSignIn(admin: AdminRow, remember: boolean, context: SignInContext): Promise<LoginResult> {
    const keep = admin.role === "OWNER" ? false : remember;
    if (admin.mustChangePassword) {
      if (admin.tempPasswordExpiresAt && admin.tempPasswordExpiresAt < new Date()) {
        throw new UnauthorizedException("Your one-time password has expired. Ask your administrator to send a new invitation.");
      }
      return { kind: "password-change", challenge: await this.sessions.issuePasswordChangeChallenge(admin.id, keep), name: admin.name };
    }
    if (admin.totpEnabled) {
      return { kind: "two-factor", challenge: await this.sessions.issueTwoFactorChallenge(admin.id, keep) };
    }
    return { kind: "session", session: await this.completeSignIn(admin, keep, context), user: this.toUser(admin) };
  }

  /**
   * First sign-in with an invitation: replaces the one-time password with the
   * person's own (strength checked by the DTO), then continues sign-in.
   */
  async completeFirstPassword(challenge: string, newPassword: string, context: SignInContext = {}): Promise<LoginResult> {
    const { adminId, remember } = await this.sessions.readPasswordChangeChallenge(challenge);
    const admin = await this.prisma.adminUser.findUnique({ where: { id: adminId } });
    if (!admin || !admin.isActive || !admin.mustChangePassword) throw new UnauthorizedException("Please sign in again.");
    if (await bcrypt.compare(newPassword, admin.passwordHash)) {
      throw new BadRequestException("Choose a new password — not the one-time password from the email.");
    }
    const updated = await this.prisma.adminUser.update({
      where: { id: adminId },
      data: {
        passwordHash: await bcrypt.hash(newPassword, 12),
        mustChangePassword: false,
        tempPasswordExpiresAt: null,
        passwordChangedAt: new Date(),
        ...CLEARED_LOCK_STATE,
      },
    });
    this.sessions.forgetAdmin(adminId);
    return this.continueSignIn(updated, remember, context);
  }

  /**
   * "Confirm it's you" before the most sensitive actions (changing someone's
   * access, adding or removing administrators, resetting two-step verification):
   * password, plus the authenticator code when two-step is on. Lasts 10 minutes.
   */
  async confirmIdentity(adminId: string, password: string, code?: string): Promise<{ confirmedUntil: string }> {
    const admin = await this.prisma.adminUser.findUniqueOrThrow({ where: { id: adminId } });
    if (admin.lockedUntil && isLocked(admin.lockedUntil)) throw new UnauthorizedException(lockedMessage(admin.lockedUntil));
    if (!(await bcrypt.compare(password, admin.passwordHash))) {
      await this.recordFailure(admin);
      throw new UnauthorizedException("Your password isn't right.");
    }
    if (admin.totpEnabled && !(code && (await this.checkSecondFactor(admin, code)))) {
      throw new UnauthorizedException("Enter the current code from your authenticator app.");
    }
    const until = new Date(Date.now() + STEP_UP_MS);
    await this.prisma.adminUser.update({ where: { id: adminId }, data: { stepUpUntil: until } });
    return { confirmedUntil: until.toISOString() };
  }

  /**
   * Shared ending of every successful sign-in: forgive past failures, note the
   * time, email the owner a sign-in alert, mint the session.
   */
  private async completeSignIn(
    admin: { id: string; name: string; email: string; role: string },
    remember: boolean,
    context: SignInContext
  ): Promise<IssuedSession> {
    const now = new Date();
    await this.prisma.adminUser.update({ where: { id: admin.id }, data: { ...CLEARED_LOCK_STATE, lastLoginAt: now } });

    // Not awaited: the alert must never slow down or block signing in.
    const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:5173";
    void this.emailService
      .send({
        to: admin.email,
        ...adminSignInAlertEmail({
          name: admin.name,
          when: now,
          ip: context.ip ?? "unknown",
          device: describeDevice(context.userAgent),
          securityUrl: `${frontendUrl}/admin/security`,
        }),
      })
      .catch(() => undefined);

    return this.issueFor(admin, remember);
  }

  /**
   * Step two: the 6-digit authenticator code (or a one-time recovery code).
   * Wrong codes count toward the same lockout as wrong passwords, so the
   * 6-digit space can't be brute-forced.
   */
  async completeTwoFactorLogin(
    challenge: string,
    code: string,
    context: SignInContext = {}
  ): Promise<{ session: IssuedSession; user: AuthenticatedUser }> {
    const { adminId, remember } = await this.sessions.readTwoFactorChallenge(challenge);
    const admin = await this.prisma.adminUser.findUnique({ where: { id: adminId } });
    if (!admin || !admin.isActive || !admin.totpEnabled || !admin.totpSecret) {
      throw new UnauthorizedException("Invalid sign-in.");
    }
    if (admin.lockedUntil && isLocked(admin.lockedUntil)) {
      throw new UnauthorizedException(lockedMessage(admin.lockedUntil));
    }

    if (!(await this.checkSecondFactor(admin, code))) {
      await this.recordFailure(admin);
      throw new UnauthorizedException("That code isn't right. Check your authenticator app and try again.");
    }

    return { session: await this.completeSignIn(admin, admin.role === "OWNER" ? false : remember, context), user: this.toUser(admin) };
  }

  /**
   * Accepts either the current authenticator code or an unused recovery code.
   *
   * Each authenticator code works only ONCE: the accepted 30-second step is
   * saved and that step (and older ones) are refused afterwards, so a code
   * seen over someone's shoulder or captured by a fake login page can't be
   * replayed. Both kinds of code are claimed with a conditional update, so
   * two simultaneous attempts can't both use the same one.
   */
  private async checkSecondFactor(
    admin: { id: string; totpSecret: string | null; recoveryCodeHashes: string[]; lastTotpStep: number | null },
    code: string
  ): Promise<boolean> {
    const step = admin.totpSecret ? matchTotpStep(admin.totpSecret, code, Date.now(), 1, admin.lastTotpStep) : null;
    if (step !== null) {
      const claimed = await this.prisma.adminUser.updateMany({
        where: { id: admin.id, OR: [{ lastTotpStep: null }, { lastTotpStep: { lt: step } }] },
        data: { lastTotpStep: step },
      });
      return claimed.count === 1;
    }

    const hash = hashRecoveryCode(code);
    if (!admin.recoveryCodeHashes.includes(hash)) return false;

    const claimed = await this.prisma.adminUser.updateMany({
      where: { id: admin.id, recoveryCodeHashes: { has: hash } },
      data: { recoveryCodeHashes: admin.recoveryCodeHashes.filter((existing) => existing !== hash) },
    });
    return claimed.count === 1;
  }

  /** Who is signed in right now — also how the browser confirms its cookie really works. */
  async getSession(adminId: string): Promise<{ user: AuthenticatedUser }> {
    const admin = await this.prisma.adminUser.findUnique({ where: { id: adminId } });
    if (!admin || !admin.isActive) throw new UnauthorizedException("This account is no longer active.");
    return { user: this.toUser(admin) };
  }

  // ---------------------------------------------------------------- 2FA setup

  /**
   * Starts two-factor setup: makes a secret and returns it (plus the
   * otpauth:// link for the QR code). Not active until enableTwoFactor()
   * proves the admin's app produces matching codes.
   */
  async beginTwoFactorSetup(adminId: string): Promise<{ secret: string; otpauthUri: string }> {
    const admin = await this.prisma.adminUser.findUniqueOrThrow({ where: { id: adminId } });
    if (admin.totpEnabled) throw new BadRequestException("Two-factor sign-in is already on. Turn it off first to set it up again.");

    const secret = generateTotpSecret();
    await this.prisma.adminUser.update({ where: { id: adminId }, data: { totpSecret: secret } });
    return { secret, otpauthUri: otpauthUri(admin.email, secret) };
  }

  /** Confirms setup with a first code, switches 2FA on, and returns the one-time recovery codes (shown only now). */
  async enableTwoFactor(adminId: string, code: string): Promise<{ recoveryCodes: string[] }> {
    const admin = await this.prisma.adminUser.findUniqueOrThrow({ where: { id: adminId } });
    if (!admin.totpSecret || admin.totpEnabled) throw new BadRequestException("Start two-factor setup first.");
    const step = matchTotpStep(admin.totpSecret, code);
    if (step === null) throw new BadRequestException("That code isn't right. Check your authenticator app and try again.");

    const recoveryCodes = generateRecoveryCodes();
    await this.prisma.adminUser.update({
      where: { id: adminId },
      data: { totpEnabled: true, recoveryCodeHashes: recoveryCodes.map(hashRecoveryCode), lastTotpStep: step },
    });
    return { recoveryCodes };
  }

  async disableTwoFactor(adminId: string, password: string, code: string): Promise<{ disabled: true }> {
    const admin = await this.prisma.adminUser.findUniqueOrThrow({ where: { id: adminId } });
    if (!(await bcrypt.compare(password, admin.passwordHash))) throw new UnauthorizedException("Your password isn't right.");
    if (!(await this.checkSecondFactor(admin, code))) throw new UnauthorizedException("That code isn't right.");

    await this.prisma.adminUser.update({
      where: { id: adminId },
      data: { totpEnabled: false, totpSecret: null, recoveryCodeHashes: [], lastTotpStep: null },
    });
    return { disabled: true };
  }

  /**
   * "Sign out everywhere": every other device and browser signed in to this
   * account is signed out at once (for a lost phone or a sign-in alert you
   * don't recognise). Returns a fresh session so this device stays in.
   */
  async signOutEverywhere(adminId: string, remember: boolean): Promise<{ session: IssuedSession; user: AuthenticatedUser }> {
    const admin = await this.prisma.adminUser.findUniqueOrThrow({ where: { id: adminId } });
    await this.sessions.revokeAll(admin.role as SessionRole, adminId);
    return { session: await this.issueFor(admin, remember), user: this.toUser(admin) };
  }

  // ---------------------------------------------------------------- passwords

  /**
   * An admin changing their own password. Signs out every OTHER device (the
   * password-changed timestamp invalidates older tokens) and hands back a
   * fresh session so this device stays signed in.
   */
  async changePassword(
    adminId: string,
    currentPassword: string,
    newPassword: string,
    remember: boolean
  ): Promise<{ session: IssuedSession; user: AuthenticatedUser }> {
    const admin = await this.prisma.adminUser.findUniqueOrThrow({ where: { id: adminId } });
    if (!(await bcrypt.compare(currentPassword, admin.passwordHash))) {
      throw new UnauthorizedException("Your current password isn't right.");
    }
    if (currentPassword === newPassword) throw new BadRequestException("Choose a password you haven't been using.");

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.adminUser.update({ where: { id: adminId }, data: { passwordHash, passwordChangedAt: new Date() } });
    this.sessions.forget(admin.role as SessionRole, adminId);

    void this.emailService.send({ to: admin.email, ...passwordChangedEmail(admin.name) }).catch(() => undefined);
    return { session: await this.issueFor(admin, remember), user: this.toUser(admin) };
  }

  /**
   * Always resolves the same way regardless of whether the email matches an
   * admin account — same reasoning as login's identical error for "no such
   * user" vs. "wrong password": don't let this endpoint be used to
   * enumerate which emails have admin access.
   */
  async requestPasswordReset(email: string): Promise<{ requested: true }> {
    const admin = await this.prisma.adminUser.findFirst({ where: { email: { equals: normalizeEmail(email), mode: "insensitive" } } });

    if (admin && admin.isActive) {
      const rawToken = randomBytes(32).toString("hex");
      await this.prisma.adminPasswordResetToken.create({
        data: {
          adminId: admin.id,
          tokenHash: hashToken(rawToken),
          expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
        },
      });

      const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:5173";
      const resetUrl = `${frontendUrl}/admin/reset-password?token=${rawToken}`;
      const template = passwordResetEmail(resetUrl);
      // Not awaited: waiting for the email provider would make "account exists"
      // answers measurably slower than "no such account", leaking which emails are admins.
      void this.emailService.send({ to: admin.email, ...template }).catch(() => undefined);
    }

    return { requested: true };
  }

  async resetPassword(rawToken: string, newPassword: string): Promise<{ reset: true }> {
    const tokenHash = hashToken(rawToken);
    const resetToken = await this.prisma.adminPasswordResetToken.findUnique({ where: { tokenHash } });

    if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
      throw new BadRequestException("This password reset link is invalid or has expired.");
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      // Claim the link atomically: if two requests race with the same link, only one wins.
      const claimed = await tx.adminPasswordResetToken.updateMany({
        where: { id: resetToken.id, usedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now },
      });
      if (claimed.count !== 1) throw new BadRequestException("This password reset link is invalid or has expired.");

      await tx.adminUser.update({
        where: { id: resetToken.adminId },
        // A reset also lifts any lockout and signs the account out everywhere.
        // Choosing a password through the emailed link also completes a pending invitation.
        data: { passwordHash, passwordChangedAt: now, mustChangePassword: false, tempPasswordExpiresAt: null, ...CLEARED_LOCK_STATE },
      });
      // Any other reset links still in someone's inbox stop working too.
      await tx.adminPasswordResetToken.updateMany({ where: { adminId: resetToken.adminId, usedAt: null }, data: { usedAt: now } });
    });
    this.sessions.forgetAdmin(resetToken.adminId);

    return { reset: true };
  }
}
