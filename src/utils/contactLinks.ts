/** Country code assumed for numbers written locally (0991 383 466). Malawi = 265. */
const DEFAULT_COUNTRY_CODE = "265";

/** Digits only, with the country code, as WhatsApp links require (no "+", spaces or zeros). */
export function toInternationalDigits(phone: string, countryCode = DEFAULT_COUNTRY_CODE): string | null {
  const trimmed = phone.trim();
  let digits = trimmed.replace(/\D/g, "");
  if (digits.length < 7) return null;
  if (trimmed.startsWith("+")) return digits;
  if (digits.startsWith("00")) return digits.slice(2);
  if (digits.startsWith("0")) digits = countryCode + digits.slice(1);
  else if (!digits.startsWith(countryCode) && digits.length <= 9) digits = countryCode + digits;
  return digits;
}

export function whatsappUrl(phone: string, text: string): string | null {
  const digits = toInternationalDigits(phone);
  return digits ? `https://wa.me/${digits}?text=${encodeURIComponent(text)}` : null;
}

export function telUrl(phone: string): string | null {
  const digits = toInternationalDigits(phone);
  return digits ? `tel:+${digits}` : null;
}

export function mailtoUrl(email: string, subject: string, body: string): string {
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export type RequestKind = "inquiry" | "import" | "clearing" | "hire" | "contact";

/** A polite starting message the admin can edit before sending. `topic` reads like "the Toyota Hilux 2022". */
export function messageTemplate(kind: RequestKind, fullName: string, topic: string, senderName?: string): { subject: string; body: string } {
  const first = fullName.trim().split(/\s+/)[0] || "there";
  const sign = `\n\nKind regards,\n${senderName ? `${senderName}, ` : ""}Lycie Investments`;
  switch (kind) {
    case "inquiry":
      return {
        subject: `Your enquiry about ${topic}`,
        body: `Hello ${first},\n\nThank you for your interest in ${topic}. I'm getting back to you to help with any questions and to arrange a viewing if you'd like one.\n\nWhen would suit you?${sign}`,
      };
    case "import":
      return {
        subject: "Your vehicle import request",
        body: `Hello ${first},\n\nThank you for your import request (${topic}). We're looking at options for you. To move forward, could you confirm your budget and how soon you need the vehicle?${sign}`,
      };
    case "clearing":
      return {
        subject: "Your vehicle clearing request",
        body: `Hello ${first},\n\nThank you for your clearing request (${topic}). Please send us the available documents (invoice, bill of lading, and any others you have) so we can begin.${sign}`,
      };
    case "hire":
      return {
        subject: "Your vehicle hire request",
        body: `Hello ${first},\n\nThank you for your hire request (${topic}). I'm writing about your booking — please reply to confirm the pickup details.${sign}`,
      };
    case "contact":
      return {
        subject: `Re: ${topic}`,
        body: `Hello ${first},\n\nThank you for getting in touch about "${topic}".${sign}`,
      };
  }
}

/** The text to search for on a map: the dedicated map setting if there is one, otherwise the street address. */
export function mapQueryFor(mapQuery: string | null | undefined, address: string | null | undefined): string {
  return (mapQuery ?? "").trim() || (address ?? "").trim();
}

/** Opens Google Maps at this place (a new tab on desktop, the Maps app on phones). */
export function mapsSearchUrl(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/** Opens Google Maps with turn-by-turn directions TO this place, starting from where the person is. */
export function mapsDirectionsUrl(query: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(query)}`;
}

/** Address for the embedded map. Google's keyless embed accepts any place text or "lat,lng" coordinates. */
export function mapsEmbedUrl(query: string): string {
  return `https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed`;
}

/** `mailto:` link for a plain address (no subject/body), or null if it doesn't look like one. */
export function mailtoLink(email: string | null | undefined): string | null {
  const value = (email ?? "").trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? `mailto:${value}` : null;
}
