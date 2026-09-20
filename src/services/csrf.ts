const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001/api";

let csrfToken: string | null = null;

export async function getCsrfToken(): Promise<string> {
  if (csrfToken) return csrfToken;

  const response = await fetch(`${API_BASE_URL}/auth/csrf`, {
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error("Unable to establish a secure session.");
  }

  const body = (await response.json()) as { token: string };
  csrfToken = body.token;
  return csrfToken;
}

export function clearCsrfToken(): void {
  csrfToken = null;
}

/**
 * fetch() for state-changing requests: attaches the CSRF token and, if the server
 * rejects it as stale (the token cookie expired while a phone tab sat in the
 * background, or was cleared), fetches a fresh token and retries once.
 */
export async function fetchWithCsrf(url: string, init: RequestInit = {}): Promise<Response> {
  const send = async () => {
    const token = await getCsrfToken();
    return fetch(url, { ...init, headers: { ...init.headers, "x-csrf-token": token } });
  };

  const response = await send();
  if (response.status !== 403) return response;

  const message = await response.clone().text().catch(() => "");
  if (!/csrf/i.test(message)) return response;

  clearCsrfToken();
  return send();
}
