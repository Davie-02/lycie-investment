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
