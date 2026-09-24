/**
 * People (HR): the staff directory and leave requests.
 *
 * Every staff member can request leave for themselves and see their own
 * requests. HR (view) sees everyone's; HR (edit) approves or declines, and the
 * employee is emailed the decision. A "who's away" list feeds the HR dashboard.
 */
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { EmailService } from "../email/email.service";
import { leaveDecisionEmail } from "../email/email-templates";
import { CreateLeaveDto, ReviewLeaveDto } from "./hr.dto";
import { workingDays } from "./leave-days";
import type { StaffActor } from "../access/current-staff.decorator";

const day = (date: Date) => date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

@Injectable()
export class HrService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService
  ) {}

  directory() {
    return this.prisma.adminUser.findMany({
      where: { isActive: true },
      orderBy: [{ department: "asc" }, { name: "asc" }],
      select: { id: true, name: true, email: true, phone: true, jobTitle: true, department: true, role: true },
    });
  }

  myLeave(employeeId: string) {
    return this.prisma.leaveRequest.findMany({ where: { employeeId }, orderBy: { startDate: "desc" }, take: 100 });
  }

  async requestLeave(actor: StaffActor, dto: CreateLeaveDto) {
    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);
    if (end < start) throw new BadRequestException("The last day can't be before the first day.");
    if (end.getTime() - start.getTime() > 120 * 24 * 60 * 60_000) throw new BadRequestException("Leave can be requested for up to 120 days at a time.");
    const days = workingDays(start, end);
    if (days === 0) throw new BadRequestException("Those dates are all weekend days.");
    const overlapping = await this.prisma.leaveRequest.findFirst({
      where: { employeeId: actor.sub, status: { in: ["pending", "approved"] }, startDate: { lte: end }, endDate: { gte: start } },
    });
    if (overlapping) throw new BadRequestException("You already have a leave request covering some of those days.");
    return this.prisma.leaveRequest.create({
      data: { employeeId: actor.sub, type: dto.type, startDate: start, endDate: end, days, reason: dto.reason ?? "" },
    });
  }

  async cancelMine(actor: StaffActor, id: string) {
    const leave = await this.prisma.leaveRequest.findUnique({ where: { id } });
    if (!leave || leave.employeeId !== actor.sub) throw new NotFoundException("Leave request not found.");
    if (leave.status !== "pending" && !(leave.status === "approved" && leave.startDate > new Date())) {
      throw new BadRequestException("Only pending requests, or approved leave that hasn't started, can be cancelled.");
    }
    return this.prisma.leaveRequest.update({ where: { id }, data: { status: "cancelled" } });
  }

  async list(status?: string) {
    return this.prisma.leaveRequest.findMany({
      where: status ? { status } : undefined,
      orderBy: [{ status: "asc" }, { startDate: "desc" }],
      take: 300,
      include: { employee: { select: { id: true, name: true, department: true, jobTitle: true } } },
    });
  }

  async review(actor: StaffActor, id: string, dto: ReviewLeaveDto) {
    const leave = await this.prisma.leaveRequest.findUnique({ where: { id }, include: { employee: true } });
    if (!leave) throw new NotFoundException("Leave request not found.");
    if (leave.employeeId === actor.sub) throw new ForbiddenException("You can't decide your own leave request.");
    if (leave.status !== "pending") throw new BadRequestException("This request has already been decided.");
    const updated = await this.prisma.leaveRequest.update({
      where: { id },
      data: { status: dto.status, reviewNote: dto.note ?? null, reviewedById: actor.sub, reviewedBy: actor.name, reviewedAt: new Date() },
    });
    void this.email
      .send({
        to: leave.employee.email,
        ...leaveDecisionEmail({
          name: leave.employee.name,
          approved: dto.status === "approved",
          period: `${day(leave.startDate)} – ${day(leave.endDate)} (${leave.days} working day${leave.days === 1 ? "" : "s"})`,
          note: dto.note,
          reviewer: actor.name,
        }),
      })
      .catch(() => undefined);
    return updated;
  }

  /** HR dashboard numbers. */
  async summary() {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const [staff, pending, away, invitesOutstanding] = await Promise.all([
      this.prisma.adminUser.count({ where: { isActive: true } }),
      this.prisma.leaveRequest.count({ where: { status: "pending" } }),
      this.prisma.leaveRequest.findMany({
        where: { status: "approved", startDate: { lte: today }, endDate: { gte: today } },
        include: { employee: { select: { name: true, department: true } } },
      }),
      this.prisma.adminUser.count({ where: { isActive: true, mustChangePassword: true } }),
    ]);
    return { staff, pendingLeave: pending, awayToday: away.map((a) => ({ name: a.employee.name, department: a.employee.department, until: a.endDate })), invitesOutstanding };
  }
}
