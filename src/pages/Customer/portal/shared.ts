/** Helpers shared by the customer portal's sections. */
import type { CustomerCase, CustomerRequestSummary } from "@/services/customer.service";

export const REQUEST_TYPE_LABELS: Record<CustomerRequestSummary["type"], string> = {
  inquiry: "Vehicle inquiry",
  import: "Import request",
  clearing: "Clearing request",
  hire: "Hire booking",
  contact: "Contact message",
};

/** Colour for a status pill. */
export function statusTone(status: string): string {
  if (["confirmed", "completed", "closed", "contacted"].includes(status)) return "portal-pill--good";
  if (status === "cancelled") return "portal-pill--bad";
  return "";
}

/** Shipments still on their way (not delivered or cancelled). */
export function activeShipments(cases: CustomerCase[]): CustomerCase[] {
  return cases.filter((c) => c.status !== "COMPLETED" && c.status !== "CANCELLED");
}

/** Requests still waiting on us or in progress. */
export function openRequests(requests: CustomerRequestSummary[]): CustomerRequestSummary[] {
  return requests.filter((r) => !["closed", "cancelled", "completed"].includes(r.status));
}
