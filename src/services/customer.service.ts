import { ApiError } from "./http";
import { clearCsrfToken, getCsrfToken } from "./csrf";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001/api";
const CUSTOMER_USER_KEY = "lycie_customer_user";
export const CUSTOMER_SESSION_EXPIRED_EVENT = "customer-session-expired";

export interface CustomerUser {
  id: string;
  name: string;
  email: string;
  isActive?: boolean;
  createdAt?: string;
  role?: "CUSTOMER";
}

export interface CustomerSession {
  user: CustomerUser;
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
}

export interface CustomerCase {
  id: string;
  title: string;
  status: "REQUESTED" | "IN_PROGRESS" | "READY" | "COMPLETED" | "CANCELLED";
  details: string | null;
  updatedAt: string;
  vehicle: { make: string; model: string; year: number; images: string[] } | null;
  hireVehicle: { name: string; image: string } | null;
  updates: Array<{
    id: string;
    status: CustomerCase["status"];
    message: string;
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
}

export function logoutCustomer() {
  return customerFetch<{ loggedOut: boolean }>("/customers/logout", { method: "POST" }).finally(
    clearCsrfToken
  );
}

async function customerFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const csrfToken = init.method && init.method !== "GET" ? await getCsrfToken() : null;
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      credentials: "include",
      headers: {
        ...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
        ...(init.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
        ...init.headers,
      },
    });
  } catch {
    throw new ApiError("Unable to reach the server. Please check your connection and try again.");
  }

  if (!response.ok) {
    if (response.status === 401) {
      clearCustomerSession();
      window.dispatchEvent(new Event(CUSTOMER_SESSION_EXPIRED_EVENT));
    }
    throw new ApiError(await getErrorMessage(response), response.status);
  }

  return response.json() as Promise<T>;
}

async function getErrorMessage(response: Response): Promise<string> {
  try {
    const body = await response.json();
    if (Array.isArray(body?.message)) return body.message.join(" ");
    if (typeof body?.message === "string") return body.message;
  } catch {
    // Use a generic message when the response is not JSON.
  }

  return `Request failed (${response.status}).`;
}

export function registerCustomer(name: string, email: string, password: string) {
  return customerFetch<CustomerSession>("/customers/register", {
    method: "POST",
    body: JSON.stringify({ name, email, password }),
  });
}

export function loginCustomer(email: string, password: string) {
  return customerFetch<CustomerSession>("/customers/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function getCustomerAccount() {
  return customerFetch<CustomerAccount>("/financial/me");
}

export function getCustomerCases() {
  return customerFetch<CustomerCase[]>("/customers/me/cases");
}

export function submitPayment(amount: number, proof: File, note?: string) {
  const body = new FormData();
  body.append("amount", String(amount));
  body.append("proof", proof);
  if (note) body.append("note", note);

  return customerFetch<PaymentSubmission>("/financial/me/payment-submissions", {
    method: "POST",
    body,
  });
}