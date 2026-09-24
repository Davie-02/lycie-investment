/**
 * The arithmetic of a purchase, kept free of the database so it can be tested
 * on its own: cost lines → subtotal, the discount (an amount or a percentage),
 * the total owed, and whether it is unpaid, part-paid, paid or overdue.
 * All money is Prisma.Decimal and rounded to cents — never JavaScript floats.
 */
import { Prisma } from "@prisma/client";

const D = Prisma.Decimal;
type Decimal = Prisma.Decimal;
type Value = Prisma.Decimal.Value;

export const PURCHASE_TYPES = ["vehicle", "import", "clearing", "hire", "parts", "service", "other"] as const;
export const PRICING_KINDS = ["standard", "deal", "promotion", "discount"] as const;
export const ITEM_CATEGORIES = ["vehicle", "shipping", "duty", "clearing", "registration", "hire", "insurance", "parts", "service", "fee", "other"] as const;
export const PAYMENT_METHODS = ["cash", "bank", "mobile_money", "card", "cheque", "account_balance", "other"] as const;

export type PaymentStatus = "unpaid" | "partial" | "paid" | "overpaid" | "overdue" | "cancelled";

export interface ItemInput {
  category: string;
  description: string;
  quantity: number;
  unitPrice: number | string;
}

export interface PricedItem {
  category: string;
  description: string;
  quantity: number;
  unitPrice: Decimal;
  amount: Decimal;
  sortOrder: number;
}

export const cents = (value: Value): Decimal => new D(value).toDecimalPlaces(2, D.ROUND_HALF_UP);

export function priceItems(items: ItemInput[]): { items: PricedItem[]; subtotal: Decimal } {
  const priced = items.map((item, index) => {
    const unitPrice = cents(item.unitPrice);
    return {
      category: item.category,
      description: item.description.trim(),
      quantity: item.quantity,
      unitPrice,
      amount: cents(unitPrice.mul(item.quantity)),
      sortOrder: index,
    };
  });
  const subtotal = priced.reduce((sum, item) => sum.add(item.amount), new D(0));
  return { items: priced, subtotal };
}

/**
 * The discount in money. `percent` is 0–100 of the subtotal; `amount` is a
 * fixed sum. Never more than the subtotal, never negative.
 */
export function discountFor(subtotal: Decimal, kind: "amount" | "percent" | undefined, value: number | string | undefined): Decimal {
  if (!kind || value === undefined || value === "" || new D(value).lte(0)) return new D(0);
  const raw = kind === "percent" ? subtotal.mul(D.min(new D(value), 100)).div(100) : new D(value);
  return cents(D.min(raw, subtotal));
}

/**
 * "standard" with a discount is really a discount; a linked deal with no
 * kind chosen is a deal. Staff shouldn't have to pick both for it to be right.
 */
export function effectivePricing(pricing: string | undefined, discount: Decimal, dealId?: string | null): string {
  const chosen = pricing ?? "standard";
  // A "discount" of nothing isn't one. Deals and promotions may have no separate
  // discount line (the offer price is already in the cost lines), so they stay.
  if (chosen === "discount" && discount.lte(0)) return dealId ? "deal" : "standard";
  if (chosen !== "standard") return chosen;
  if (dealId) return "deal";
  return discount.gt(0) ? "discount" : "standard";
}

export function balanceOf(total: Value, amountPaid: Value): Decimal {
  return new D(total).sub(new D(amountPaid));
}

export function paymentStatus(p: { status: string; total: Value; amountPaid: Value; dueDate?: Date | null }, now = new Date()): PaymentStatus {
  if (p.status === "cancelled") return "cancelled";
  const balance = balanceOf(p.total, p.amountPaid);
  if (balance.lt(0)) return "overpaid";
  if (balance.eq(0)) return "paid";
  if (p.dueDate && p.dueDate.getTime() < now.getTime()) return "overdue";
  return new D(p.amountPaid).gt(0) ? "partial" : "unpaid";
}

/** Converts money received in another currency. `rate` = units of the received currency per 1 of the purchase currency. */
export function convertReceived(receivedAmount: Value, rate: Value): Decimal {
  const r = new D(rate);
  if (r.lte(0)) throw new Error("Exchange rate must be above zero.");
  return cents(new D(receivedAmount).div(r));
}

/** Signed effect of a payment row on amountPaid (refunds reduce it). */
export function signedAmount(kind: string, amount: Value): Decimal {
  return kind === "refund" ? new D(amount).neg() : new D(amount);
}
