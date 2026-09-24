/**
 * Which public data a write request may have changed. The frontend listens
 * for these topic names and quietly refetches just that data, so an admin's
 * edit shows up on every open visitor's screen within a moment.
 *
 * Deliberately over-inclusive rather than clever: a needless refetch costs a
 * cheap conditional request, a missed one leaves stale content on screen.
 */
export function topicsForWrite(path: string): string[] {
  const parts = path.replace(/^\/api\//, "").split("/").filter(Boolean);
  const [first, second] = parts;

  switch (first) {
    case "vehicles":
    case "hire-vehicles":
    case "testimonials":
    case "faq":
    case "blog-posts":
    case "notices":
    case "site-content":
    case "reviews":
    case "likes":
      return [first];
    // A new exchange rate or currency setting changes every price shown on the site.
    case "deals":
    case "deal-admin":
      return ["deals"];
    case "pricing":
      return ["pricing", "vehicles", "hire-vehicles"];
    // Bookings change which hire vehicles (and dates) are available.
    case "hire-requests":
      return ["hire-vehicles"];
    // Shipment progress shows in customers' accounts ("Track my vehicle") and the workspace.
    case "shipments":
    case "customer-cases":
      return ["shipments"];
    // /content-admin/<type>/... — the type IS the topic.
    case "content-admin":
      return second ? [second] : [];
    case "lycie":
      // Publishing an AI-drafted FAQ or promoting a suggestion changes public content.
      if (second === "suggestions") return ["faq"];
      if (second === "testimonial-ideas") return ["testimonials"];
      return [];
    default:
      return [];
  }
}
