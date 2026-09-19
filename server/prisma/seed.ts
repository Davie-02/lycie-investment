import "dotenv/config";
import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Creates the first admin account (role: OWNER) from environment variables,
 * but only if no admin users exist yet — safe to run repeatedly. This is
 * how you bootstrap into the multi-user admin system: after the first
 * Owner logs in, they create further accounts (Manager/Viewer) through the
 * admin UI itself rather than through env vars or the seed script again.
 */
async function seedAdminUser() {
  const existingCount = await prisma.adminUser.count();
  if (existingCount > 0) {
    console.log("Admin users already exist — skipping bootstrap.");
    return;
  }

  const email = process.env.ADMIN_EMAIL;
  const passwordHash = process.env.ADMIN_PASSWORD_HASH;
  const name = process.env.ADMIN_NAME || "Admin";

  if (!email || !passwordHash) {
    console.warn(
      "ADMIN_EMAIL and ADMIN_PASSWORD_HASH are not set — no admin account was created. " +
        "Set them in .env and re-run `npm run prisma:seed` to bootstrap your first login."
    );
    return;
  }

  await prisma.adminUser.create({
    data: { name, email, passwordHash, role: "OWNER" },
  });
  console.log(`Created initial Owner account for ${email}.`);
}

/**
 * SAMPLE DATA — mirrors what was previously hardcoded in the frontend at
 * src/data/vehicles.ts, now seeded into the database instead. Replace with
 * real inventory whenever it's available; this seed is only meant to give
 * the site something to display during development.
 */
/**
 * Default content for the editable site sections (contact info, social
 * links, About copy). Uses upsert-with-empty-update, so this only ever
 * CREATES a section if it's missing — re-running the seed never overwrites
 * content an admin has already edited through the dashboard.
 */
async function seedSiteContent() {
  const defaults: Array<{ key: string; value: Prisma.InputJsonValue }> = [
    {
      key: "contact",
      value: {
        phone: "Contact our team for current details",
        email: "hello@lycieinvestment.com",
        address: "Lilongwe, Malawi",
        businessHours: "Monday – Friday, 8:00 – 17:00",
        whatsappNumber: null,
      },
    },
    {
      key: "social",
      value: { facebook: null, instagram: null, twitter: null, linkedin: null },
    },
    {
      key: "about",
      value: {
        intro:
          "Lycie Investments sources, imports, sells, hires and clears vehicles for customers who'd rather deal with one company than coordinate several.",
        whatWeDo:
          "We work across the full vehicle journey — sourcing a vehicle that matches what a customer needs, arranging the import, coordinating clearing once it arrives, and offering vehicles directly for sale or hire. Rather than handing customers off between separate agents, we stay involved from request to delivery.",
        howWeWork:
          "We ask what a customer actually needs — budget, timeline, intended use — and communicate clearly at each stage, from the first request through delivery or handover.",
        whyChooseUs:
          "Reliable sourcing, import assistance, clearing support and flexible hire — handled by one team who can answer questions across the whole process rather than pointing you elsewhere.",
      },
    },
    {
      key: "seo",
      value: {
        siteName: "Lycie Investments",
        defaultDescription:
          "Lycie Investments sources, imports, sells, hires and clears vehicles for customers in Malawi.",
        facebookAppId: null,
      },
    },
    {
      key: "hero",
      value: {
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
    },
    {
      key: "services",
      value: {
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
            description:
              "Browse quality vehicles ready for sale, inspected and listed with real specifications.",
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
    },
    {
      key: "journey",
      value: {
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
    },
    {
      key: "whyChooseUs",
      value: {
        eyebrow: "Why Lycie Investments",
        heading: "What working with us looks like",
        items: [
          { title: "One point of contact", detail: "Sourcing, import, clearing and delivery under one company." },
          {
            title: "Clear communication",
            detail: "Updates at each stage, not silence between order and delivery.",
          },
          { title: "Flexible vehicle hire", detail: "Short-term and long-term hire alongside dealership sales." },
          {
            title: "Documentation support",
            detail: "Help preparing and coordinating the paperwork your vehicle needs.",
          },
        ],
      },
    },
    {
      key: "importPage",
      value: {
        heading: "We source and import the vehicle you actually want",
        body:
          "Tell us the make, model and budget you're working with. We handle sourcing, import arrangements, and coordinate clearing once it arrives.",
      },
    },
    {
      key: "clearingPage",
      value: {
        heading: "Clearing support once your vehicle arrives",
        body:
          "We assist with vehicle clearing, documentation, and coordination through the clearance and delivery process.",
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
    },
    {
      key: "hirePage",
      value: {
        heading: "Vehicles ready for hire",
        body: "Short-term and long-term hire for individuals and businesses.",
      },
    },
  ];

  for (const section of defaults) {
    await prisma.siteContent.upsert({
      where: { key: section.key },
      update: {},
      create: { key: section.key, value: section.value },
    });
  }
  console.log("Site content defaults ensured (existing edits, if any, were left untouched).");
}

async function main() {
  await seedAdminUser();
  await seedSiteContent();
  await prisma.vehicle.createMany({
    data: [
      {
        slug: "toyota-hilux-2022",
        make: "Toyota",
        model: "Hilux",
        year: 2022,
        price: 45000000,
        currency: "MWK",
        mileageKm: 32000,
        fuelType: "Diesel",
        transmission: "Automatic",
        bodyType: "Pickup",
        engine: "2.8L Turbo Diesel",
        driveType: "4WD",
        condition: "Used — excellent",
        location: "Lilongwe, Malawi",
        status: "available",
        description:
          "A well-maintained Hilux double cab, sourced and inspected for reliability on both city and rural roads. Full service history available on request.",
        features: ["4WD", "Reverse camera", "Air conditioning", "Alloy wheels", "Tow bar"],
        images: [
          "https://placehold.co/900x600/16233a/fafaf8?text=Toyota+Hilux+2022",
          "https://placehold.co/900x600/e3e2dd/16233a?text=Interior",
          "https://placehold.co/900x600/e3e2dd/16233a?text=Rear+View",
        ],
      },
      {
        slug: "toyota-corolla-2021",
        make: "Toyota",
        model: "Corolla",
        year: 2021,
        price: 18500000,
        currency: "MWK",
        mileageKm: 41000,
        fuelType: "Petrol",
        transmission: "Automatic",
        bodyType: "Sedan",
        engine: "1.8L",
        driveType: "FWD",
        condition: "Used — good",
        location: "Blantyre, Malawi",
        status: "available",
        description:
          "A dependable, fuel-efficient sedan suited to daily commuting and business use. Clean interior, no mechanical issues at time of listing.",
        features: ["Air conditioning", "Bluetooth audio", "Power windows", "Alloy wheels"],
        images: [
          "https://placehold.co/900x600/16233a/fafaf8?text=Toyota+Corolla+2021",
          "https://placehold.co/900x600/e3e2dd/16233a?text=Interior",
        ],
      },
      {
        slug: "isuzu-dmax-2023",
        make: "Isuzu",
        model: "D-Max",
        year: 2023,
        price: 52000000,
        currency: "MWK",
        mileageKm: 12000,
        fuelType: "Diesel",
        transmission: "Manual",
        bodyType: "Pickup",
        engine: "3.0L Turbo Diesel",
        driveType: "4WD",
        condition: "Used — excellent",
        location: "Lilongwe, Malawi",
        status: "reserved",
        description:
          "Low-mileage D-Max with strong towing capacity, well suited to commercial and farm use.",
        features: ["4WD", "Tow bar", "Load liner", "Air conditioning"],
        images: ["https://placehold.co/900x600/16233a/fafaf8?text=Isuzu+D-Max+2023"],
      },
      {
        slug: "honda-fit-2020",
        make: "Honda",
        model: "Fit",
        year: 2020,
        price: 12800000,
        currency: "MWK",
        mileageKm: 55000,
        fuelType: "Petrol",
        transmission: "Automatic",
        bodyType: "Hatchback",
        engine: "1.5L",
        driveType: "FWD",
        condition: "Used — good",
        location: "Lilongwe, Malawi",
        status: "available",
        description:
          "Compact and economical, well suited to city driving. Popular first-import choice for individual buyers.",
        features: ["Air conditioning", "Power steering", "Radio/USB"],
        images: ["https://placehold.co/900x600/16233a/fafaf8?text=Honda+Fit+2020"],
      },
    ],
    skipDuplicates: true,
  });

  await prisma.hireVehicle.createMany({
    data: [
      {
        slug: "toyota-corolla-hire",
        name: "Toyota Corolla",
        dailyRate: 45000,
        weeklyRate: 270000,
        currency: "MWK",
        transmission: "Automatic",
        fuelType: "Petrol",
        seats: 5,
        available: true,
        image: "https://placehold.co/700x467/16233a/fafaf8?text=Toyota+Corolla",
      },
      {
        slug: "toyota-hiace-hire",
        name: "Toyota Hiace",
        dailyRate: 90000,
        weeklyRate: 560000,
        currency: "MWK",
        transmission: "Manual",
        fuelType: "Diesel",
        seats: 14,
        available: true,
        image: "https://placehold.co/700x467/16233a/fafaf8?text=Toyota+Hiace",
      },
      {
        slug: "toyota-hilux-hire",
        name: "Toyota Hilux",
        dailyRate: 75000,
        currency: "MWK",
        transmission: "Automatic",
        fuelType: "Diesel",
        seats: 5,
        available: false,
        image: "https://placehold.co/700x467/16233a/fafaf8?text=Toyota+Hilux",
      },
    ],
    skipDuplicates: true,
  });

  console.log("Seed complete.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
