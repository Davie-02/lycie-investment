/**
 * Central place for content that isn't vehicle data but still varies by
 * deployment — contact details, hours, and About page copy. Edit this file
 * and redeploy; no other code needs to change.
 *
 * Anything still marked "placeholder" below should be replaced with real,
 * verified information before this goes live — see Section 21/23 of the
 * project brief ("do not invent contact information").
 */
export const siteConfig = {
  companyName: "Lycie Investment",

  contact: {
    phone: "+265 000 000 000", // placeholder — replace with a verified number
    email: "info@lycieinvestment.com", // placeholder — replace with a verified address
    address: "Lilongwe, Malawi", // placeholder — replace with the real address
    businessHours: "Monday – Friday, 8:00 – 17:00",
    whatsappNumber: null as string | null, // set to a verified WhatsApp number to show the WhatsApp CTA on /contact
  },

  social: {
    // Only populated links render on the site. Leave a field null/omitted
    // until there's a real account to point to — see Section 23 of the brief.
    facebook: null as string | null,
    instagram: null as string | null,
    twitter: null as string | null,
    linkedin: null as string | null,
  },

  about: {
    intro:
      "Lycie Investment sources, imports, sells, hires and clears vehicles for customers who'd rather deal with one company than coordinate several.",
    whatWeDo:
      "We work across the full vehicle journey — sourcing a vehicle that matches what a customer needs, arranging the import, coordinating clearing once it arrives, and offering vehicles directly for sale or hire. Rather than handing customers off between separate agents, we stay involved from request to delivery.",
    howWeWork:
      "We ask what a customer actually needs — budget, timeline, intended use — and communicate clearly at each stage rather than leaving customers to guess where things stand. Specific figures on experience, inventory size, or partnerships will be added here once confirmed by the company.",
    whyChooseUs:
      "Reliable sourcing, import assistance, clearing support and flexible hire — handled by one team who can answer questions across the whole process rather than pointing you elsewhere.",
  },
};

export type SiteConfig = typeof siteConfig;
