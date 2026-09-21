import { apiGet } from "./http";

/** Which "Continue with…" providers the server has credentials for. `null` = not set up (button hidden). */
export interface AuthProviders {
  google: { clientId: string } | null;
  facebook: { appId: string } | null;
}

let cached: Promise<AuthProviders> | null = null;

/**
 * Asks the API which social sign-in options exist. Cached for the life of the
 * page, and any failure is treated as "none" so a hiccup never breaks the
 * login form — it just shows without the extra buttons.
 */
export function getAuthProviders(): Promise<AuthProviders> {
  cached ??= apiGet<AuthProviders>("/auth/providers").catch(() => ({ google: null, facebook: null }));
  return cached;
}
