/**
 * Post-processes the model's raw reply. The model is instructed to use two
 * markers; the server, not the model, decides what they mean:
 *   [[NO_INFO]]        the assistant says it lacks the information
 *   [[vehicle:slug]]   recommend an inventory vehicle
 * Vehicle slugs are checked against the real inventory, so a hallucinated
 * or malicious slug can never reach the customer as a "recommendation".
 */

export interface ParsedReply {
  text: string;
  noInfo: boolean;
  vehicleSlugs: string[];
}

const MAX_VEHICLE_CARDS = 3;

export function parseReply(raw: string, knownSlugs: ReadonlySet<string>): ParsedReply {
  const noInfo = /\[\[NO_INFO\]\]/i.test(raw);

  const vehicleSlugs: string[] = [];
  for (const match of raw.matchAll(/\[\[vehicle:([a-z0-9-]+)\]\]/gi)) {
    const slug = match[1].toLowerCase();
    if (knownSlugs.has(slug) && !vehicleSlugs.includes(slug) && vehicleSlugs.length < MAX_VEHICLE_CARDS) {
      vehicleSlugs.push(slug);
    }
  }

  const text = raw
    .replace(/\[\[NO_INFO\]\]/gi, "")
    .replace(/\[\[vehicle:[^\]]*\]\]/gi, "")
    // Collapse the gaps the removed markers leave behind.
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();

  return { text, noInfo, vehicleSlugs };
}
