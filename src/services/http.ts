// Shared HTTP client for every PUBLIC (non-authenticated) API call: vehicle
// inquiries, import/clearing/hire requests, contact messages, and reading
// public vehicle/site-content data. Admin calls go through
// src/admin/adminApi.ts instead, and logged-in customer calls go through
// src/services/customer.service.ts — those two already handle CSRF the
// same way this file does.
import { getCsrfToken } from "./csrf";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001/api";

export class ApiError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = "ApiError";
  }
}

// Nest sends validation errors as either a single string or an array of
// strings (one per failed field) — normalize both into one readable line.
async function parseErrorMessage(response: Response): Promise<string> {
  try {
    const body = await response.json();
    if (Array.isArray(body?.message)) return body.message.join(" ");
    if (typeof body?.message === "string") return body.message;
  } catch {
    // Response body wasn't JSON (e.g. a proxy/500 page) — fall back below.
  }
  return `Request failed (${response.status}).`;
}

export async function apiGet<T>(path: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { credentials: "include" });
  } catch {
    throw new ApiError("Unable to reach the server. Please check your connection and try again.");
  }

  if (!response.ok) {
    throw new ApiError(await parseErrorMessage(response), response.status);
  }

  return response.json() as Promise<T>;
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  let response: Response;
  try {
    // The backend rejects any state-changing request that doesn't carry a
    // valid CSRF token (server/src/main.ts) — this protects public form
    // submissions from cross-site request forgery, the same way the admin
    // and customer API clients are already protected. Without this line,
    // every public form on the site (contact, inquiries, hire requests...)
    // would fail with "A valid CSRF token is required."
    const csrfToken = await getCsrfToken();
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "x-csrf-token": csrfToken,
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError("Unable to reach the server. Please check your connection and try again.");
  }

  if (!response.ok) {
    throw new ApiError(await parseErrorMessage(response), response.status);
  }

  return response.json() as Promise<T>;
}
