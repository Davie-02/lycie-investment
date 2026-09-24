import type { Vehicle } from "@/types/vehicle";
import type { Purchase } from "@/utils/purchases";
import { ApiError } from "./http";
import { clearCsrfToken, fetchWithCsrf } from "./csrf";
import { authHeader, clearFallbackToken, settleSession } from "./sessionToken";
import { parseErrorMessage } from "@/utils/apiError";
import { finishAdminSignIn, setStoredUser, type AdminUserSummary } from "@/admin/adminApi";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001/api";
const CUSTOMER_USER_KEY = "lycie_customer_user";
/** "1" when the customer ticked "Keep me signed in" — read by the auth context to skip the idle logout. */
const CUSTOMER_REMEMBER_KEY = "lycie_customer_remember";
export const CUSTOMER_SESSION_EXPIRED_EVENT = "customer-session-expired";

export interface CustomerUser {
  id: string;
  name: string;
  email: string;
  isActive?: boolean;
  createdAt?: string;
  role?: "CUSTOMER";
  /** null/absent until the customer confirms their email address. */
  emailVerifiedAt?: string | null;
  /** For WhatsApp updates. */
  phone?: string | null;
}

export interface CustomerSession {
  user: CustomerUser;
}

/** What the server returns from every successful customer sign-in. */
interface CustomerAuthResponse {
  user: CustomerUser;
  /** Only used by the cookie-free fallback — see services/sessionToken.ts. */
  token?: string;
  expiresAt?: string;
}

export interface CustomerAccount {
  id: string;
  balance: string;
  currency: string;
  transactions: CustomerTransaction[];
  paymentSubmissions: PaymentSubmission[];
}

export interface CustomerTransaction {
  id: string;
  accountId: string;
  type: "DEPOSIT" | "WITHDRAWAL";
  amount: string;
  currency: string;
  reference: string;
  description: string | null;
  createdAt: string;
}

export interface PaymentSubmission {
  id: string;
  amount: string;
  currency: string;
  proofUrl: string;
  reference: string;
  note: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  reviewNote: string | null;
  createdAt: string;
  /** The purchase it was sent for, if any. */
  purchaseId?: string | null;
}

export interface CustomerRequestSummary {
  id: string;
  type: "inquiry" | "import" | "clearing" | "hire" | "contact";
  summary: string;
  status: string;
  createdAt: string;
  hireDetails?: {
    vehicleName: string;
    pickupDate: string;
    returnDate: string;
    days: number;
    totalCost: number;
    currency: string;
  };
}

export interface CustomerCase {
  id: string;
  title: string;
  status: "REQUESTED" | "IN_PROGRESS" | "READY" | "COMPLETED" | "CANCELLED";
  details: string | null;
  updatedAt: string;
  /** Shipment tracking (imports/clearing). */
  kind?: string;
  stage?: string | null;
  trackingCode?: string | null;
  eta?: string | null;
  vehicle: { make: string; model: string; year: number; images: string[] } | null;
  hireVehicle: { name: string; image: string } | null;
  updates: Array<{
    id: string;
    status: CustomerCase["status"];
    message: string;
    stage?: string | null;
    photos?: string[];
    createdAt: string;
  }>;
}

export function getStoredCustomer(): CustomerUser | null {
  const raw = localStorage.getItem(CUSTOMER_USER_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as CustomerUser;
  } catch {
    return null;
  }
}

export function storeCustomerSession(session: CustomerSession): void {
  localStorage.setItem(CUSTOMER_USER_KEY, JSON.stringify(session.user));
}

export function clearCustomerSession(): void {
  localStorage.removeItem(CUSTOMER_USER_KEY);
  localStorage.removeItem(CUSTOMER_REMEMBER_KEY);
  clearFallbackToken("customer");
}

export function isCustomerRemembered(): boolean {
  try {
    return localStorage.getItem(CUSTOMER_REMEMBER_KEY) === "1";
  } catch {
    return false;
  }
}

function setCustomerRemembered(remember: boolean): void {
  try {
    if (remember) localStorage.setItem(CUSTOMER_REMEMBER_KEY, "1");
    else localStorage.removeItem(CUSTOMER_REMEMBER_KEY);
  } catch {
    // Storage blocked: the idle logout simply stays on, which is the safe default.
  }
}

export function logoutCustomer() {
  return customerFetch<{ loggedOut: boolean }>("/customers/logout", { method: "POST" }).finally(
    clearCsrfToken
  );
}

/**
 * Routes where a 401 means "wrong details", not "your session ended" — so they
 * must not trigger the sign-out-and-show-"session expired" behaviour.
 */
const NO_EXPIRY_ROUTES = /^\/customers\/(login|register|forgot-password|reset-password|verify-email|social\/)/;

async function customerFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const send = init.method && init.method !== "GET" ? fetchWithCsrf : fetch;
  let response: Response;

  try {
    response = await send(`${API_BASE_URL}${path}`, {
      ...init,
      credentials: "include",
      headers: {
        ...(init.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
        // Empty in normal (cookie) mode; carries the token when cookies are blocked.
        ...authHeader("customer"),
        ...init.headers,
      },
    });
  } catch {
    throw new ApiError("Unable to reach the server. Please check your connection and try again.");
  }

  if (!response.ok) {
    if (response.status === 401 && !NO_EXPIRY_ROUTES.test(path)) {
      clearCustomerSession();
      window.dispatchEvent(new Event(CUSTOMER_SESSION_EXPIRED_EVENT));
    }
    throw new ApiError(await parseErrorMessage(response), response.status);
  }

  return response.json() as Promise<T>;
}

/**
 * Common ending of every way of signing in: works out whether the cookie or
 * the header fallback carries this session, and remembers the "keep me
 * signed in" choice.
 */
async function finishSignIn(response: CustomerAuthResponse, remember: boolean): Promise<CustomerSession> {
  await settleSession("customer", response.token, remember);
  setCustomerRemembered(remember);
  return { user: response.user };
}

export async function registerCustomer(name: string, email: string, password: string, remember = false, referralCode?: string) {
  const response = await customerFetch<CustomerAuthResponse>("/customers/register", {
    method: "POST",
    body: JSON.stringify({ name, email, password, remember, referralCode: referralCode || undefined }),
  });
  return finishSignIn(response, remember);
}

export async function loginCustomer(email: string, password: string, remember = false) {
  const response = await customerFetch<CustomerAuthResponse>("/customers/login", {
    method: "POST",
    body: JSON.stringify({ email, password, remember }),
  });
  return finishSignIn(response, remember);
}

/** What the website's one sign-in form can lead to (POST /sign-in serves customers and staff). */
export type SignInOutcome =
  | { kind: "customer"; session: CustomerSession }
  | { kind: "staff" }
  | { kind: "two-factor"; challenge: string }
  | { kind: "password-change"; challenge: string; name: string };

/**
 * The shared sign-in. Customers get their session here; staff accounts get a
 * staff session (handled by the workspace's own code, loaded only when needed)
 * or a further step (authenticator code / choose your own password).
 */
export async function signInAnyone(email: string, password: string, remember = false): Promise<SignInOutcome> {
  type Response =
    | ({ kind: "customer" } & CustomerAuthResponse)
    | { kind: "staff"; user: AdminUserSummary; token?: string }
    | { kind: "two-factor"; challenge: string }
    | { kind: "password-change"; challenge: string; name: string };
  const response = await customerFetch<Response>("/sign-in", { method: "POST", body: JSON.stringify({ email, password, remember }) });
  if (response.kind === "customer") return { kind: "customer", session: await finishSignIn(response, remember) };
  if (response.kind === "staff") {
    await completeStaffSignIn(response, remember);
    return { kind: "staff" };
  }
  return response;
}

/** Stores a staff session the same way the workspace's own sign-in does. */
export async function completeStaffSignIn(response: { user: AdminUserSummary; token?: string }, remember: boolean): Promise<void> {
  clearCustomerSession();
  const { user } = await finishAdminSignIn(response, remember);
  setStoredUser(user);
}

/** "Continue with Google": `credential` is the signed ID token Google's button hands back. */
export async function loginWithGoogle(credential: string, remember = false) {
  const response = await customerFetch<CustomerAuthResponse>("/customers/social/google", {
    method: "POST",
    body: JSON.stringify({ credential, remember }),
  });
  return finishSignIn(response, remember);
}

/** "Continue with Facebook": `accessToken` comes from Facebook's login dialog. */
export async function loginWithFacebook(accessToken: string, remember = false) {
  const response = await customerFetch<CustomerAuthResponse>("/customers/social/facebook", {
    method: "POST",
    body: JSON.stringify({ accessToken, remember }),
  });
  return finishSignIn(response, remember);
}

/**
 * Asks the server whether the remembered customer is still signed in.
 * Returns the fresh user, or null if the session has ended. Network trouble
 * throws, so the caller can keep showing the last known state instead of
 * signing someone out because their phone briefly lost signal.
 */
export async function fetchCustomerSession(): Promise<CustomerUser | null> {
  try {
    const { user } = await customerFetch<{ user: CustomerUser }>("/customers/session");
    return user;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}

export function verifyCustomerEmail(token: string) {
  return customerFetch<{ verified: boolean }>("/customers/verify-email", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}

export function resendVerificationEmail() {
  return customerFetch<{ sent: boolean }>("/customers/me/resend-verification", { method: "POST" });
}

export function getCustomerAccount() {
  return customerFetch<CustomerAccount>("/financial/me");
}

export function getCustomerCases() {
  return customerFetch<CustomerCase[]>("/customers/me/cases");
}

export function getMyRequests() {
  return customerFetch<CustomerRequestSummary[]>("/customers/me/requests");
}

export function cancelHireRequest(id: string) {
  return customerFetch<{ status: string }>(`/hire-requests/${id}/cancel`, { method: "PATCH" });
}

export function updateCustomerProfile(updates: { name?: string; email?: string; phone?: string }) {
  return customerFetch<CustomerUser>("/customers/me", {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

/**
 * Changing the password signs every OTHER device out, so the server returns a
 * fresh session for this one — it has to be re-settled or this device would be
 * signed out too.
 */
export async function changeCustomerPassword(currentPassword: string, newPassword: string) {
  const response = await customerFetch<CustomerAuthResponse & { updated: boolean }>("/customers/me/change-password", {
    method: "POST",
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  await settleSession("customer", response.token, isCustomerRemembered());
  return { updated: response.updated };
}

/**
 * The website's "Forgot your password?" serves customers and staff alike:
 * both reset requests are sent. Each always answers the same way whether or
 * not an account exists, so this reveals nothing. A staff member's email links
 * to the workspace's reset page.
 */
export async function forgotPassword(email: string) {
  const staff = fetchWithCsrf(`${API_BASE_URL}/auth/forgot-password`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  }).catch(() => undefined);
  const result = await customerFetch<{ requested: boolean }>("/customers/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
  await staff;
  return result;
}

export function resetPassword(token: string, newPassword: string) {
  return customerFetch<{ reset: boolean }>("/customers/reset-password", {
    method: "POST",
    body: JSON.stringify({ token, newPassword }),
  });
}

export interface SavedVehicle {
  id: string;
  vehicleId: string;
  createdAt: string;
  vehicle: Vehicle;
}

export function getSavedVehicles() {
  return customerFetch<SavedVehicle[]>("/customers/me/saved-vehicles");
}

export function saveVehicle(vehicleId: string) {
  return customerFetch<SavedVehicle>(`/customers/me/saved-vehicles/${vehicleId}`, {
    method: "POST",
  });
}

export function unsaveVehicle(vehicleId: string) {
  return customerFetch<{ deleted: boolean }>(`/customers/me/saved-vehicles/${vehicleId}`, {
    method: "DELETE",
  });
}

export function submitPayment(amount: number, proof: File, note?: string, purchaseId?: string) {
  const body = new FormData();
  body.append("amount", String(amount));
  body.append("proof", proof);
  if (note) body.append("note", note);
  if (purchaseId) body.append("purchaseId", purchaseId);

  return customerFetch<PaymentSubmission>("/financial/me/payment-submissions", {
    method: "POST",
    body,
  });
}

export interface CustomerMessage {
  id: string;
  subject: string;
  body: string;
  sentByName: string;
  readAt: string | null;
  createdAt: string;
}

export function getMyMessages() {
  return customerFetch<{ items: CustomerMessage[]; unread: number }>("/customers/me/messages");
}

export function markMessagesRead() {
  return customerFetch<{ marked: number }>("/customers/me/messages/read", { method: "POST", body: JSON.stringify({}) });
}

/** Signs out every other device and browser; this one stays signed in with a fresh session. */
export async function signOutEverywhere(): Promise<void> {
  const response = await customerFetch<CustomerAuthResponse>("/customers/me/sign-out-everywhere", { method: "POST", body: JSON.stringify({}) });
  await settleSession("customer", response.token, isCustomerRemembered());
}

/** "Email me when a matching vehicle is listed." */
export interface VehicleAlert {
  id: string;
  make: string | null;
  model: string | null;
  bodyType: string | null;
  maxPrice: number | null;
  minYear: number | null;
  isActive: boolean;
  label: string;
  sentCount: number;
  lastSentAt: string | null;
  createdAt: string;
}

export interface NewVehicleAlert {
  make?: string;
  model?: string;
  bodyType?: string;
  maxPrice?: number;
  minYear?: number;
}

export function getVehicleAlerts() {
  return customerFetch<VehicleAlert[]>("/customers/me/alerts");
}

export function createVehicleAlert(alert: NewVehicleAlert) {
  return customerFetch<VehicleAlert>("/customers/me/alerts", { method: "POST", body: JSON.stringify(alert) });
}

export function setVehicleAlertActive(id: string, isActive: boolean) {
  return customerFetch<{ updated: boolean }>(`/customers/me/alerts/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ isActive }),
  });
}

export function deleteVehicleAlert(id: string) {
  return customerFetch<{ deleted: boolean }>(`/customers/me/alerts/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export interface MobilePaymentView {
  txRef: string;
  amount: number;
  currency: string;
  status: "pending" | "success" | "failed";
  purpose: string;
  confirmedAt: string | null;
}

/** Whether mobile money payments are switched on (public). */
export async function mobileMoneyEnabled(): Promise<boolean> {
  try {
    return (await customerFetch<{ enabled: boolean }>("/payments/mobile/status")).enabled;
  } catch {
    return false;
  }
}

/** Starts a mobile money payment; the browser then goes to the returned checkout page. */
export function startMobilePayment(amount: number, purpose: string, note?: string) {
  return customerFetch<{ txRef: string; checkoutUrl: string }>("/payments/mobile", { method: "POST", body: JSON.stringify({ amount, purpose, note }) });
}

export function confirmMobilePayment(txRef: string) {
  return customerFetch<MobilePaymentView>(`/payments/mobile/${encodeURIComponent(txRef)}/confirm`, { method: "POST", body: "{}" });
}

export function getMyMobilePayments() {
  return customerFetch<Array<MobilePaymentView & { note: string; createdAt: string }>>("/payments/mobile/mine");
}

export interface MyReferral {
  code: string;
  link: string;
  invited: number;
  rewarded: number;
  rewardsTotal: number;
}

export function getMyReferral() {
  return customerFetch<MyReferral>("/customers/me/referral");
}

// ── Purchases ────────────────────────────────────────────────────────────

export function getMyPurchases() {
  return customerFetch<Purchase[]>("/customers/me/purchases");
}

/** Pays part of a purchase from the account balance. `amount` is in the balance's currency. */
export function payPurchaseFromBalance(purchaseId: string, amount: number) {
  return customerFetch<Purchase>(`/customers/me/purchases/${encodeURIComponent(purchaseId)}/apply-balance`, { method: "POST", body: JSON.stringify({ amount }) });
}

/** Mobile money toward one purchase (kwacha; the server checks it isn't more than is owed). */
export function startPurchaseMobilePayment(purchaseId: string, amount: number) {
  return customerFetch<{ txRef: string; checkoutUrl: string }>("/payments/mobile", { method: "POST", body: JSON.stringify({ amount, purpose: "other", purchaseId }) });
}
