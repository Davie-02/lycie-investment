import { apiPost } from "./http";
import type {
  InquiryRequest,
  ImportRequest,
  ClearingRequest,
  HireRequest,
  ContactMessage,
} from "@/types/requests";

export async function submitInquiry(payload: InquiryRequest): Promise<void> {
  await apiPost<unknown>("/inquiries", payload);
}

export async function submitImportRequest(payload: ImportRequest): Promise<void> {
  await apiPost<unknown>("/import-requests", payload);
}

export async function submitClearingRequest(payload: ClearingRequest): Promise<void> {
  await apiPost<unknown>("/clearing-requests", payload);
}

export async function submitHireRequest(payload: HireRequest): Promise<void> {
  await apiPost<unknown>("/hire-requests", payload);
}

export async function submitContactMessage(payload: ContactMessage): Promise<void> {
  await apiPost<unknown>("/contact-messages", payload);
}
