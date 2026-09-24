/**
 * Turns an admin write request into a sentence for the activity log. Only the
 * route pattern, URL parameters and a few harmless body fields are used —
 * never submitted text, which can contain customers' personal details.
 */
const NOUN: Record<string, string> = {
  vehicles: "vehicle",
  "hire-vehicles": "hire vehicle",
  testimonials: "testimonial",
  faq: "FAQ",
  "blog-posts": "blog post",
  notices: "notice",
};

const VERB_PAST: Record<string, string> = {
  publish: "Published",
  unpublish: "Unpublished",
  archive: "Archived",
  restore: "Restored",
  delete: "Deleted",
};

export interface ActionInput {
  method: string;
  route: string;
  params: Record<string, string | undefined>;
  body?: Record<string, unknown>;
}

export function describeAction({ method, route, params, body }: ActionInput): string {
  const r = route.replace(/^\/api/, "");
  const type = params.type ?? "";

  if (r === "/content-admin/:type/bulk") {
    const count = Array.isArray(body?.ids) ? body.ids.length : 0;
    const noun = NOUN[type] ?? "item";
    const verb = VERB_PAST[String(body?.action)] ?? "Changed";
    return `${verb} ${count} ${noun}${count === 1 ? "" : "s"}`;
  }
  if (r === "/content-admin/:type/:id/duplicate") return `Duplicated a ${NOUN[type] ?? "item"}`;

  const resource = r.split("/")[1] ?? "";
  const noun = NOUN[resource];
  if (noun) {
    if (method === "POST") return `Added a ${noun}`;
    if (method === "PATCH" || method === "PUT") return `Edited a ${noun}`;
    if (method === "DELETE") return `Deleted a ${noun}`;
  }

  const known: Array<[RegExp, string]> = [
    [/^\/site-content\/:key$/, `Edited site content (${params.key ?? "section"})`],
    [/^\/uploads$/, "Uploaded an image"],
    [/^\/reviews\/:id\/status$/, `Set a review to ${String(body?.status ?? "a new status")}`],
    [/^\/reviews\/:id$/, "Deleted a review"],
    [/^\/inquiries\/:id\/status$/, "Changed an inquiry's status"],
    [/^\/import-requests\/:id\/status$/, "Changed an import request's status"],
    [/^\/clearing-requests\/:id\/status$/, "Changed a clearing request's status"],
    [/^\/contact-messages\/:id\/status$/, "Changed a contact message's status"],
    [/^\/hire-requests\/:id\/status$/, `Set a booking to ${String(body?.status ?? "a new status")}`],
    [/^\/hire-requests\/:id\/cancel$/, "Cancelled a booking"],
    [/^\/contact-admin\/:type\/:id\/email$/, "Emailed a customer"],
    [/^\/contact-admin\/:type\/:id\/message$/, "Messaged a customer's profile"],
    [/^\/contact-admin\/:type\/:id\/log$/, "Logged contact with a customer"],
    [/^\/contact-admin\/test-email$/, "Sent a test email"],
    [/^\/lycie\/knowledge/, "Changed Lycie's knowledge notes"],
    [/^\/lycie\/documents/, "Changed a document Lycie learned from"],
    [/^\/lycie\/suggestions\/:id\/publish$/, "Published an AI-drafted FAQ"],
    [/^\/lycie\/suggestions\/:id\/reject$/, "Rejected an AI-drafted FAQ"],
    [/^\/lycie\/suggestions\/generate$/, "Ran the FAQ analysis"],
    [/^\/lycie\/testimonial-ideas\/:id\/publish$/, "Published a testimonial from feedback"],
    [/^\/lycie\/testimonial-ideas\/:id\/dismiss$/, "Dismissed a testimonial idea"],
    [/^\/lycie\/write$/, "Used the AI writer"],
    [/^\/admin-users/, method === "POST" ? "Added an admin user" : method === "DELETE" ? "Removed an admin user" : "Edited an admin user"],
    [/^\/financial\/payments\/:id\/approve$/, "Approved a payment"],
    [/^\/financial\/payments\/:id\/reject$/, "Rejected a payment"],
    [/^\/notices/, "Changed a notice"],
    [/^\/admin-tools\/activity\/:id\/undo$/, "Undid an action"],
    [/^\/deal-admin\/:id\/publish$/, "Published a deal"],
    [/^\/deal-admin\/:id\/unpublish$/, "Unpublished a deal"],
    [/^\/deal-admin\/:id\/dismiss$/, "Dismissed a deal"],
    [/^\/deal-admin\/scan$/, "Ran the deals finder"],
    [/^\/deal-admin/, method === "POST" ? "Added a deal" : method === "DELETE" ? "Deleted a deal" : "Edited a deal"],
    [/^\/social\/posts\/:id\/publish$/, "Published a social media post"],
    [/^\/social\/posts$/, "Created a social media post"],
    [/^\/social\/posts\/:id$/, "Deleted a social media post"],
    [/^\/social\/reply$/, "Replied on social media"],
    [/^\/pricing\/settings$/, "Changed currency and price settings"],
    [/^\/pricing\/convert-listings$/, "Converted listing prices to US dollars"],
    [/^\/pricing\/refresh$/, "Refreshed the exchange rate"],
    [/^\/site-content\/apply-profile$/, "Loaded the company profile into the site"],
    [/^\/customer-cases\/:id\/updates$/, "Posted an update on a customer case"],
    [/^\/customer-cases$/, "Opened a customer case"],
    [/^\/market\/report$/, "Generated a market briefing"],
  ];
  for (const [pattern, text] of known) if (pattern.test(r)) return text;
  return `${method} ${r}`;
}

/** Writes that shouldn't appear in the log (login flows, visitor traffic). */
export function isLoggable(route: string): boolean {
  const r = route.replace(/^\/api/, "");
  return !/^\/(auth|customers|events|likes|insights)\b/.test(r) && !/^\/lycie\/(chat|feedback|submissions)$/.test(r);
}
