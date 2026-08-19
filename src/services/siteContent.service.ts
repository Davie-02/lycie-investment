import { apiGet } from "./http";

/**
 * Returns whatever sections exist in the database, keyed by section name
 * (e.g. { contact: {...}, about: {...} }). May be missing keys on a fresh,
 * unseeded database — callers should merge this over DEFAULT_SITE_CONTENT
 * rather than assume every key is present. See SiteContentContext.
 */
export async function getSiteContent(): Promise<Record<string, unknown>> {
  return apiGet<Record<string, unknown>>("/site-content");
}
