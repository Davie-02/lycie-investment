import { BadRequestException, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { randomBytes, createHash } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { EmailService } from "../email/email.service";
import { passwordResetEmail } from "../email/email-templates";

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000; // 1 hour

function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService
  ) {}

  async login(email: string, password: string): Promise<{ accessToken: string; user: AuthenticatedUser }> {
    const user = await this.prisma.adminUser.findUnique({ where: { email } });

    // Same error for "no such user" and "wrong password" — don't reveal
    // which one it was, so a bad actor can't use this to enumerate accounts.
    if (!user || !user.isActive) {
      throw new UnauthorizedException("Invalid email or password.");
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException("Invalid email or password.");
    }

    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      role: user.role,
      name: user.name,
      email: user.email,
    });

    return {
      accessToken,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    };
  }

  /**
   * Always resolves the same way regardless of whether the email matches an
   * admin account — same reasoning as login's identical error for "no such
   * user" vs. "wrong password": don't let this endpoint be used to
   * enumerate which emails have admin access.
   */
  async requestPasswordReset(email: string): Promise<{ requested: true }> {
    const admin = await this.prisma.adminUser.findUnique({ where: { email } });

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
        data: { passwordHash },
      }),
      this.prisma.adminPasswordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
    ]);

    return { reset: true };
  }
}
