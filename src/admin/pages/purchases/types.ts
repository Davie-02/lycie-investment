import type { PaymentStatus, Purchase, PurchasePayment } from "@/utils/purchases";

/** A purchase as staff see it: the customer's view plus internal fields. */
export interface AdminPurchase extends Omit<Purchase, "vehicle"> {
  customer: { id: string; name: string; email: string; phone?: string | null };
  staffNote: string | null;
  createdByName: string | null;
  cancelledAt: string | null;
  deal: { id: string; title: string; status: string } | null;
  vehicle: { id: string; slug: string; make: string; model: string; year: number } | null;
  payments: Array<PurchasePayment & { exchangeRate: string | null; note: string | null; source: string; recordedByName: string | null; voidedAt: string | null; voidReason: string | null; voidedByName: string | null }>;
}

/** A row in the purchases list. */
export interface PurchaseRow {
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
  status: string;
  purchasedAt: string;
  dueDate: string | null;
  customer: { id: string; name: string; email: string };
}

export interface CurrencyTotals {
  currency: string;
  count: number;
  gross: string;
  discounts: string;
  total: string;
  paid: string;
  outstanding: string;
  overdue: number;
  overdueAmount: string;
  onOffer: number;
}

export interface PurchaseSummary {
  currencies: CurrencyTotals[];
  byType: Array<{ currency: string; type: string; count: number; total: string; outstanding: string }>;
  byPricing: Array<{ currency: string; pricing: string; count: number; total: string; discounts: string }>;
  collected: Array<{ currency: string; received: string; refunded: string; net: string; byMethod: Record<string, string> }>;
  cancelled: number;
}

export interface CustomerAccountRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  purchases: number;
  overdue: number;
  lastPurchaseAt: string | null;
  accountBalance: { amount: string; currency: string } | null;
  totals: Array<{ currency: string; purchased: string; paid: string; owed: string; saved: string }>;
}
