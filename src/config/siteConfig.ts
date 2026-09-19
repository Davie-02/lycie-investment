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
      "Lycie Investments sources, imports, sells, hires and clears vehicles for customers who'd rather deal with one company than coordinate several.",
    whatWeDo:
      "We work across the full vehicle journey — sourcing a vehicle that matches what a customer needs, arranging the import, coordinating clearing once it arrives, and offering vehicles directly for sale or hire. Rather than handing customers off between separate agents, we stay involved from request to delivery.",
    howWeWork:
      "We ask what a customer actually needs — budget, timeline, intended use — and communicate clearly at each stage, from the first request through delivery or handover.",
    whyChooseUs:
      "Reliable sourcing, import assistance, clearing support and flexible hire — handled by one team who can answer questions across the whole process rather than pointing you elsewhere.",
  },
  seo: {
    siteName: "Lycie Investments",
    defaultDescription:
      "Lycie Investments sources, imports, sells, hires and clears vehicles for customers in Malawi.",
    facebookAppId: null,
  },
  hero: {
    eyebrow: "Source · Import · Clear · Deliver",
    heading: "From order to your driveway, one company handles the whole journey.",
    body:
      "Lycie Investments sources, imports, sells, hires and clears vehicles for customers who want one point of contact from request to delivery — not four separate agents to chase.",
    primaryCtaLabel: "Browse Vehicles",
    secondaryCtaLabel: "Request a Vehicle",
    highlights: [
      {
        label: "Sourcing completed",
        title: "Toyota Hilux, 2022",
        detail: "Matched to a customer's work and travel requirements.",
        origin: "Japan",
        destination: "Lilongwe, Malawi",
      },
      {
        label: "Import coordinated",
        title: "Honda Fit, 2020",
        detail: "Sourcing, shipping documentation, and arrival coordination handled by one team.",
        origin: "Japan",
        destination: "Blantyre, Malawi",
      },
      {
        label: "Hire delivered",
        title: "Toyota Corolla",
        detail: "A dependable vehicle prepared and delivered for a business trip.",
        origin: "Lycie fleet",
        destination: "Lilongwe, Malawi",
      },
    ],
  },
  services: {
    eyebrow: "What we do",
    heading: "Four services, one company to deal with",
    body: "Handle sourcing, importing, clearing and hire without coordinating separate providers.",
    items: [
      {
        title: "Vehicle Importing",
        description: "We source and import vehicles from abroad to match what you need.",
      },
      {
        title: "Vehicle Dealership",
        description: "Browse quality vehicles ready for sale, inspected and listed with real specifications.",
      },
      {
        title: "Vehicle Hire",
        description: "Short-term and long-term hire for individuals and businesses.",
      },
      {
        title: "Vehicle Clearing",
        description: "Support with clearing, documentation and logistics once your vehicle arrives.",
      },
    ],
  },
  journey: {
    eyebrow: "How it works",
    heading: "From request to delivery",
    body: "The same process runs behind every import — visible to you at each stage.",
    steps: [
      { title: "Tell us what you need", detail: "Share make, model, budget and timeline." },
      { title: "We source the vehicle", detail: "We find a match against your requirements." },
      { title: "We arrange the import", detail: "Shipping and paperwork are coordinated for you." },
      { title: "Vehicle arrives", detail: "Your vehicle reaches the port or border." },
      { title: "Clearing & documentation", detail: "We assist with clearance and required documents." },
      { title: "Vehicle delivered", detail: "Your vehicle is delivered and ready to drive." },
    ],
  },
  whyChooseUs: {
    eyebrow: "Why Lycie Investments",
    heading: "What working with us looks like",
    items: [
      { title: "One point of contact", detail: "Sourcing, import, clearing and delivery under one company." },
      { title: "Clear communication", detail: "Updates at each stage, not silence between order and delivery." },
      { title: "Flexible vehicle hire", detail: "Short-term and long-term hire alongside dealership sales." },
      {
        title: "Documentation support",
        detail: "Help preparing and coordinating the paperwork your vehicle needs.",
      },
    ],
  },
  importPage: {
    heading: "We source and import the vehicle you actually want",
    body: "Tell us the make, model and budget you're working with. We handle sourcing, import arrangements, and coordinate clearing once it arrives.",
  },
  clearingPage: {
    heading: "Clearing support once your vehicle arrives",
    body: "We assist with vehicle clearing, documentation, and coordination through the clearance and delivery process.",
    disclaimer:
      "Clearance timelines, duty rates and outcomes are determined by customs authorities, not by Lycie Investments. We coordinate and support the process — we can't guarantee government processing times or costs.",
    areas: [
      "Customs clearance coordination",
      "Import documentation",
      "Vehicle processing",
      "Port/border clearance coordination",
      "Customs-related documentation",
      "Payment/document coordination",
      "Vehicle release coordination",
      "Delivery arrangements",
    ],
  },
  hirePage: {
    heading: "Vehicles ready for hire",
    body: "Short-term and long-term hire for individuals and businesses.",
  },
};

// Not stored in the database — this is branding, not editable copy.
export const companyName = "Lycie Investments";
