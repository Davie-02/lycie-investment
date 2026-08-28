import { ApiError } from "@/services/http";
import { clearCsrfToken, getCsrfToken } from "@/services/csrf";
import { resolveUploadUrl as sharedResolveUploadUrl } from "@/utils/resolveUploadUrl";

// Re-exported so existing admin code importing from "../adminApi" keeps
// working unchanged — the actual logic lives in one shared place now, used
// by both admin and public-site image display.
export const resolveUploadUrl = sharedResolveUploadUrl;

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001/api";
export const SESSION_EXPIRED_EVENT = "admin-session-expired";
const ADMIN_USER_KEY = "lycie_admin_user";

export interface AdminUserSummary {
  id: string;
  name: string;
  email: string;
  role: "OWNER" | "MANAGER" | "VIEWER";
  isActive: boolean;
  createdAt: string;
}

export function clearAdminToken(): void {
  void getCsrfToken()
    .then((token) =>
      fetch(`${API_BASE_URL}/auth/logout`, {
        method: "POST",
        credentials: "include",
        headers: { "x-csrf-token": token },
      })
    )
    .finally(clearCsrfToken);
}

export function getStoredUser(): AdminUserSummary | null {
  const raw = localStorage.getItem(ADMIN_USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AdminUserSummary;
  } catch {
    return null;
  }
}

export function setStoredUser(user: AdminUserSummary): void {
  localStorage.setItem(ADMIN_USER_KEY, JSON.stringify(user));
}

export function clearStoredUser(): void {
  localStorage.removeItem(ADMIN_USER_KEY);
}

async function parseErrorMessage(response: Response): Promise<string> {
  try {
    const body = await response.json();
    if (Array.isArray(body?.message)) return body.message.join(" ");
    if (typeof body?.message === "string") return body.message;
  } catch {
    // response wasn't JSON — fall through to the generic message below
  }
  return `Request failed (${response.status}).`;
}

async function adminFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const csrfToken = init.method && init.method !== "GET" ? await getCsrfToken() : null;
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      credentials: "include",
      headers: {
        ...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
        ...(init.body && !(init.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
    });
  } catch {
    throw new ApiError("Unable to reach the server. Please check your connection and try again.");
  }

  if (response.status === 401) {
    clearStoredUser();
    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    throw new ApiError("Your session has expired. Please log in again.", 401);
  }

  if (!response.ok) {
    throw new ApiError(await parseErrorMessage(response), response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return response.json() as Promise<T>;
}

export const adminApi = {
  get: <T>(path: string) => adminFetch<T>(path),
  post: <T>(path: string, body: unknown) =>
    adminFetch<T>(path, { method: "POST", body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    adminFetch<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  delete: <T>(path: string) => adminFetch<T>(path, { method: "DELETE" }),
  uploadFile: <T>(path: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return adminFetch<T>(path, { method: "POST", body: formData });
  },
};

export async function adminLogin(
  email: string,
  password: string
): Promise<{ user: AdminUserSummary }> {
  return adminFetch<{ user: AdminUserSummary }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}


