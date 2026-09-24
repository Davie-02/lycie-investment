/**
 * Logic behind the admin extras: the 'needs your attention' counts and setup warnings,
 * global search (vehicles, hire vehicles, the request types, contact messages, blog
 * posts and FAQ), CSV export of requests and reviews, and the activity log's clean-up (listing and undo live in server/src/undo/).
 */
import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { EmailService } from "../email/email.service";
import { GeminiClient } from "../lycie/gemini.client";
import { UploadsService } from "../uploads/uploads.service";
import { PUBLIC } from "../content-admin/content-state";
import { toCsv } from "./csv.util";
import { atLeast, type AccessMap, type ModuleKey } from "../access/modules";
import { ownerTwoFactorRequired } from "../access/system-admin-policy";

/** Which module each attention item and search group belongs to (people only see what they can open). */
const ATTENTION_MODULE: Record<string, ModuleKey> = {
  inquiries: "sales", import: "imports", clearing: "imports", contact: "customers", hire: "hire", overdue: "hire",
  payments: "finance", reviews: "customers", faq: "ai", testimonials: "ai", visitor: "customers", gaps: "ai", drafts: "sales",
};
const SEARCH_MODULE: Record<string, ModuleKey> = {
  Vehicles: "sales", "Hire vehicles": "hire", "Vehicle inquiries": "sales", "Import requests": "imports", "Clearing requests": "imports",
  Bookings: "hire", "Contact messages": "customers", Blog: "marketing", FAQ: "marketing",
};
const canSee = (access: AccessMap | undefined, module: ModuleKey | undefined) => !access || !module || atLeast(access[module], "view");

export const EXPORT_TYPES = ["inquiries", "import-requests", "clearing-requests", "hire-requests", "contact-messages", "reviews"] as const;
export type ExportType = (typeof EXPORT_TYPES)[number];

export interface SearchHit {
  group: string;
  label: string;
  detail?: string;
  path: string;
}

@Injectable()
export class AdminToolsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly gemini: GeminiClient,
    private readonly uploads: UploadsService
  ) {}

  /** Everything that's waiting on a person, plus setup problems worth fixing. */
  async overview(access?: AccessMap) {
    const now = new Date();
    const since7d = new Date(now.getTime() - 7 * 24 * 60 * 60_000);
    const [
      newInquiries,
      newImports,
      newClearing,
      newContact,
      pendingHire,
      overdueHire,
      pendingPayments,
      pendingReviews,
      faqDrafts,
      testimonialIdeas,
      newVisitorMessages,
      lycieGaps,
      draftVehicles,
    ] = await Promise.all([
      this.prisma.inquiry.count({ where: { status: "new" } }),
      this.prisma.importRequest.count({ where: { status: "new" } }),
      this.prisma.clearingRequest.count({ where: { status: "new" } }),
      this.prisma.contactMessage.count({ where: { status: "new" } }),
      this.prisma.hireRequest.count({ where: { status: "pending" } }),
      this.prisma.hireRequest.count({ where: { status: "confirmed", returnDate: { lt: now } } }),
      this.prisma.paymentSubmission.count({ where: { status: "PENDING" } }),
      this.prisma.review.count({ where: { status: "pending" } }),
      this.prisma.faqSuggestion.count({ where: { status: "pending" } }),
      this.prisma.testimonialIdea.count({ where: { status: "pending" } }),
      this.prisma.visitorSubmission.count({ where: { status: "new" } }),
      this.prisma.lycieChatLog.count({ where: { createdAt: { gte: since7d }, outcome: "no_info" } }),
      this.prisma.vehicle.count({ where: { isPublished: false, archivedAt: null } }),
    ]);

    return {
      attention: [
        { key: "inquiries", label: "New vehicle inquiries", count: newInquiries, path: "/admin/requests" },
        { key: "import", label: "New import requests", count: newImports, path: "/admin/requests" },
        { key: "clearing", label: "New clearing requests", count: newClearing, path: "/admin/requests" },
        { key: "contact", label: "New contact messages", count: newContact, path: "/admin/requests" },
        { key: "hire", label: "Hire requests to review", count: pendingHire, path: "/admin/bookings" },
        { key: "overdue", label: "Overdue vehicle returns", count: overdueHire, path: "/admin/bookings", urgent: true },
        { key: "payments", label: "Payments to approve", count: pendingPayments, path: "/admin/payments" },
        { key: "reviews", label: "Reviews to moderate", count: pendingReviews, path: "/admin/reviews" },
        { key: "faq", label: "FAQ drafts to review", count: faqDrafts, path: "/admin/lycie" },
        { key: "testimonials", label: "Testimonial ideas", count: testimonialIdeas, path: "/admin/lycie" },
        { key: "visitor", label: "New visitor messages", count: newVisitorMessages, path: "/admin/lycie" },
        { key: "gaps", label: "Questions Lycie couldn't answer (7 days)", count: lycieGaps, path: "/admin/lycie" },
        { key: "drafts", label: "Vehicles saved as drafts", count: draftVehicles, path: "/admin/vehicles" },
      ].filter((item) => item.count > 0 && canSee(access, ATTENTION_MODULE[item.key])),
      setup: [
        ...(this.email.isConfigured
          ? []
          : [{ key: "email", severity: "warning", text: "Email isn't set up, so password resets, booking confirmations and emails to customers can't be delivered." }]),
        ...(this.gemini.isConfigured ? [] : [{ key: "ai", severity: "info", text: "Lycie's AI key isn't set, so the chat assistant and AI writer are switched off." }]),
        ...(process.env.NODE_ENV === "production" && !this.uploads.isUsingObjectStorage
          ? [{ key: "storage", severity: "warning", text: "Images are stored on the server's own disk and will be lost on the next restart. Set up image storage." }]
          : []),
      ],
    };
  }

  async search(q: string, access?: AccessMap): Promise<SearchHit[]> {
    return (await this.searchAll(q)).filter((hit) => canSee(access, SEARCH_MODULE[hit.group]));
  }

  private async searchAll(q: string): Promise<SearchHit[]> {
    const term = q.trim();
    if (term.length < 2) return [];
    const like = { contains: term, mode: "insensitive" as const };
    const person = { OR: [{ fullName: like }, { email: like }, { phone: like }] };
    const [vehicles, hireVehicles, inquiries, imports, clearing, hires, contacts, posts, faqs] = await Promise.all([
      this.prisma.vehicle.findMany({ where: { OR: [{ make: like }, { model: like }, { slug: like }] }, take: 5, select: { make: true, model: true, year: true, status: true, archivedAt: true } }),
      this.prisma.hireVehicle.findMany({ where: { name: like }, take: 5, select: { name: true } }),
      this.prisma.inquiry.findMany({ where: person, take: 5, orderBy: { createdAt: "desc" }, select: { fullName: true, email: true } }),
      this.prisma.importRequest.findMany({ where: person, take: 5, orderBy: { createdAt: "desc" }, select: { fullName: true, preferredMake: true } }),
      this.prisma.clearingRequest.findMany({ where: person, take: 5, orderBy: { createdAt: "desc" }, select: { fullName: true, vehicleMake: true } }),
      this.prisma.hireRequest.findMany({ where: person, take: 5, orderBy: { createdAt: "desc" }, select: { id: true, fullName: true, status: true, vehicle: { select: { name: true } } } }),
      this.prisma.contactMessage.findMany({ where: { OR: [{ fullName: like }, { email: like }, { subject: like }] }, take: 5, orderBy: { createdAt: "desc" }, select: { fullName: true, subject: true } }),
      this.prisma.blogPost.findMany({ where: { OR: [{ title: like }, { slug: like }] }, take: 4, select: { title: true } }),
      this.prisma.faq.findMany({ where: { question: like }, take: 4, select: { question: true } }),
    ]);

    return [
      ...vehicles.map((v) => ({ group: "Vehicles", label: `${v.make} ${v.model} (${v.year})`, detail: v.archivedAt ? "archived" : v.status, path: `/admin/vehicles?q=${encodeURIComponent(`${v.make} ${v.model}`)}` })),
      ...hireVehicles.map((v) => ({ group: "Hire vehicles", label: v.name, path: `/admin/hire-vehicles?q=${encodeURIComponent(v.name)}` })),
      ...inquiries.map((r) => ({ group: "Vehicle inquiries", label: r.fullName, detail: r.email, path: `/admin/requests?tab=inquiries&q=${encodeURIComponent(r.fullName)}` })),
      ...imports.map((r) => ({ group: "Import requests", label: r.fullName, detail: r.preferredMake, path: `/admin/requests?tab=import&q=${encodeURIComponent(r.fullName)}` })),
      ...clearing.map((r) => ({ group: "Clearing requests", label: r.fullName, detail: r.vehicleMake, path: `/admin/requests?tab=clearing&q=${encodeURIComponent(r.fullName)}` })),
      ...hires.map((r) => ({ group: "Bookings", label: r.fullName, detail: `${r.vehicle.name} · ${r.status}`, path: `/admin/bookings/${r.id}` })),
      ...contacts.map((r) => ({ group: "Contact messages", label: r.fullName, detail: r.subject, path: `/admin/requests?tab=contact&q=${encodeURIComponent(r.fullName)}` })),
      ...posts.map((p) => ({ group: "Blog", label: p.title, path: `/admin/blog?q=${encodeURIComponent(p.title)}` })),
      ...faqs.map((f) => ({ group: "FAQ", label: f.question, path: `/admin/faq?q=${encodeURIComponent(f.question.slice(0, 40))}` })),
    ];
  }

  async exportCsv(type: ExportType): Promise<{ filename: string; csv: string }> {
    const stamp = new Date().toISOString().slice(0, 10);
    const take = 10_000;
    switch (type) {
      case "inquiries": {
        const rows = await this.prisma.inquiry.findMany({ orderBy: { createdAt: "desc" }, take, include: { vehicle: { select: { make: true, model: true, year: true } } } });
        return { filename: `inquiries-${stamp}.csv`, csv: toCsv(["Date", "Name", "Phone", "Email", "Vehicle", "Message", "Status", "Preferred contact"], rows.map((r) => [r.createdAt, r.fullName, r.phone, r.email, r.vehicle ? `${r.vehicle.make} ${r.vehicle.model} ${r.vehicle.year}` : "", r.message, r.status, r.preferredContact])) };
      }
      case "import-requests": {
        const rows = await this.prisma.importRequest.findMany({ orderBy: { createdAt: "desc" }, take });
        return { filename: `import-requests-${stamp}.csv`, csv: toCsv(["Date", "Name", "Phone", "Email", "Make", "Model", "Year", "Budget", "Fuel", "Transmission", "Country", "Notes", "Status", "Preferred contact"], rows.map((r) => [r.createdAt, r.fullName, r.phone, r.email, r.preferredMake, r.preferredModel, r.preferredYear, r.budget, r.fuelType, r.transmission, r.preferredSourceCountry, r.additionalRequirements, r.status, r.preferredContact])) };
      }
      case "clearing-requests": {
        const rows = await this.prisma.clearingRequest.findMany({ orderBy: { createdAt: "desc" }, take });
        return { filename: `clearing-requests-${stamp}.csv`, csv: toCsv(["Date", "Name", "Phone", "Email", "Make", "Model", "Year", "VIN", "Location", "Port/border", "Expected arrival", "Documents", "Notes", "Status", "Preferred contact"], rows.map((r) => [r.createdAt, r.fullName, r.phone, r.email, r.vehicleMake, r.vehicleModel, r.year, r.vin, r.currentLocation, r.arrivalPortOrBorder, r.expectedArrivalDate, r.availableDocuments, r.additionalInformation, r.status, r.preferredContact])) };
      }
      case "hire-requests": {
        const rows = await this.prisma.hireRequest.findMany({ orderBy: { createdAt: "desc" }, take, include: { vehicle: { select: { name: true } } } });
        return { filename: `hire-requests-${stamp}.csv`, csv: toCsv(["Submitted", "Name", "Phone", "Email", "Vehicle", "Pickup", "Return", "Days", "Total", "Currency", "Pickup location", "Status", "Preferred contact"], rows.map((r) => [r.createdAt, r.fullName, r.phone, r.email, r.vehicle.name, r.pickupDate, r.returnDate, r.days, r.totalCost, r.currency, r.pickupLocation, r.status, r.preferredContact])) };
      }
      case "contact-messages": {
        const rows = await this.prisma.contactMessage.findMany({ orderBy: { createdAt: "desc" }, take });
        return { filename: `contact-messages-${stamp}.csv`, csv: toCsv(["Date", "Name", "Email", "Phone", "Subject", "Message", "Status", "Preferred contact"], rows.map((r) => [r.createdAt, r.fullName, r.email, r.phone, r.subject, r.message, r.status, r.preferredContact])) };
      }
      case "reviews": {
        const rows = await this.prisma.review.findMany({ orderBy: { createdAt: "desc" }, take, include: { vehicle: { select: { make: true, model: true, year: true } } } });
        return { filename: `reviews-${stamp}.csv`, csv: toCsv(["Date", "Author", "Rating", "Comment", "About", "Status", "Sentiment"], rows.map((r) => [r.createdAt, r.authorName, r.rating, r.comment, r.vehicle ? `${r.vehicle.make} ${r.vehicle.model} ${r.vehicle.year}` : "Company", r.status, r.sentiment])) };
      }
    }
  }

  async purgeOldActivity(days = 180): Promise<number> {
    const result = await this.prisma.adminActivity.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - days * 24 * 60 * 60_000) } } });
    return result.count;
  }

  async systemStatus() {
    const [admins, adminsWithout2fa, staffWithout2fa] = await Promise.all([
      this.prisma.adminUser.count({ where: { role: "OWNER", isActive: true } }),
      this.prisma.adminUser.count({ where: { role: "OWNER", isActive: true, totpEnabled: false } }),
      this.prisma.adminUser.count({ where: { role: { not: "OWNER" }, isActive: true, totpEnabled: false } }),
    ]);
    const on = (value: string | undefined) => Boolean(value && value.trim());
    return {
      security: {
        adminTwoFactorRequired: ownerTwoFactorRequired(),
        adminIpAllowlist: on(process.env.SYSTEM_ADMIN_ALLOWED_IPS),
        admins,
        adminsWithout2fa,
        staffWithout2fa,
        sessionHours: process.env.JWT_EXPIRES_IN || "2h",
      },
      services: {
        email: this.email.isConfigured,
        emailVerification: on(process.env.EMAIL_VERIFICATION_PROVIDER) && on(process.env.EMAIL_VERIFICATION_API_KEY),
        whatsapp: on(process.env.WHATSAPP_PHONE_NUMBER_ID) && on(process.env.WHATSAPP_ACCESS_TOKEN) && on(process.env.WHATSAPP_TEMPLATE_NAME),
        mobileMoney: on(process.env.PAYCHANGU_SECRET_KEY),
        mobileMoneyWebhook: on(process.env.PAYCHANGU_WEBHOOK_SECRET),
        ai: this.gemini.isConfigured,
        imageStorage: this.uploads.isUsingObjectStorage,
        googleSignIn: on(process.env.GOOGLE_CLIENT_ID),
        facebookSignIn: on(process.env.FACEBOOK_APP_ID),
      },
    };
  }

  /** Public counts used by the sidebar badge (cheap, no personal data). */
  async badgeCount(): Promise<number> {
    const o = await this.overview();
    return o.attention.reduce((sum, item) => sum + item.count, 0);
  }

  ensureType(type: string): ExportType {
    if (!EXPORT_TYPES.includes(type as ExportType)) throw new NotFoundException("Unknown export.");
    return type as ExportType;
  }
}
