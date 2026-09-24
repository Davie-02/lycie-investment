/**
 * Words and helpers for customers' purchases, shared by the staff Finance pages
 * and the customer's "My purchases". Money arrives from the API as strings
 * (exact decimals); it's only turned into numbers for display.
 */
export const PURCHASE_TYPES: Record<string, string> = {
  vehicle: "Vehicle purchase",
  import: "Vehicle import",
  clearing: "Clearing",
  hire: "Vehicle hire",
  parts: "Parts",
  service: "Service",
  other: "Other",
};

export const PRICING_LABELS: Record<string, string> = {
  standard: "Standard price",
  deal: "Deal",
  promotion: "Promotion",
  discount: "Discount",
};

export const ITEM_CATEGORIES: Record<string, string> = {
  vehicle: "Vehicle",
  shipping: "Shipping",
  duty: "Duty & taxes",
  clearing: "Clearing fees",
  registration: "Registration & plates",
  hire: "Hire",
  insurance: "Insurance",
  parts: "Parts",
  service: "Service / labour",
  fee: "Other fee",
  other: "Other",
};

export const PAYMENT_METHODS: Record<string, string> = {
  cash: "Cash",
  bank: "Bank transfer",
  mobile_money: "Mobile money",
  card: "Card",
  cheque: "Cheque",
  account_balance: "Account balance",
  other: "Other",
};

export type PaymentStatus = "unpaid" | "partial" | "paid" | "overpaid" | "overdue" | "cancelled";

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  unpaid: "Not paid yet",
  partial: "Part paid",
  paid: "Paid in full",
  overpaid: "Overpaid",
  overdue: "Overdue",
  cancelled: "Cancelled",
};

/** good / bad / warn / neutral — mapped to each area's own chip classes. */
export function paymentTone(status: PaymentStatus): "good" | "bad" | "warn" | "" {
  if (status === "paid") return "good";
  if (status === "overdue") return "bad";
  if (status === "partial" || status === "overpaid") return "warn";
  return "";
}

export function money(amount: string | number | null | undefined, currency: string): string {
  const value = Number(amount ?? 0);
  return `${currency} ${value.toLocaleString("en-US", { minimumFractionDigits: Number.isInteger(value) ? 0 : 2, maximumFractionDigits: 2 })}`;
}

/** How much of the total is paid, 0–100 (for progress bars). */
export function paidPercent(total: string | number, paid: string | number): number {
  const t = Number(total);
  if (t <= 0) return 100;
  return Math.max(0, Math.min(100, Math.round((Number(paid) / t) * 100)));
}

export interface PurchaseItem {
  id: string;
  category: string;
  description: string;
  quantity: number;
  unitPrice: string;
  amount: string;
}

export interface PurchasePayment {
  id: string;
  kind: "payment" | "refund";
  amount: string;
  method: string;
  reference: string | null;
  paidAt: string;
  receivedAmount: string | null;
  receivedCurrency: string | null;
  /** Staff views only. */
  exchangeRate?: string | null;
  note?: string | null;
  source?: string;
  recordedByName?: string | null;
  voidedAt?: string | null;
  voidReason?: string | null;
  voidedByName?: string | null;
  createdAt?: string;
}

export interface Purchase {
  id: string;
  reference: string;
  type: string;
  title: string;
  currency: string;
  subtotal: string;
  pricing: string;
  offerName: string | null;
  promoCode: string | null;
  discountAmount: string;
  total: string;
  amountPaid: string;
  balance: string;
  paymentStatus: PaymentStatus;
  status: "active" | "cancelled";
  purchasedAt: string;
  dueDate: string | null;
  customerNote: string | null;
  cancelReason: string | null;
  items: PurchaseItem[];
  payments: PurchasePayment[];
  shipment: { id: string; title: string; stage: string | null } | null;
  vehicle: { slug: string; id?: string; make?: string; model?: string; year?: number } | null;
}
