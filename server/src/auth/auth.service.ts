import { BadRequestException, Injectable, UnauthorizedException } from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import { randomBytes, createHash } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { EmailService } from "../email/email.service";
import { passwordChangedEmail, passwordResetEmail } from "../email/email-templates";
import { SessionService, type IssuedSession, type SessionRole } from "./session.service";
import { CLEARED_LOCK_STATE, isLocked, lockedMessage, stateAfterFailure } from "../security/lockout";
import { normalizeEmail } from "../security/email-check";
import {
  generateRecoveryCodes,
  generateTotpSecret,
  hashRecoveryCode,
  otpauthUri,
  verifyTotp,
} from "../security/totp";

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  role: string;
  /** Whether this admin has switched on two-factor sign-in. */
  twoFactorEnabled: boolean;
}

/** Result of step one of sign-in: either you're in, or a 2FA code is still needed. */
export type LoginResult =
  | { kind: "session"; session: IssuedSession; user: AuthenticatedUser }
  | { kind: "two-factor"; challenge: string };

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

  private toUser(admin: { id: string; name: string; email: string; role: string; totpEnabled: boolean }): AuthenticatedUser {
    return { id: admin.id, name: admin.name, email: admin.email, role: admin.role, twoFactorEnabled: admin.totpEnabled };
  }

  private issueFor(admin: { id: string; name: string; email: string; role: string }, remember: boolean) {
    return this.sessions.issue({ sub: admin.id, role: admin.role as SessionRole, name: admin.name, email: admin.email }, remember);
  }

  /** Records one more wrong attempt on an admin account (and locks it when the limit is reached). */
  private async recordFailure(admin: { id: string; failedLoginCount: number }): Promise<void> {
    await this.prisma.adminUser.update({ where: { id: admin.id }, data: stateAfterFailure(admin.failedLoginCount) });
  }

  /**
   * Step one of admin sign-in: email + password.
   *
   * Every failure — unknown email, wrong password, deactivated account —
   * gives the identical "Invalid email or password" so this can't be used to
   * discover which emails are admin accounts. The one deliberate exception is
   * the lockout notice, which only appears after five wrong passwords.
   */
  async login(email: string, password: string, remember: boolean): Promise<LoginResult> {
    const admin = await this.prisma.adminUser.findFirst({ where: { email: { equals: normalizeEmail(email), mode: "insensitive" } } });

    if (admin?.lockedUntil && isLocked(admin.lockedUntil)) {
      throw new UnauthorizedException(lockedMessage(admin.lockedUntil));
    }

    const passwordMatches = await bcrypt.compare(password, admin?.passwordHash ?? DUMMY_HASH);
    if (!admin || !admin.isActive || !passwordMatches) {
      if (admin) await this.recordFailure(admin);
      throw new UnauthorizedException("Invalid email or password.");
    }

    // Password correct. If two-factor is on, stop here and ask for the code.
    if (admin.totpEnabled) {
      return { kind: "two-factor", challenge: await this.sessions.issueTwoFactorChallenge(admin.id, remember) };
    }

    return { kind: "session", session: await this.completeSignIn(admin, remember), user: this.toUser(admin) };
  }

  /** Shared ending of every successful sign-in: forgive past failures, note the time, mint the session. */
  private async completeSignIn(
    admin: { id: string; name: string; email: string; role: string },
    remember: boolean
  ): Promise<IssuedSession> {
    await this.prisma.adminUser.update({ where: { id: admin.id }, data: { ...CLEARED_LOCK_STATE, lastLoginAt: new Date() } });
    return this.issueFor(admin, remember);
  }

  /**
   * Step two: the 6-digit authenticator code (or a one-time recovery code).
   * Wrong codes count toward the same lockout as wrong passwords, so the
   * 6-digit space can't be brute-forced.
   */
  async completeTwoFactorLogin(challenge: string, code: string): Promise<{ session: IssuedSession; user: AuthenticatedUser }> {
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

    return { session: await this.completeSignIn(admin, remember), user: this.toUser(admin) };
  }

  /**
   * Accepts either the current authenticator code or an unused recovery code.
   * A recovery code is burned as it is used.
   */
  private async checkSecondFactor(
    admin: { id: string; totpSecret: string | null; recoveryCodeHashes: string[] },
    code: string
  ): Promise<boolean> {
    if (admin.totpSecret && verifyTotp(admin.totpSecret, code)) return true;

    const hash = hashRecoveryCode(code);
    if (!admin.recoveryCodeHashes.includes(hash)) return false;

    await this.prisma.adminUser.update({
      where: { id: admin.id },
      data: { recoveryCodeHashes: admin.recoveryCodeHashes.filter((existing) => existing !== hash) },
    });
    return true;
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
    if (!verifyTotp(admin.totpSecret, code)) throw new BadRequestException("That code isn't right. Check your authenticator app and try again.");

    const recoveryCodes = generateRecoveryCodes();
    await this.prisma.adminUser.update({
      where: { id: adminId },
      data: { totpEnabled: true, recoveryCodeHashes: recoveryCodes.map(hashRecoveryCode) },
    });
    return { recoveryCodes };
  }

  async disableTwoFactor(adminId: string, password: string, code: string): Promise<{ disabled: true }> {
    const admin = await this.prisma.adminUser.findUniqueOrThrow({ where: { id: adminId } });
    if (!(await bcrypt.compare(password, admin.passwordHash))) throw new UnauthorizedException("Your password isn't right.");
    if (!(await this.checkSecondFactor(admin, code))) throw new UnauthorizedException("That code isn't right.");

    await this.prisma.adminUser.update({
      where: { id: adminId },
      data: { totpEnabled: false, totpSecret: null, recoveryCodeHashes: [] },
    });
    return { disabled: true };
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

    void this.emailService.send({ to: admin.email, ...passwordChangedEmail(admin.name) });
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
      await this.emailService.send({ to: admin.email, ...template });
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
    await this.prisma.$transaction([
      this.prisma.adminUser.update({
        where: { id: resetToken.adminId },
        // A reset also lifts any lockout and signs the account out everywhere.
        data: { passwordHash, passwordChangedAt: new Date(), ...CLEARED_LOCK_STATE },
      }),
      this.prisma.adminPasswordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
    ]);

    return { reset: true };
  }
}
