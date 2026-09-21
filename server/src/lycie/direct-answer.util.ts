import type { HireInfo, VehicleInfo } from "./prompt.builder";

/**
 * Answers the most common shop-floor questions straight from the company's own data, with no AI call:
 *   "Do you have a Toyota Hilux?"  ·  "How much is a Corolla?"  ·  "What SUVs are available?"  ·  "What can I hire?"
 * These are pure lookups against live vehicles and hire fleet, so they are instant, always accurate and work even
 * when Google's AI is slow or down. Anything that isn't clearly one of these returns null and goes to the AI.
 *
 * The rule of thumb: it must be obvious what the visitor wants (a stock/price/hire question) AND obvious which
 * vehicles they mean (a make, model or body type we recognise). If either is unclear, don't guess.
 */

export interface DirectAnswer {
  text: string;
  /** Vehicles to show as cards under the answer. */
  slugs: string[];
}

const STOCK_OR_PRICE = /\b(price|prices|cost|costs|how much|available|availability|in stock|stock|do you (?:have|sell|stock|got)|have you got|got any|for sale|selling|show me|looking for|list of)\b/i;
const HIRE = /\b(hire|hiring|rent|rental|rentals|rented)\b/i;
/** Words that mean the visitor wants something beyond a simple lookup — let the AI handle those. */
const COMPLEX = /\b(finance|financing|loan|instal+ments?|deposit|warranty|import|export|clear|clearing|customs|duty|shipping|ship|deliver|delivery|trade[- ]?in|compare|difference|better|recommend|which is)\b/i;
const GENERIC_VEHICLE = /\b(vehicles?|cars?|trucks?|pick-?ups?|suvs?|sedans?|vans?|buses|bus)\b/i;

const words = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, " ").split(/\s+/).filter((w) => w.length > 1);

/** "Toyota Hilux 2022" → make "toyota", model "hilux". */
function makeAndModel(label: string): { make: string; model: string } {
  const [make = "", ...rest] = label.toLowerCase().split(/\s+/);
  const model = rest.filter((part) => !/^\d{4}$/.test(part)).join(" ");
  return { make, model };
}

/** Vehicles whose MODEL is named in the question ("hilux", "land cruiser"). */
function byModel(vehicles: VehicleInfo[], tokens: Set<string>, question: string): VehicleInfo[] {
  const lower = question.toLowerCase();
  return vehicles.filter((v) => {
    const { model } = makeAndModel(v.label);
    return model !== "" && (model.includes(" ") ? lower.includes(model) : tokens.has(model));
  });
}

/** Vehicles whose MAKE is named in the question ("toyota"). */
function byMake(vehicles: VehicleInfo[], tokens: Set<string>): VehicleInfo[] {
  return vehicles.filter((v) => {
    const { make } = makeAndModel(v.label);
    return make !== "" && tokens.has(make);
  });
}

/** Everyday words that carry no vehicle information; anything else left in a make-only question could be a model we don't stock. */
const FILLER = new Set(("a an the any some do does you your we i me my have has had got stock stocks stocked sell selling sale for in on at of to and or is are it there " +
  "what which how much many price prices cost costs available availability show list looking look please can could would like want need am currently now right " +
  "vehicle vehicles car cars truck trucks bus buses van vans suv suvs pickup pickups pick-up pick-ups sedan sedans hatchback hatchbacks used new second hand secondhand " +
  "hi hello hey thanks thank").split(" "));

/** Words in the question that could still be an unrecognised model name (so a make-only match can't be trusted). */
function unexplainedWords(tokens: Set<string>, make: string): string[] {
  return [...tokens].filter((w) => !FILLER.has(w) && w !== make && !/^\d+$/.test(w));
}

const list = (vehicles: VehicleInfo[]) => vehicles.map((v) => `- ${v.label} — ${v.priceText}${v.mileageKm ? `, ${v.mileageKm.toLocaleString("en-US")} km` : ""}`).join("\n");

export function directAnswer(question: string, vehicles: VehicleInfo[], hire: HireInfo[]): DirectAnswer | null {
  if (question.length > 160 || COMPLEX.test(question)) return null;
  const tokens = new Set(words(question));
  if (tokens.size === 0) return null;

  // ---- Hire: "what can I hire?" / "do you rent SUVs?"
  if (HIRE.test(question)) {
    const available = hire.filter((h) => h.available);
    if (available.length === 0) return null;
    const lines = available.slice(0, 6).map((h) => `- ${h.name} (${h.seats} seats, ${h.transmission}) — ${h.dailyText} per day${h.weeklyText ? `, ${h.weeklyText} per week` : ""}`);
    return { text: `These vehicles are available for hire right now:\n${lines.join("\n")}\n\nTo book one, use the hire request form on our Hire page and we'll confirm the dates with you.`, slugs: [] };
  }

  // ---- Vehicles for sale: needs a stock/price question AND a vehicle we recognise
  if (!STOCK_OR_PRICE.test(question)) return null;

  // A named model is the most specific thing to go on; only fall back to the make when no model was named.
  const modelMatches = byModel(vehicles, tokens, question);
  const makeMatches = modelMatches.length > 0 ? [] : byMake(vehicles, tokens);
  // "Do you have a Toyota Vitz?" names a model we don't stock; listing every Toyota as "matching" would be wrong.
  // If the question has any word we can't explain, leave it to the AI, which can say so honestly.
  const unsure = makeMatches.length > 0 && unexplainedWords(tokens, makeAndModel(makeMatches[0].label).make).length > 0;
  if (unsure) return null;
  const named = modelMatches.length > 0 ? modelMatches : makeMatches;
  if (named.length > 0) {
    const available = named.filter((v) => v.status === "available");
    if (available.length === 0) {
      return { text: `We don't have that available right now (${named.map((v) => v.label).join(", ")} — ${named.every((v) => v.status === "sold") ? "sold" : "reserved"}). We can source a similar vehicle for you — see our Import page, or tell us what you're looking for.`, slugs: [] };
    }
    const shown = available.slice(0, 5);
    return { text: `Yes — we currently have ${available.length === 1 ? "this one" : `${available.length} matching vehicles`} available:\n${list(shown)}\n\nTap a vehicle below for photos and full details.`, slugs: shown.map((v) => v.slug) };
  }

  // ---- "What cars do you have?" with no specific make: show what's in stock
  const bodyWord = ["suv", "suvs", "pickup", "pickups", "pick-up", "truck", "trucks", "sedan", "sedans", "van", "vans", "hatchback", "hatchbacks"].find((w) => tokens.has(w));
  if (bodyWord) {
    const stem = bodyWord.replace(/s$/, "").replace("pick-up", "pickup").replace("truck", "pickup");
    const byBody = vehicles.filter((v) => v.status === "available" && `${v.bodyType}`.toLowerCase().replace(/s$/, "").includes(stem));
    if (byBody.length === 0) return null; // unsure what "pickup" maps to in their data — let the AI look
    const shown = byBody.slice(0, 5);
    return { text: `Here are the ${bodyWord.replace(/s$/, "")}s we currently have available:\n${list(shown)}\n\nTap a vehicle below for photos and full details.`, slugs: shown.map((v) => v.slug) };
  }
  if (GENERIC_VEHICLE.test(question) && !/\b(under|below|cheaper|cheapest|less than|budget|over|above|between|best|popular|recommend)\b/i.test(question)) {
    const available = vehicles.filter((v) => v.status === "available");
    if (available.length === 0) return null;
    const shown = available.slice(0, 5);
    return { text: `Here are some of the vehicles we currently have available:\n${list(shown)}\n\nTap a vehicle below for photos and details, or tell me what you're looking for.`, slugs: shown.map((v) => v.slug) };
  }
  return null;
}
