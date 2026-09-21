/**
 * Cookie-free sign-in fallback.
 *
 * NORMAL PATH: signing in makes the server set an HttpOnly cookie that the
 * browser sends with every request. Page scripts never see it.
 *
 * THE PROBLEM: our site and API live on different domains, so that cookie is a
 * "third-party" cookie. Safari, Firefox in strict mode, some in-app browsers
 * and private windows refuse to keep it — signing in would appear to work and
 * then every request would be treated as signed out.
 *
 * THE FIX (this file): right after signing in we ask the server "who am I?"
 * WITHOUT any header. If the cookie was kept, that succeeds and we keep
 * relying on it. If not, we store the token the server also returned and send
 * it as an `Authorization: Bearer` header instead. The server accepts either.
 *
 * Trade-off: a token held by page scripts can be read by malicious script, so
 * this path is used ONLY when cookies demonstrably don't work. Serving the
 * site from the same domain as the API (DEPLOYMENT.md, "Same-domain setup")
 * makes cookies first-party and the fallback unnecessary.
 */

export type SessionRealm = "admin" | "customer";

const TOKEN_KEYS: Record<SessionRealm, string> = {
  admin: "lycie_admin_token",
  customer: "lycie_customer_token",
};

/** Where each realm's whoami endpoint lives, used to test whether the cookie works. */
const SESSION_ENDPOINTS: Record<SessionRealm, string> = {
  admin: "/auth/session",
  customer: "/customers/session",
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001/api";

// Storage can throw (private windows, blocked site data), so every access is guarded.
function readFrom(storage: () => Storage, key: string): string | null {
  try {
    return storage().getItem(key);
  } catch {
    return null;
  }
}

/** The stored fallback token, if this browser is in cookie-free mode for that realm. */
export function getFallbackToken(realm: SessionRealm): string | null {
  const key = TOKEN_KEYS[realm];
  return readFrom(() => sessionStorage, key) ?? readFrom(() => localStorage, key);
}

/**
 * Remembers the token. "Keep me signed in" uses localStorage (survives closing
 * the browser); otherwise sessionStorage (gone when the tab closes), matching
 * the lifetime of the cookie it stands in for.
 */
export function saveFallbackToken(realm: SessionRealm, token: string, persistent: boolean): void {
  clearFallbackToken(realm);
  try {
    (persistent ? localStorage : sessionStorage).setItem(TOKEN_KEYS[realm], token);
  } catch {
    // Storage blocked: nothing more we can do; the user will be asked to sign in again.
  }
}

export function clearFallbackToken(realm: SessionRealm): void {
  try {
    sessionStorage.removeItem(TOKEN_KEYS[realm]);
    localStorage.removeItem(TOKEN_KEYS[realm]);
  } catch {
    // ignore
  }
}

/** Headers to add to a request so the server sees the fallback token. Empty when cookies are doing the job. */
export function authHeader(realm: SessionRealm): Record<string, string> {
  const token = getFallbackToken(realm);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Does the session cookie work in this browser? Asks the server who we are
 * using cookies only — deliberately no Authorization header.
 */
async function cookieSessionWorks(realm: SessionRealm): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}${SESSION_ENDPOINTS[realm]}`, { credentials: "include" });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Call once, right after a successful sign-in response. Decides between
 * cookie mode and the header fallback, and remembers the choice.
 */
export async function settleSession(realm: SessionRealm, token: string | undefined, remember: boolean): Promise<void> {
  clearFallbackToken(realm);
  if (!token) return;
  if (await cookieSessionWorks(realm)) return; // cookie mode: nothing to store
  saveFallbackToken(realm, token, remember);
}
