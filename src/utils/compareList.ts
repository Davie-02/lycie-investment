/**
 * The visitor's "compare" shortlist: up to three vehicle slugs, kept in this
 * browser only (no account needed). Components listen for COMPARE_EVENT to
 * stay in step when it changes on another part of the page.
 */
export const MAX_COMPARE = 3;
export const COMPARE_EVENT = "compare-list-changed";
const KEY = "lycie_compare";

export function getCompareList(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "[]") as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string").slice(0, MAX_COMPARE) : [];
  } catch {
    return [];
  }
}

function save(list: string[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // Storage blocked (private mode): comparing still works through the page address.
  }
  window.dispatchEvent(new Event(COMPARE_EVENT));
}

/** Adds a vehicle; when the list is full the oldest one makes room. */
export function addToCompare(slug: string): string[] {
  const list = [...getCompareList().filter((item) => item !== slug), slug].slice(-MAX_COMPARE);
  save(list);
  return list;
}

export function removeFromCompare(slug: string): string[] {
  const list = getCompareList().filter((item) => item !== slug);
  save(list);
  return list;
}

/** The address of the comparison page for these vehicles. */
export function compareUrl(slugs: string[]): string {
  return `/compare?v=${slugs.map(encodeURIComponent).join(",")}`;
}
