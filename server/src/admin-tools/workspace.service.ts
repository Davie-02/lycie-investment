/**
 * Numbers for the staff workspace dashboards: one small set of counts per
 * module, computed only for the modules the person can see, in one request.
 * Each module's numbers are cached for 20 seconds, so a busy office opening
 * dashboards at once costs the database one query set, not dozens — this is
 * what keeps every dashboard quick to open.
 */
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { atLeast, MODULE_KEYS, type AccessMap, type ModuleKey } from "../access/modules";
import { PUBLIC } from "../content-admin/content-state";

export interface Stat {
  key: string;
  label: string;
  value: number;
  /** Where clicking the number goes. */
  path: string;
  /** Needs someone's attention (shown highlighted). */
  attention?: boolean;
}

const CACHE_MS = 20_000;

@Injectable()
export class WorkspaceService {
  private readonly cache = new Map<ModuleKey, { until: number; stats: Promise<Stat[]> }>();

  constructor(private readonly prisma: PrismaService) {}

  async summary(access: AccessMap): Promise<Partial<Record<ModuleKey, Stat[]>>> {
    const visible = MODULE_KEYS.filter((key) => atLeast(access[key], "view"));
    const entries = await Promise.all(visible.map(async (key) => [key, await this.statsFor(key)] as const));
    return Object.fromEntries(entries);
  }

  private statsFor(key: ModuleKey): Promise<Stat[]> {
    const hit = this.cache.get(key);
    if (hit && hit.until > Date.now()) return hit.stats;
    const stats = this.compute(key).catch((error) => {
      this.cache.delete(key);
      throw error;
    });
    this.cache.set(key, { until: Date.now() + CACHE_MS, stats });
    return stats;
  }

  private async compute(key: ModuleKey): Promise<Stat[]> {
    const p = this.prisma;
    const now = new Date();
    const days = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60_000);
    switch (key) {
      case "sales": {
        const [inquiries, available, drafts, deals] = await Promise.all([
          p.inquiry.count({ where: { status: "new" } }),
          p.vehicle.count({ where: { ...PUBLIC.vehicles, status: "available" } }),
          p.vehicle.count({ where: { isPublished: false, archivedAt: null } }),
          p.deal.count({ where: { status: "NEW" } }),
        ]);
        return [
          { key: "inquiries", label: "New inquiries", value: inquiries, path: "/admin/requests?tab=inquiries", attention: inquiries > 0 },
          { key: "available", label: "Vehicles on sale", value: available, path: "/admin/vehicles" },
          { key: "drafts", label: "Draft listings", value: drafts, path: "/admin/vehicles" },
          { key: "deals", label: "Deals to review", value: deals, path: "/admin/deals", attention: deals > 0 },
        ];
      }
      case "hire": {
        const [pending, active, overdue, fleet] = await Promise.all([
          p.hireRequest.count({ where: { status: "pending" } }),
          p.hireRequest.count({ where: { status: "confirmed", pickupDate: { lte: now }, returnDate: { gte: now } } }),
          p.hireRequest.count({ where: { status: "confirmed", returnDate: { lt: now } } }),
          p.hireVehicle.count({ where: { available: true, archivedAt: null } }),
        ]);
        return [
          { key: "pending", label: "Requests to review", value: pending, path: "/admin/bookings", attention: pending > 0 },
          { key: "active", label: "Out on hire now", value: active, path: "/admin/bookings" },
          { key: "overdue", label: "Overdue returns", value: overdue, path: "/admin/bookings", attention: overdue > 0 },
          { key: "fleet", label: "Vehicles for hire", value: fleet, path: "/admin/hire-vehicles" },
        ];
      }
      case "imports": {
        const [imports, clearing, open, arriving] = await Promise.all([
          p.importRequest.count({ where: { status: "new" } }),
          p.clearingRequest.count({ where: { status: "new" } }),
          p.customerCase.count({ where: { kind: { in: ["import", "clearing"] }, status: { notIn: ["COMPLETED", "CANCELLED"] } } }),
          p.customerCase.count({ where: { kind: { in: ["import", "clearing"] }, status: { notIn: ["COMPLETED", "CANCELLED"] }, eta: { lte: days(-7) } } }),
        ]);
        return [
          { key: "imports", label: "New import requests", value: imports, path: "/admin/requests?tab=import", attention: imports > 0 },
          { key: "clearing", label: "New clearing requests", value: clearing, path: "/admin/requests?tab=clearing", attention: clearing > 0 },
          { key: "shipments", label: "Shipments in progress", value: open, path: "/admin/shipments" },
          { key: "arriving", label: "Arriving within 7 days", value: arriving, path: "/admin/shipments" },
        ];
      }
      case "finance": {
        const [pendingProofs, mobile, pendingMobile, referrals] = await Promise.all([
          p.paymentSubmission.count({ where: { status: "PENDING" } }),
          p.mobilePayment.aggregate({ where: { status: "success", confirmedAt: { gte: days(30) } }, _sum: { amount: true } }),
          p.mobilePayment.count({ where: { status: "pending", createdAt: { gte: days(2) } } }),
          p.referral.count({ where: { status: "pending" } }),
        ]);
        return [
          { key: "proofs", label: "Payment proofs to approve", value: pendingProofs, path: "/admin/payments", attention: pendingProofs > 0 },
          { key: "mobile", label: "Mobile money, 30 days (MWK)", value: mobile._sum.amount ?? 0, path: "/admin/mobile-payments" },
          { key: "mobilePending", label: "Mobile payments waiting", value: pendingMobile, path: "/admin/mobile-payments" },
          { key: "referrals", label: "Referrals to reward", value: referrals, path: "/admin/referrals", attention: referrals > 0 },
        ];
      }
      case "customers": {
        const [contact, reviews, visitor] = await Promise.all([
          p.contactMessage.count({ where: { status: "new" } }),
          p.review.count({ where: { status: "pending" } }),
          p.visitorSubmission.count({ where: { status: "new" } }),
        ]);
        return [
          { key: "contact", label: "New contact messages", value: contact, path: "/admin/requests?tab=contact", attention: contact > 0 },
          { key: "reviews", label: "Reviews to moderate", value: reviews, path: "/admin/reviews", attention: reviews > 0 },
          { key: "visitor", label: "Questions for us", value: visitor, path: "/admin/lycie", attention: visitor > 0 },
        ];
      }
      case "marketing": {
        const [notices, posts, faq, testimonials] = await Promise.all([
          p.notice.count({ where: PUBLIC.notices }),
          p.blogPost.count({ where: PUBLIC["blog-posts"] }),
          p.faq.count({ where: PUBLIC.faq }),
          p.testimonial.count({ where: PUBLIC.testimonials }),
        ]);
        return [
          { key: "notices", label: "Active notices", value: notices, path: "/admin/notices" },
          { key: "posts", label: "Published blog posts", value: posts, path: "/admin/blog" },
          { key: "faq", label: "Live FAQs", value: faq, path: "/admin/faq" },
          { key: "testimonials", label: "Live testimonials", value: testimonials, path: "/admin/testimonials" },
        ];
      }
      case "ai": {
        const [drafts, ideas, gaps, chats] = await Promise.all([
          p.faqSuggestion.count({ where: { status: "pending" } }),
          p.testimonialIdea.count({ where: { status: "pending" } }),
          p.lycieChatLog.count({ where: { createdAt: { gte: days(7) }, outcome: "no_info" } }),
          p.lycieChatLog.count({ where: { createdAt: { gte: days(7) } } }),
        ]);
        return [
          { key: "chats", label: "Questions answered, 7 days", value: chats, path: "/admin/lycie" },
          { key: "gaps", label: "Couldn't answer, 7 days", value: gaps, path: "/admin/lycie", attention: gaps > 0 },
          { key: "drafts", label: "FAQ drafts", value: drafts, path: "/admin/lycie" },
          { key: "ideas", label: "Testimonial ideas", value: ideas, path: "/admin/lycie" },
        ];
      }
      case "insights": {
        const [views, alerts, saves] = await Promise.all([
          p.vehicleViewStat.aggregate({ where: { day: { gte: days(7) } }, _sum: { views: true } }),
          p.vehicleAlert.count({ where: { isActive: true } }),
          p.savedVehicle.count(),
        ]);
        return [
          { key: "views", label: "Vehicle views, 7 days", value: views._sum.views ?? 0, path: "/admin/insights" },
          { key: "alerts", label: "Customers waiting (alerts)", value: alerts, path: "/admin/insights" },
          { key: "saves", label: "Vehicles saved", value: saves, path: "/admin/insights" },
        ];
      }
      case "hr": {
        const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
        const [staff, pending, away, invites] = await Promise.all([
          p.adminUser.count({ where: { isActive: true } }),
          p.leaveRequest.count({ where: { status: "pending" } }),
          p.leaveRequest.count({ where: { status: "approved", startDate: { lte: today }, endDate: { gte: today } } }),
          p.adminUser.count({ where: { isActive: true, mustChangePassword: true } }),
        ]);
        return [
          { key: "staff", label: "Active staff", value: staff, path: "/admin/people" },
          { key: "leave", label: "Leave to decide", value: pending, path: "/admin/leave", attention: pending > 0 },
          { key: "away", label: "Away today", value: away, path: "/admin/leave" },
          { key: "invites", label: "Invitations not yet accepted", value: invites, path: "/admin/people" },
        ];
      }
      case "system": {
        const [staff, noTwoFactor, actions, inactive] = await Promise.all([
          p.adminUser.count({ where: { isActive: true } }),
          p.adminUser.count({ where: { isActive: true, totpEnabled: false } }),
          p.adminActivity.count({ where: { createdAt: { gte: days(1) } } }),
          p.adminUser.count({ where: { isActive: false } }),
        ]);
        return [
          { key: "staff", label: "Staff accounts", value: staff, path: "/admin/users" },
          { key: "noTwoFactor", label: "Without two-step sign-in", value: noTwoFactor, path: "/admin/users", attention: noTwoFactor > 0 },
          { key: "actions", label: "Changes in 24 hours", value: actions, path: "/admin/activity" },
          { key: "inactive", label: "Deactivated accounts", value: inactive, path: "/admin/users" },
        ];
      }
    }
  }
}
