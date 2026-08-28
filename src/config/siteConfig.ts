import type { SiteContent } from "@/types/siteContent";

/**
 * Fallback content used when the live data from the API isn't available yet
 * (still loading) or the API can't be reached (offline backend, etc.) — see
 * src/context/SiteContentContext.tsx. This keeps the public site rendering
 * something reasonable instead of blank fields even if the database is
 * briefly unreachable.
 *
 * The actual editable copy lives in the database (SiteContent table) and is
 * edited via /admin — these values only matter as a safety net, and as the
 * starting point the seed script (`server/prisma/seed.ts`) creates on a
 * fresh database.
 */
export const DEFAULT_SITE_CONTENT: SiteContent = {
  contact: {
    phone: "Contact our team for current details",
    email: "hello@lycieinvestment.com",
    address: "Lilongwe, Malawi",
    businessHours: "Monday – Friday, 8:00 – 17:00",
    whatsappNumber: null,
  },
  social: {
    facebook: null,
    instagram: null,
    twitter: null,
    linkedin: null,
  },
  about: {
    intro:
      "Lycie Investment sources, imports, sells, hires and clears vehicles for customers who'd rather deal with one company than coordinate several.",
    whatWeDo:
      "We work across the full vehicle journey — sourcing a vehicle that matches what a customer needs, arranging the import, coordinating clearing once it arrives, and offering vehicles directly for sale or hire. Rather than handing customers off between separate agents, we stay involved from request to delivery.",
    howWeWork:
      "We ask what a customer actually needs — budget, timeline, intended use — and communicate clearly at each stage, from the first request through delivery or handover.",
    whyChooseUs:
      "Reliable sourcing, import assistance, clearing support and flexible hire — handled by one team who can answer questions across the whole process rather than pointing you elsewhere.",
  },
};

// Not stored in the database — this is branding, not editable copy.
export const companyName = "Lycie Investment";
