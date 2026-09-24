/**
 * Staff accounts: inviting people, their department and job, their module
 * access, and deactivating or removing them.
 *
 * Who can do what:
 *  - System administrators (OWNER) can do everything here, including creating
 *    other administrators and setting anyone's per-module access.
 *  - Staff with "manage" access to People (HR) or System can invite
 *    employees and edit their profile/department, re-send invitations and
 *    deactivate them — but never touch an administrator account, change roles,
 *    or set module access.
 *  - The most sensitive changes (new administrator, role change, access
 *    change, removing an account, resetting two-step verification) also need
 *    a recent "confirm it's you" (password + code, see AuthService.confirmIdentity).
 *
 * Invitations: the server generates a strong one-time password, emails it
 * with a sign-in link, and the person must choose their own at first sign-in.
 * It expires after 72 hours. If email isn't set up, the password is returned
 * once so the inviter can pass it on in person.
 */
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { EmailService } from "../email/email.service";
import { CreateAdminUserDto } from "./dto/create-admin-user.dto";
import { UpdateAdminUserDto } from "./dto/update-admin-user.dto";
import { runSerializable } from "../common/run-serializable";
import { checkEmailDeliverable, normalizeEmail } from "../security/email-check";
import { SessionService } from "../auth/session.service";
import { generateTempPassword, TEMP_PASSWORD_TTL_MS } from "../security/temp-password";
import { staffInviteEmail } from "../email/email-templates";
import { DEPARTMENTS, atLeast, cleanOverrides, effectiveAccess } from "../access/modules";
import type { StaffActor } from "../access/current-staff.decorator";

// Fields that are safe to return from the API — never the password hash,
// two-factor secret or recovery codes.
const SAFE_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  createdAt: true,
  totpEnabled: true,
  lastLoginAt: true,
  department: true,
  jobTitle: true,
  phone: true,
  permissions: true,
  mustChangePassword: true,
  invitedAt: true,
  tempPasswordExpiresAt: true,
} as const;

type SafeUser = Prisma.AdminUserGetPayload<{ select: typeof SAFE_SELECT }>;

function withAccess(user: SafeUser) {
  return { ...user, access: effectiveAccess(user.role, user.department, user.permissions), overrides: cleanOverrides(user.permissions) };
}

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionService,
    private readonly email: EmailService
  ) {}

  private isSystemAdmin(actor: StaffActor): boolean {
    return actor.role === "OWNER";
  }

  /** Can this person manage staff accounts at all (system admin, or manage on HR/System)? */
  private assertCanManageStaff(actor: StaffActor): void {
    if (this.isSystemAdmin(actor) || atLeast(actor.access.hr, "manage") || atLeast(actor.access.system, "manage")) return;
    throw new ForbiddenException("You need manage access to People (HR) to change staff accounts.");
  }

  /** The most sensitive changes need a "confirm it's you" from the last 10 minutes. */
  private async assertRecentlyConfirmed(actor: StaffActor): Promise<void> {
    const row = await this.prisma.adminUser.findUnique({ where: { id: actor.sub }, select: { stepUpUntil: true } });
    if (!row?.stepUpUntil || row.stepUpUntil < new Date()) {
      throw new ForbiddenException({
        statusCode: 403,
        code: "STEP_UP_REQUIRED",
        message: "Please confirm it's you (password and authenticator code) to make this change.",
      });
    }
  }

  private validDepartment(department: string | null | undefined): string | null | undefined {
    if (department === undefined || department === null || department === "") return department === "" ? null : department;
    if (!DEPARTMENTS[department]) throw new BadRequestException("Unknown department.");
    return department;
  }

  private overridesFrom(raw: Record<string, string> | null | undefined): Prisma.InputJsonValue | typeof Prisma.DbNull | undefined {
    if (raw === undefined) return undefined;
    if (raw === null) return Prisma.DbNull;
    const clean = cleanOverrides(raw);
    return Object.keys(clean).length ? (clean as Prisma.InputJsonValue) : Prisma.DbNull;
  }

  async findAll() {
    const users = await this.prisma.adminUser.findMany({ select: SAFE_SELECT, orderBy: { createdAt: "asc" } });
    return users.map(withAccess);
  }

  /** Makes a one-time password, stores its hash, and emails the invitation. */
  private async issueInvite(user: { id: string; name: string; email: string; role: string; jobTitle: string | null; department: string | null }, actor: StaffActor) {
    const tempPassword = generateTempPassword();
    const expiresAt = new Date(Date.now() + TEMP_PASSWORD_TTL_MS);
    await this.prisma.adminUser.update({
      where: { id: user.id },
      data: {
        passwordHash: await bcrypt.hash(tempPassword, 12),
        mustChangePassword: true,
        tempPasswordExpiresAt: expiresAt,
        passwordChangedAt: new Date(),
        failedLoginCount: 0,
        lockedUntil: null,
        invitedAt: new Date(),
        invitedById: actor.sub,
      },
    });
    this.sessions.forgetAdmin(user.id);

    const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:5173";
    const isSystemAdmin = user.role === "OWNER";
    const position = [user.jobTitle, user.department ? DEPARTMENTS[user.department]?.label : null].filter(Boolean).join(", ");
    const sent = await this.email.sendChecked({
      to: user.email,
      ...staffInviteEmail({
        name: user.name,
        invitedBy: actor.name || "Your administrator",
        position,
        email: user.email,
        tempPassword,
        signInUrl: isSystemAdmin ? `${frontendUrl}/admin/login` : `${frontendUrl}/account/login`,
        expiresAt,
        isSystemAdmin,
      }),
    });
    // Only when the email couldn't go out does the inviter see the password (once), to hand it over in person.
    return { inviteEmailed: sent.ok, temporaryPassword: sent.ok ? undefined : tempPassword, inviteExpiresAt: expiresAt.toISOString() };
  }

  async create(dto: CreateAdminUserDto, actor: StaffActor) {
    this.assertCanManageStaff(actor);
    if (dto.role === "OWNER" && !this.isSystemAdmin(actor)) throw new ForbiddenException("Only a system administrator can add another administrator.");
    if (dto.permissions && !this.isSystemAdmin(actor)) throw new ForbiddenException("Only a system administrator can set module access.");
    if (dto.role === "OWNER" || dto.permissions) await this.assertRecentlyConfirmed(actor);

    // Staff receive their invitation and security alerts by email, so the address must really work.
    const verdict = await checkEmailDeliverable(dto.email, { verifyMailbox: true });
    if (!verdict.ok) throw new BadRequestException(verdict.reason);

    let created: SafeUser;
    try {
      created = await this.prisma.adminUser.create({
        data: {
          name: dto.name,
          email: normalizeEmail(dto.email),
          role: dto.role,
          department: this.validDepartment(dto.department) ?? null,
          jobTitle: dto.jobTitle || null,
          phone: dto.phone || null,
          permissions: this.overridesFrom(dto.permissions),
          // Replaced by issueInvite straight away; never usable.
          passwordHash: await bcrypt.hash(generateTempPassword(), 4),
          mustChangePassword: true,
        },
        select: SAFE_SELECT,
      });
    } catch (err) {
      // The database's unique constraint is the single source of truth (no check-then-write race).
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictException("A staff account with this email already exists.");
      }
      throw err;
    }

    const invite = await this.issueInvite(created, actor);
    const fresh = await this.prisma.adminUser.findUniqueOrThrow({ where: { id: created.id }, select: SAFE_SELECT });
    return { user: withAccess(fresh), ...invite };
  }

  /**
   * Edits a staff account. The "don't strand the company with no active
   * administrator" check and the write happen in one Serializable transaction
   * (see run-serializable.ts), so two simultaneous demotions can't both pass.
   */
  async update(id: string, dto: UpdateAdminUserDto, actor: StaffActor) {
    this.assertCanManageStaff(actor);
    const systemAdmin = this.isSystemAdmin(actor);
    const target = await this.prisma.adminUser.findUnique({ where: { id }, select: { role: true } });
    if (!target) throw new NotFoundException("Staff account not found.");

    if (!systemAdmin) {
      if (target.role === "OWNER") throw new ForbiddenException("Only a system administrator can change an administrator account.");
      if (dto.role !== undefined) throw new ForbiddenException("Only a system administrator can change someone's role.");
      if (dto.permissions !== undefined) throw new ForbiddenException("Only a system administrator can change module access.");
      if (dto.resetTwoFactor) throw new ForbiddenException("Only a system administrator can reset two-step verification.");
    }
    if (id === actor.sub && (dto.role !== undefined || dto.isActive === false || dto.permissions !== undefined)) {
      throw new BadRequestException("You can't change your own role, access or active status.");
    }
    const sensitive = dto.role !== undefined || dto.permissions !== undefined || dto.resetTwoFactor || (target.role === "OWNER" && dto.isActive === false);
    if (sensitive) await this.assertRecentlyConfirmed(actor);

    const updated = await runSerializable(this.prisma, async (tx) => {
      const current = await tx.adminUser.findUniqueOrThrow({ where: { id } });
      const losingOwner = current.role === "OWNER" && ((dto.role && dto.role !== "OWNER") || dto.isActive === false);
      if (losingOwner) {
        const ownerCount = await tx.adminUser.count({ where: { role: "OWNER", isActive: true } });
        if (ownerCount <= 1) throw new BadRequestException("This is the only active system administrator — make someone else an administrator first.");
      }

      const data: Prisma.AdminUserUpdateInput = {};
      if (dto.name !== undefined) data.name = dto.name;
      if (dto.role !== undefined) data.role = dto.role;
      if (dto.isActive !== undefined) data.isActive = dto.isActive;
      if (dto.department !== undefined) data.department = this.validDepartment(dto.department) ?? null;
      if (dto.jobTitle !== undefined) data.jobTitle = dto.jobTitle || null;
      if (dto.phone !== undefined) data.phone = dto.phone || null;
      if (dto.permissions !== undefined) data.permissions = this.overridesFrom(dto.permissions);
      if (dto.resetTwoFactor) {
        data.totpEnabled = false;
        data.totpSecret = null;
        data.recoveryCodeHashes = [];
        data.lastTotpStep = null;
      }
      return tx.adminUser.update({ where: { id }, data, select: SAFE_SELECT });
    });
    // Role, access or status changes must bite immediately, not after the status cache expires.
    this.sessions.forgetAdmin(id);

    const invite = dto.resendInvite ? await this.issueInvite(updated, actor) : {};
    const fresh = await this.prisma.adminUser.findUniqueOrThrow({ where: { id }, select: SAFE_SELECT });
    return { user: withAccess(fresh), ...invite };
  }

  /** Removing an account entirely (deactivating is usually better — it keeps history). */
  async remove(id: string, actor: StaffActor) {
    if (!this.isSystemAdmin(actor) && !atLeast(actor.access.system, "manage")) {
      throw new ForbiddenException("Only a system administrator can delete staff accounts. You can deactivate them instead.");
    }
    if (id === actor.sub) throw new BadRequestException("You can't delete your own account while signed in as it.");
    await this.assertRecentlyConfirmed(actor);

    return runSerializable(this.prisma, async (tx) => {
      const target = await tx.adminUser.findUnique({ where: { id } });
      if (!target) throw new NotFoundException("Staff account not found.");
      if (target.role === "OWNER" && !this.isSystemAdmin(actor)) throw new ForbiddenException("Only a system administrator can remove an administrator.");
      if (target.role === "OWNER" && (await tx.adminUser.count({ where: { role: "OWNER" } })) <= 1) {
        throw new BadRequestException("You can't delete the only system administrator.");
      }
      await tx.adminUser.delete({ where: { id } });
      return { deleted: true };
    });
  }
}
