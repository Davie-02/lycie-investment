import { ApiError } from "@/services/http";
import { clearCsrfToken, fetchWithCsrf, getCsrfToken } from "@/services/csrf";
import { authHeader, clearFallbackToken, settleSession } from "@/services/sessionToken";
import { resolveUploadUrl as sharedResolveUploadUrl } from "@/utils/resolveUploadUrl";
import { parseErrorMessage } from "@/utils/apiError";
import type { AccessMap } from "./access";

// Re-exported so existing admin code importing from "../adminApi" keeps
// working unchanged — the actual logic lives in one shared place now, used
// by both admin and public-site image display.
export const resolveUploadUrl = sharedResolveUploadUrl;

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001/api";
export const SESSION_EXPIRED_EVENT = "admin-session-expired";
/** Fired after any admin change the server says can be undone. detail: { id, action }. */
export const UNDOABLE_EVENT = "admin-undoable";
/** Fired after an undo, so the current admin screen reloads its data (AdminLayout remounts it). */
export const DATA_CHANGED_EVENT = "admin-data-changed";
/** Fired after every successful change made from the workspace (dashboards refresh their numbers). */
export const ADMIN_WRITE_EVENT = "admin-write";
/** Fired when a system administrator must set up two-step verification before doing anything else. */
export const TWO_FACTOR_REQUIRED_EVENT = "admin-two-factor-required";

export interface UndoableDetail {
  id: string;
  action: string;
}
const ADMIN_USER_KEY = "lycie_admin_user";
/** "1" when this admin ticked "Keep me signed in" — the dashboard then skips its 5-minute idle logout. */
const ADMIN_REMEMBER_KEY = "lycie_admin_remember";

export interface AdminUserSummary {
  id: string;
  name: string;
  email: string;
  /** OWNER = system administrator; EMPLOYEE = staff (access from department + overrides); MANAGER/VIEWER = older accounts. */
  role: "OWNER" | "MANAGER" | "VIEWER" | "EMPLOYEE";
  isActive: boolean;
  createdAt: string;
  /** Present on the signed-in admin's own record (/auth/session). */
  twoFactorEnabled?: boolean;
  /** Present on records from the staff list (/admin-users). */
  totpEnabled?: boolean;
  department?: string | null;
  jobTitle?: string | null;
  phone?: string | null;
  /** What this person can use, module by module (computed by the server). */
  access?: AccessMap;
  /** A system administrator who must set up two-step verification before anything else works. */
  mustSetUpTwoFactor?: boolean;
}

/** Signs out on the server (clears the cookie) and forgets any fallback token. */
export function clearAdminToken(): void {
  void getCsrfToken()
    .then((token) =>
      fetch(`${API_BASE_URL}/auth/logout`, {
        method: "POST",
        credentials: "include",
        headers: { "x-csrf-token": token, ...authHeader("admin") },
      })
    )
    .finally(() => {
      clearCsrfToken();
      clearFallbackToken("admin");
    });
}

export function isAdminRemembered(): boolean {
  try {
    return localStorage.getItem(ADMIN_REMEMBER_KEY) === "1";
  } catch {
    return false;
  }
}

function setAdminRemembered(remember: boolean): void {
  try {
    if (remember) localStorage.setItem(ADMIN_REMEMBER_KEY, "1");
    else localStorage.removeItem(ADMIN_REMEMBER_KEY);
  } catch {
    // Storage blocked: the idle logout stays on, the safe default.
  }
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
  localStorage.removeItem(ADMIN_REMEMBER_KEY);
  // A dead session must not leave its token behind to be replayed.
  clearFallbackToken("admin");
}

async function adminFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const send = init.method && init.method !== "GET" ? fetchWithCsrf : fetch;
  let response: Response;

  try {
    response = await send(`${API_BASE_URL}${path}`, {
      ...init,
      credentials: "include",
      headers: {
        ...(init.body && !(init.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
        // Empty in normal (cookie) mode; carries the token when cookies are blocked.
        ...authHeader("admin"),
        ...init.headers,
      },
    });
  } catch {
    throw new ApiError("Unable to reach the server. Please check your connection and try again.");
  }

  // On these routes a 401 means "those details were wrong", not "your session ended".
  const isCredentialCheck = /^\/auth\/(login|forgot-password|reset-password|2fa\/disable|change-password)/.test(path);
  if (response.status === 401 && !isCredentialCheck) {
    clearStoredUser();
    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    throw new ApiError("Your session has expired. Please log in again.", 401);
  }

  if (!response.ok) {
    const code = await response
      .clone()
      .json()
      .then((body: { code?: unknown }) => (typeof body?.code === "string" ? body.code : undefined))
      .catch(() => undefined);
    if (code === "TWO_FACTOR_SETUP_REQUIRED") window.dispatchEvent(new Event(TWO_FACTOR_REQUIRED_EVENT));
    throw new ApiError(await parseErrorMessage(response), response.status, code);
  }

  if (init.method && init.method !== "GET") window.dispatchEvent(new Event(ADMIN_WRITE_EVENT));

  // The server marks changes that can be reversed; the Undo bar (UndoToast) listens for this.
  const undoId = response.headers.get("X-Undo-Id");
  if (undoId) {
    let action = "Change saved";
    try {
      action = decodeURIComponent(response.headers.get("X-Undo-Action") ?? "") || action;
    } catch {
      // A malformed header just falls back to the generic wording.
    }
    window.dispatchEvent(new CustomEvent<UndoableDetail>(UNDOABLE_EVENT, { detail: { id: undoId, action } }));
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return response.json() as Promise<T>;
}

export interface UndoResult {
  undone: true;
  action: string;
  restored: number;
  /** Things an undo can't take back (e.g. an email that was already sent). */
  notes: string[];
}

/**
 * Reverses one logged admin action. A 409 means parts were changed again
 * since; pass `force` to undo anyway. Afterwards every open screen refetches.
 */
export async function undoAdminAction(activityId: string, force = false): Promise<UndoResult> {
  const result = await adminFetch<UndoResult>(`/admin-tools/activity/${encodeURIComponent(activityId)}/undo`, {
    method: "POST",
    body: JSON.stringify({ force }),
  });
  window.dispatchEvent(new Event(DATA_CHANGED_EVENT));
  return result;
}

/** Signs out every other device/browser on this admin account; this one stays signed in. */
export async function adminSignOutEverywhere(): Promise<void> {
  const result = await adminFetch<AdminAuthResponse>("/auth/sign-out-everywhere", { method: "POST", body: "{}" });
  await settleSession("admin", result.token, isAdminRemembered());
}

export const adminApi = {
  get: <T>(path: string) => adminFetch<T>(path),
  post: <T>(path: string, body: unknown) =>
    adminFetch<T>(path, { method: "POST", body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    adminFetch<T>(path, { method: "PUT", body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    adminFetch<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  delete: <T>(path: string) => adminFetch<T>(path, { method: "DELETE" }),
  uploadFile: <T>(path: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return adminFetch<T>(path, { method: "POST", body: formData });
  },
};

/** What the server returns from a successful admin sign-in. */
interface AdminAuthResponse {
  user: AdminUserSummary;
  /** Only used by the cookie-free fallback — see services/sessionToken.ts. */
  token?: string;
}

/** Step one of sign-in: finished (session), or an authenticator code / a first password is still needed. */
export type AdminLoginResult =
  | { user: AdminUserSummary }
  | { requiresTwoFactor: true; challenge: string }
  | { requiresPasswordChange: true; challenge: string; name: string };

type AdminStepResponse = AdminAuthResponse | { requiresTwoFactor: true; challenge: string } | { requiresPasswordChange: true; challenge: string; name: string };

/** Settles cookie-vs-header mode and remembers the "keep me signed in" choice. Also used after the website's shared sign-in. */
export async function finishAdminSignIn(response: AdminAuthResponse, remember: boolean): Promise<{ user: AdminUserSummary }> {
  await settleSession("admin", response.token, remember);
  setAdminRemembered(remember);
  return { user: response.user };
}

/** The system administrator portal's sign-in (Owners only — other staff use the website sign-in). */
export async function adminLogin(email: string, password: string, remember = false): Promise<AdminLoginResult> {
  const response = await adminFetch<AdminStepResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password, remember }),
  });
  if ("requiresTwoFactor" in response || "requiresPasswordChange" in response) return response;
  return finishAdminSignIn(response, remember);
}

/** First sign-in with an invitation: replace the one-time password with your own. May still ask for a 2FA code. */
export async function adminFirstPassword(challenge: string, newPassword: string, remember = false): Promise<AdminLoginResult> {
  const response = await adminFetch<AdminStepResponse>("/auth/first-password", {
    method: "POST",
    body: JSON.stringify({ challenge, newPassword }),
  });
  if ("requiresTwoFactor" in response || "requiresPasswordChange" in response) return response;
  return finishAdminSignIn(response, remember);
}

/** "Confirm it's you" before sensitive actions (valid 10 minutes). */
export function adminConfirmIdentity(password: string, code?: string) {
  return adminFetch<{ confirmedUntil: string }>("/auth/confirm-identity", { method: "POST", body: JSON.stringify({ password, code: code || undefined }) });
}

/** Step two: the 6-digit authenticator code (or a one-time recovery code). */
export async function adminLoginTwoFactor(challenge: string, code: string, remember = false) {
  const response = await adminFetch<AdminAuthResponse>("/auth/login/2fa", {
    method: "POST",
    body: JSON.stringify({ challenge, code }),
  });
  return finishAdminSignIn(response, remember);
}

/** Confirms the stored admin is still signed in. Null = session ended; network trouble throws. */
export async function fetchAdminSession(): Promise<AdminUserSummary | null> {
  try {
    const { user } = await adminFetch<{ user: AdminUserSummary }>("/auth/session");
    return user;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}

/** Changes the admin's own password; the server re-issues this device's session (other devices are signed out). */
export async function adminChangePassword(currentPassword: string, newPassword: string) {
  const response = await adminFetch<AdminAuthResponse>("/auth/change-password", {
    method: "POST",
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  await settleSession("admin", response.token, isAdminRemembered());
  return response.user;
}

export function adminBeginTwoFactor() {
  return adminFetch<{ secret: string; otpauthUri: string }>("/auth/2fa/setup", { method: "POST", body: JSON.stringify({}) });
}

export function adminEnableTwoFactor(code: string) {
  return adminFetch<{ recoveryCodes: string[] }>("/auth/2fa/enable", { method: "POST", body: JSON.stringify({ code }) });
}

export function adminDisableTwoFactor(password: string, code: string) {
  return adminFetch<{ disabled: boolean }>("/auth/2fa/disable", { method: "POST", body: JSON.stringify({ password, code }) });
}

export function adminForgotPassword(email: string) {
  return adminFetch<{ requested: boolean }>("/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export function adminResetPassword(token: string, newPassword: string) {
  return adminFetch<{ reset: boolean }>("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token, newPassword }),
  });
}


/** Downloads a CSV export (spreadsheet) of requests or reviews. */
export async function downloadExport(type: string): Promise<void> {
  return downloadCsv(`/admin-tools/export/${encodeURIComponent(type)}`, `${type}.csv`);
}

/** Downloads any CSV the API offers (e.g. /purchases/export?…) as a file. */
export async function downloadCsv(path: string, fallbackName = "export.csv"): Promise<void> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      credentials: "include",
      headers: { ...authHeader("admin") },
    });
  } catch {
    throw new ApiError("Unable to reach the server. Please check your connection and try again.");
  }
  if (response.status === 401) {
    clearStoredUser();
    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    throw new ApiError("Your session has expired. Please log in again.", 401);
  }
  if (!response.ok) throw new ApiError(await parseErrorMessage(response), response.status);

  const filename = /filename="([^"]+)"/.exec(response.headers.get("content-disposition") ?? "")?.[1] ?? fallbackName;
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
