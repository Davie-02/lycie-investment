/**
 * The built-in "About this page" guides for the staff workspace: what each
 * module and page is for, how to use it, and what happens behind the scenes.
 *
 * The main system administrator can rewrite any of them and decide who sees
 * each one (System → Guides); those edits are stored in WorkspaceGuide and
 * take priority. Keys match the page paths in src/admin/modules.ts.
 *
 * `module` is the module a guide belongs to (null = every staff member's own
 * pages). `audience` "admins" marks guides that explain security settings,
 * shown only to system administrators unless they choose otherwise.
 */
import type { ModuleKey } from "../access/modules";

export type GuideAudience = "module" | "admins" | "departments" | "hidden";

export interface GuideDefault {
  key: string;
  module: ModuleKey | null;
  title: string;
  body: string;
  audience: GuideAudience;
}

const g = (key: string, module: ModuleKey | null, title: string, body: string, audience: GuideAudience = "module"): GuideDefault => ({
  key,
  module,
  title,
  body,
  audience,
});

export const GUIDE_DEFAULTS: GuideDefault[] = [
  // ---------------------------------------------------------------- everyone's own pages
  g(
    "page:/admin",
    null,
    "Your dashboard",
    "Shows the key numbers of every department area you can use, with anything that needs attention at the top (highlighted in red). Click a number to go straight to that work. The numbers refresh on their own every few seconds.",
  ),
  g(
    "page:/admin/me",
    null,
    "My work & leave",
    "Your profile, which areas of the workspace you can use and at what level, and your leave. Request leave by choosing the type and dates — weekends aren't counted. You'll get an email when it's approved or declined, and you can cancel a request until it starts.",
  ),
  g("page:/admin/directory", null, "Team directory", "Everyone who works here, grouped by department, with their job title, email and phone. Tap an email or number to contact them."),
  g(
    "page:/admin/security",
    null,
    "My security",
    "Change your password, turn on two-step sign-in (a 6-digit code from an authenticator app on your phone, plus recovery codes in case you lose it), and sign out of every other device. Changing your password also signs out your other devices.",
  ),
  g(
    "page:/admin/activity",
    null,
    "Activity & undo",
    "A record of changes made in the workspace. If you made a mistake, press Undo: everything that change did is put back, including anything deleted along with it. If someone has changed the same thing since, you'll be warned before their work is overwritten. An undo can itself be undone (redo). Emails and social media posts that were already sent can't be recalled.",
  ),

  // ---------------------------------------------------------------- modules
  g("module:sales", "sales", "Sales", "Everything about vehicles for sale: the listings on the website, customers' questions about them, and deals and promotions."),
  g("module:hire", "hire", "Hire & Fleet", "The vehicles we hire out, their photos and rates, and every hire booking from request to return."),
  g("module:imports", "imports", "Imports & Clearing", "New import and clearing requests from the website, and tracking each vehicle from purchase to delivery."),
  g("module:finance", "finance", "Finance", "Money coming in: payment proofs customers upload, mobile money payments, referral rewards, and the exchange rate used to show prices."),
  g("module:customers", "customers", "Customer Care", "Messages from the website's contact form and customer reviews waiting to be approved."),
  g("module:marketing", "marketing", "Marketing & Content", "Everything visitors read on the website: page texts, notices and pop-ups, testimonials, FAQs, blog posts, and posts to our social media pages."),
  g("module:ai", "ai", "Lycie AI", "Lycie is the chat assistant on the website. Here you teach her what she should know, see what customers ask, and review the FAQs and testimonials she drafts."),
  g("module:insights", "insights", "Insights & Market", "What customers want and think: vehicle demand, views and saves, review sentiment, what people are waiting for, and market briefings."),
  g("module:hr", "hr", "People (HR)", "Staff records, invitations for new staff, and leave requests."),
  g("module:system", "system", "System", "Who can use which part of the workspace, website settings, security rules and connected services.", "admins"),

  // ---------------------------------------------------------------- Sales
  g(
    "page:/admin/vehicles",
    "sales",
    "Vehicles for sale",
    "Add a vehicle with its photos, price (in US dollars — the kwacha equivalent is shown automatically) and details. Save it as a draft to finish later, publish it to put it on the website, feature it to show it first, or archive it when sold. Changes appear on the website straight away. Customers who set up a matching alert are emailed when a vehicle is published, and people who saved a vehicle are emailed if its price drops.",
  ),
  g(
    "page:/admin/inquiries",
    "sales",
    "Vehicle inquiries",
    "Questions customers sent about a vehicle. Contact them by WhatsApp, phone or email with the buttons (a polite message is prepared for you), then mark the inquiry Contacted, and Closed once it's resolved.",
  ),
  g(
    "page:/admin/deals",
    "sales",
    "Deals & market",
    "Promotions shown on the website's Deals page. The deals finder searches for current offers you might pass on; review each one, edit it, and publish it when ready. Where a deal was found is never shown to customers.",
  ),

  // ---------------------------------------------------------------- Hire
  g(
    "page:/admin/bookings",
    "hire",
    "Bookings",
    "Hire requests from the website and confirmed hires. Confirm or cancel a request — the customer is told by email (and WhatsApp when set up). A vehicle can't be confirmed for dates that overlap another confirmed booking. Overdue returns are highlighted, and customers get a reminder the day before their return date.",
  ),
  g(
    "page:/admin/hire-vehicles",
    "hire",
    "Hire vehicles",
    "The fleet for hire: photos (the first is the cover), daily and weekly rates, seats and transmission. Turn off 'available' to stop new requests for a vehicle. Customers see booked dates when they choose theirs.",
  ),

  // ---------------------------------------------------------------- Imports
  g(
    "page:/admin/shipments",
    "imports",
    "Shipments",
    "Open a shipment for a customer when their vehicle is bought: the customer is sent a private tracking code straight away. Then post an update each time it reaches a new stage (shipped, at port, at the border, customs, ready…), with a message and photos; the customer is notified every time and can follow it under 'Track my vehicle' in their account (there is no public tracking page).\n\nTracking codes are private. Unless you've been given access to them (the Director and Managers have it), ask the customer for their code and enter it to see their shipment.",
  ),
  g(
    "page:/admin/import-requests",
    "imports",
    "Import & clearing requests",
    "Requests from the website's import and clearing forms. Contact the customer, then mark each one Contacted and Closed. When an import goes ahead, open a shipment for it so the customer can follow it.",
  ),

  // ---------------------------------------------------------------- Finance
  g(
    "page:/admin/payments",
    "finance",
    "Payment proofs",
    "Customers can upload proof of a payment (for example a bank slip). Check it, then approve it — the amount is added to their account balance and recorded in their history — or reject it.",
  ),
  g(
    "page:/admin/mobile-payments",
    "finance",
    "Mobile money",
    "Payments customers made with Airtel Money or TNM Mpamba from their account page. Each one is confirmed with the payment provider before it counts, and paid amounts are added to the customer's balance automatically. If one still shows as waiting, press Check again.",
  ),
  g(
    "page:/admin/referrals",
    "finance",
    "Referrals",
    "Customers share a personal link to invite friends. When a friend who joined that way has done business with us, reward the customer who invited them: the amount is added to their account balance. Each referral can only be rewarded once.",
  ),
  g(
    "page:/admin/pricing",
    "finance",
    "Prices & currency",
    "Prices are kept in US dollars and shown with the kwacha equivalent. Choose a live exchange rate or set your own, add a margin, and choose how kwacha amounts are rounded.",
  ),

  // ---------------------------------------------------------------- Customer care
  g(
    "page:/admin/messages",
    "customers",
    "Contact messages",
    "Messages sent through the website's contact form. Reply by the customer's preferred channel with the buttons, then mark each message Contacted and Closed.",
  ),
  g(
    "page:/admin/shipment-lookup",
    "customers",
    "Look up a shipment",
    "When a customer asks about their imported vehicle, ask for their tracking code (it looks like LYC-7K2M9Q) and enter it here to see where it is, the latest updates and photos. Check the customer's name matches before sharing details.",
  ),
  g(
    "page:/admin/reviews",
    "customers",
    "Reviews",
    "Customer reviews wait here until approved. Each shows whether it reads positive, neutral or negative. Approved reviews appear on the website at once.",
  ),

  // ---------------------------------------------------------------- Marketing
  g(
    "page:/admin/site-content",
    "marketing",
    "Website content",
    "Every text and section of the website: the home page, services, contact details, footer, the about page, team and more, plus the website's colour theme. Saving updates the website for every visitor straight away.",
  ),
  g("page:/admin/notices", "marketing", "Notices", "Banners and pop-ups on the website (announcements, offers, warnings). Choose where and when they show."),
  g("page:/admin/testimonials", "marketing", "Testimonials", "Customer quotes shown on the website. Publish, unpublish, feature, archive or duplicate them."),
  g("page:/admin/faq", "marketing", "FAQ", "Questions and answers shown on the website. Lycie also uses every live FAQ when answering customers."),
  g("page:/admin/blog", "marketing", "Blog", "Articles on the website's blog. Save as a draft, then publish. The AI writing assistant can help draft or polish text."),
  g(
    "page:/admin/social",
    "marketing",
    "Social media",
    "Write a post once and send it to our Facebook and Instagram pages now or at a set time, and reply to comments and messages. Posts that have gone out must be removed on Facebook or Instagram themselves.",
  ),

  // ---------------------------------------------------------------- AI, insights
  g(
    "page:/admin/lycie",
    "ai",
    "Lycie AI",
    "Teach Lycie with short notes or by uploading documents (policies, price lists). See the questions she couldn't answer, and review the FAQs and testimonials she drafts from customer conversations before anything is published.",
  ),
  g(
    "page:/admin/insights",
    "insights",
    "Insights",
    "Which vehicles people view, save and ask about; what customers say in reviews; what they're waiting for (vehicle alerts, with their budgets); and suggested next steps.",
  ),

  // ---------------------------------------------------------------- HR
  g(
    "page:/admin/people",
    "hr",
    "Staff",
    "Invite a new colleague with their name, email, department and job title. They receive an email with a one-time password and must choose their own the first time they sign in; the invitation expires after 72 hours and can be re-sent. You can update profiles and deactivate people who have left. Only system administrators can change what someone may access.",
  ),
  g(
    "page:/admin/leave",
    "hr",
    "Leave",
    "All leave requests. Approve or decline pending ones (not your own) — the employee is emailed the decision, with your note when you decline. See who's away today at the top.",
  ),

  // ---------------------------------------------------------------- System (security details: administrators only by default)
  g(
    "page:/admin/users",
    "system",
    "Staff & access",
    "Each department has default access to the areas of the workspace; here you can extend or limit any person's access module by module (No access, View, Edit or Manage — Manage adds exports and sensitive tools). Changes apply on the person's next click. Adding an administrator, changing access or roles, deleting an account or resetting someone's two-step sign-in asks you to confirm your identity first. The last active administrator can't be removed.",
    "admins",
  ),
  g(
    "page:/admin/system",
    "system",
    "Settings & status",
    "Website settings (such as whether visitors may switch language), the security rules in force — administrators must use two-step sign-in, may be limited to listed networks, sign in only through their own sign-in page, are signed out after 3 minutes idle, and every sign-in is emailed to the account owner — and which outside services (email, WhatsApp, mobile money, AI, image storage) are connected.",
    "admins",
  ),
  g(
    "page:/admin/guides",
    "system",
    "Guides",
    "Write the 'About this page' descriptions staff see, and choose who sees each one: everyone who can open that area, only administrators, chosen departments, or nobody. Reset a guide to go back to the built-in text.",
    "admins",
  ),
];

export const GUIDE_KEYS = new Set(GUIDE_DEFAULTS.map((guide) => guide.key));
