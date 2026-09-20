import type { Vehicle } from "@/types/vehicle";
import { ApiError } from "./http";
import { clearCsrfToken, fetchWithCsrf } from "./csrf";
import { parseErrorMessage } from "@/utils/apiError";

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
  const send = init.method && init.method !== "GET" ? fetchWithCsrf : fetch;
  let response: Response;

  try {
    response = await send(`${API_BASE_URL}${path}`, {
      ...init,
      credentials: "include",
      headers: {
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
    throw new ApiError(await parseErrorMessage(response), response.status);
  }

  return response.json() as Promise<T>;
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

export function getMyRequests() {
  return customerFetch<CustomerRequestSummary[]>("/customers/me/requests");
}

export function cancelHireRequest(id: string) {
  return customerFetch<{ status: string }>(`/hire-requests/${id}/cancel`, { method: "PATCH" });
}

export function updateCustomerProfile(updates: { name?: string; email?: string }) {
  return customerFetch<CustomerUser>("/customers/me", {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

export function changeCustomerPassword(currentPassword: string, newPassword: string) {
  return customerFetch<{ updated: boolean }>("/customers/me/change-password", {
    method: "POST",
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

export function forgotPassword(email: string) {
  return customerFetch<{ requested: boolean }>("/customers/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
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
