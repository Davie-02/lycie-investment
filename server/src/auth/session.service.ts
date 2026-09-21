import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { Response } from "express";
import { PrismaService } from "../prisma/prisma.service";
import { sessionLifetimeMs, setSessionCookie } from "./session-cookie";

/** Roles a real, signed-in session can carry. Anything else in a token (e.g. a half-finished 2FA sign-in) is refused. */
export const ADMIN_ROLES = ["OWNER", "MANAGER", "VIEWER"] as const;
export const SESSION_ROLES = [...ADMIN_ROLES, "CUSTOMER"] as const;
export type SessionRole = (typeof SESSION_ROLES)[number];

/** Marker role of the short-lived token handed out between "password correct" and "2FA code correct". */
const TWO_FACTOR_PENDING_ROLE = "2FA_PENDING";
const TWO_FACTOR_WINDOW_SECONDS = 5 * 60;

export interface SessionClaims {
  sub: string;
  role: SessionRole;
  name: string;
  email: string;
  /** Signed in with "keep me signed in" — carried so a re-issued session (after a password change) keeps the same length. */
  remember?: boolean;
  /** Seconds since epoch, filled in by the JWT library when signing. */
  iat?: number;
}

export interface IssuedSession {
  token: string;
  maxAgeMs: number;
  expiresAt: string;
  remember: boolean;
}

/** How long a "still active?" answer is trusted, so authenticated requests don't each hit the database. */
const STATUS_CACHE_MS = 15_000;

@Injectable()
export class SessionService {
  /** "role:id" → what the database said last time. */
  private readonly statusCache = new Map<string, { active: boolean; changedAtMs: number | null; until: number }>();

  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService
  ) {}

  /** Creates the signed token for a sign-in. `remember` picks the long (30-day) or short (2-hour) lifetime. */
  async issue(claims: Omit<SessionClaims, "iat" | "remember">, remember: boolean): Promise<IssuedSession> {
    const maxAgeMs = sessionLifetimeMs(remember);
    const token = await this.jwt.signAsync({ ...claims, remember }, { expiresIn: Math.floor(maxAgeMs / 1000) });
    return { token, maxAgeMs, expiresAt: new Date(Date.now() + maxAgeMs).toISOString(), remember };
  }

  /** Sets the browser cookie for an issued session. Non-"remember" sessions get a browser-session cookie. */
  attach(response: Response, cookieName: string, session: IssuedSession): void {
    setSessionCookie(response, cookieName, session.token, session.remember ? session.maxAgeMs : undefined);
  }

  /** Token proving "password was right, 2FA code still needed". Cannot be used as a login — see JwtAuthGuard. */
  issueTwoFactorChallenge(adminId: string, remember: boolean): Promise<string> {
    return this.jwt.signAsync(
      { sub: adminId, role: TWO_FACTOR_PENDING_ROLE, remember },
      { expiresIn: TWO_FACTOR_WINDOW_SECONDS }
    );
  }

  async readTwoFactorChallenge(token: string): Promise<{ adminId: string; remember: boolean }> {
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; role: string; remember?: boolean }>(token);
      if (payload.role !== TWO_FACTOR_PENDING_ROLE) throw new Error("wrong token type");
      return { adminId: payload.sub, remember: Boolean(payload.remember) };
    } catch {
      throw new UnauthorizedException("Your sign-in took too long. Please start again.");
    }
  }

  /**
   * Rejects a token whose account has since been deactivated, or whose
   * password was changed after the token was issued. This is what makes
   * "deactivate this admin" and "I reset my password after a leak" take effect
   * immediately instead of when the token eventually expires.
   */
  async assertStillValid(claims: SessionClaims): Promise<void> {
    const key = `${claims.role}:${claims.sub}`;
    let entry = this.statusCache.get(key);

    if (!entry || entry.until < Date.now()) {
      const isCustomer = claims.role === "CUSTOMER";
      const row = isCustomer
        ? await this.prisma.customerUser.findUnique({ where: { id: claims.sub }, select: { isActive: true, passwordChangedAt: true } })
        : await this.prisma.adminUser.findUnique({ where: { id: claims.sub }, select: { isActive: true, passwordChangedAt: true } });

      entry = {
        active: Boolean(row?.isActive),
        changedAtMs: row?.passwordChangedAt ? row.passwordChangedAt.getTime() : null,
        until: Date.now() + STATUS_CACHE_MS,
      };
      this.statusCache.set(key, entry);
      // Keep the cache from growing without bound on a long-running server.
      if (this.statusCache.size > 5000) this.statusCache.clear();
    }

    if (!entry.active) throw new UnauthorizedException("This account is no longer active.");

    // iat is whole seconds; allow a second of slack so a session created in the
    // same instant as the password change isn't rejected by rounding.
    if (entry.changedAtMs && claims.iat !== undefined && claims.iat * 1000 + 1000 < entry.changedAtMs) {
      throw new UnauthorizedException("Your password was changed. Please sign in again.");
    }
  }

  /** Forget cached answers for one account (call after changing its status or password). */
  forget(role: SessionRole, id: string): void {
    this.statusCache.delete(`${role}:${id}`);
  }
}
