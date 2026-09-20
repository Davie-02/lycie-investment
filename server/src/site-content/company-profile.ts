/**
 * The company's own business profile, turned into website content. It is the
 * starting point loaded by the admin's "Load company profile" button (Owner
 * only); every section stays fully editable afterwards under Site Content.
 *
 * Only what the profile states is used — no invented figures. Loading it
 * REPLACES the fields it defines (About, Services, Contact details, Team,
 * Clients, Fleet…) but keeps any other fields already saved in those sections
 * (business hours, WhatsApp number, social links).
 */
export const COMPANY_PROFILE: Record<string, Record<string, unknown>> = {
  company: {
    name: "Lycie Investments and Transportation",
    established: 2016,
    tagline: "Safe, reliable and efficient transportation — and the vehicles to match.",
    story: [
      "Established in 2016, Lycie Investments and Transportation is a fully registered, customer-focused company dedicated to delivering safe, reliable and efficient transportation solutions.",
      "Our purpose is to connect people and communities through high-quality, well-maintained vehicles, while upholding the highest standards of professionalism, safety and environmental responsibility.",
    ],
    vision:
      "To be the leading provider of safe, reliable and innovative transportation solutions, fostering seamless mobility while promoting sustainability and community connectivity.",
    mission: "Our mission is to:",
    missionPoints: [
      "Provide efficient and customer-centric vehicle hire and transport services.",
      "Ensure the safety, comfort and reliability of every journey.",
      "Embrace eco-friendly practices to support a greener future.",
      "Continuously innovate and expand our services to meet evolving mobility needs.",
      "Build lasting relationships by exceeding customer expectations.",
    ],
    values: [
      { title: "Safety", detail: "The safety and comfort of every journey comes first." },
      { title: "Reliability", detail: "Well-maintained vehicles and professional drivers, on time." },
      { title: "Professionalism", detail: "Clear, honest service from a fully registered company." },
      { title: "Sustainability", detail: "Eco-friendly practices that support a greener future." },
    ],
  },
  about: {
    intro:
      "Established in 2016, Lycie Investments and Transportation is a fully registered, customer-focused company delivering safe, reliable and efficient transportation solutions — from vehicle imports and clearing to hire and transport.",
    whatWeDo:
      "We source, ship and clear vehicles from international markets; hire out vehicles with or without a driver; and provide transport for people and goods — for personal use, corporate travel, logistics and special events. Our team handles the paperwork, customs procedures and logistics so you don't have to.",
    howWeWork:
      "We ask what a customer actually needs — budget, timeline and intended use — and communicate clearly at each stage, from the first request through delivery or handover.",
    whyChooseUs:
      "A fully registered company established in 2016, with well-maintained vehicles, professional drivers and one team that can answer questions across the whole process.",
  },
  services: {
    eyebrow: "What we do",
    heading: "Import, hire, transport and clearing — one trusted company",
    body: "Whether you need a vehicle for personal use, corporate travel, logistics or a special event, we've got you covered with top-tier service and professionalism.",
    items: [
      {
        title: "Vehicle Importing",
        description:
          "We specialise in sourcing and shipping vehicles from international markets, with a smooth and transparent process from request to arrival.",
      },
      {
        title: "Vehicle Dealership",
        description: "Browse quality vehicles ready for sale, inspected and listed with real specifications.",
      },
      {
        title: "Vehicle Hire",
        description:
          "Self-drive and chauffeur-driven options, with flexible short- and long-term rentals for personal use, business and special events like weddings and conferences.",
      },
      {
        title: "Vehicle Clearing",
        description:
          "Our team handles the paperwork, customs procedures and logistics, so your vehicle arrives safely, legally and on time.",
      },
      {
        title: "Transportation Services",
        description:
          "Safe, reliable transport for personal, corporate and logistics needs — point-to-point travel, shuttle services and goods transportation with well-maintained vehicles and professional drivers.",
      },
    ],
  },
  hero: {
    body: "Lycie Investments sources, imports, sells, hires and clears vehicles — and moves people and goods safely with well-maintained vehicles and professional drivers.",
  },
  team: {
    eyebrow: "Our team",
    heading: "The people behind every journey",
    body: "A dedicated management team and experienced drivers, committed to safe, reliable and professional service.",
    groups: [
      { title: "Leadership", members: [{ name: "Talimba Mhango", role: "Managing Director" }] },
      {
        title: "Management & administration",
        members: [
          { name: "Edgarnt Mbowe", role: "Logistics Officer" },
          { name: "Smith Nthakomwa", role: "Secretary" },
          { name: "Mustapha Makokola", role: "ICT Officer" },
        ],
      },
      {
        title: "Drivers",
        members: [
          { name: "Douglas Chibesakunda", role: "Driver" },
          { name: "Crossland Banda", role: "Driver" },
          { name: "Chikumbutso Manda", role: "Driver" },
          { name: "Benson Mhango", role: "Driver" },
        ],
      },
    ],
  },
  clients: {
    eyebrow: "Who we serve",
    heading: "Trusted by schools, hospitals and government offices",
    body: "We serve a diverse and growing clientele with customised, high-quality and efficient solutions — for personal, corporate and commercial needs.",
    items: [
      {
        title: "Educational institutions",
        detail:
          "We supply high-quality maize to schools such as Chaminade Secondary School and Karonga Teacher Training College (TTC), supporting a stable food supply for students and staff.",
      },
      {
        title: "Healthcare facilities",
        detail:
          "We provide maize supplies to Karonga District Hospital, contributing to the food needs of patients and healthcare staff. Timely delivery helps maintain essential nutritional support.",
      },
      {
        title: "Government offices",
        detail:
          "Alongside food supplies, we supply office materials to Karonga District Council, equipping them with the resources needed for smooth administrative operations.",
      },
    ],
  },
  fleet: {
    eyebrow: "Our fleet",
    heading: "Vehicles that keep you moving",
    body: "A working fleet of light trucks, pickups and flatbeds, all carrying the Lycie branding.",
    items: [
      { title: "Light truck", caption: "Mitsubishi Canter-style" },
      { title: "Pickup truck", caption: "" },
      { title: "Light-duty truck", caption: "Nissan" },
      { title: "Flatbed truck", caption: "White, light-duty" },
      { title: "Large flatbed truck", caption: "" },
      { title: "White pickup truck", caption: "" },
    ],
  },
  contact: {
    phone: "+265 999 074 038 / +265 888 074 038",
    email: "talimbamhangoll@gmail.com",
    address: "P.O. Box 440, Karonga, Malawi",
  },
  seo: {
    defaultDescription:
      "Lycie Investments and Transportation — vehicle imports and clearing, vehicle hire, and safe, reliable transport services in Karonga, Malawi.",
  },
};
