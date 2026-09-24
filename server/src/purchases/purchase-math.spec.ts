import { Prisma } from "@prisma/client";
import { balanceOf, convertReceived, discountFor, effectivePricing, paymentStatus, priceItems, signedAmount } from "./purchase-math";

const D = Prisma.Decimal;

describe("purchase arithmetic", () => {
  it("adds up cost lines to the cent, without float errors", () => {
    const { items, subtotal } = priceItems([
      { category: "vehicle", description: " Toyota Hilux ", quantity: 1, unitPrice: 18500.1 },
      { category: "fee", description: "Plates", quantity: 3, unitPrice: 0.1 },
      { category: "shipping", description: "Shipping", quantity: 1, unitPrice: "1200.20" },
    ]);
    expect(subtotal.toFixed(2)).toBe("19700.60");
    expect(items[1].amount.toFixed(2)).toBe("0.30");
    expect(items[0].description).toBe("Toyota Hilux");
    expect(items.map((i) => i.sortOrder)).toEqual([0, 1, 2]);
  });

  it("works out discounts as an amount or a percentage, never more than the price", () => {
    const subtotal = new D("20000");
    expect(discountFor(subtotal, "percent", 7.5).toFixed(2)).toBe("1500.00");
    expect(discountFor(subtotal, "amount", 950).toFixed(2)).toBe("950.00");
    expect(discountFor(subtotal, "amount", 25000).toFixed(2)).toBe("20000.00");
    expect(discountFor(subtotal, "percent", 150).toFixed(2)).toBe("20000.00");
    expect(discountFor(subtotal, undefined, 10).toFixed(2)).toBe("0.00");
    expect(discountFor(subtotal, "amount", 0).toFixed(2)).toBe("0.00");
  });

  it("labels how the purchase was priced", () => {
    expect(effectivePricing(undefined, new D(0))).toBe("standard");
    expect(effectivePricing("standard", new D(100))).toBe("discount");
    expect(effectivePricing("standard", new D(0), "deal1")).toBe("deal");
    expect(effectivePricing("promotion", new D(0))).toBe("promotion");
    expect(effectivePricing("discount", new D(0))).toBe("standard");
    expect(effectivePricing("deal", new D(500), "deal1")).toBe("deal");
  });

  it("knows unpaid, part-paid, paid, overpaid, overdue and cancelled", () => {
    const now = new Date("2026-09-27T12:00:00Z");
    const base = { status: "active", total: new D(1000), dueDate: null };
    expect(paymentStatus({ ...base, amountPaid: new D(0) }, now)).toBe("unpaid");
    expect(paymentStatus({ ...base, amountPaid: new D(400) }, now)).toBe("partial");
    expect(paymentStatus({ ...base, amountPaid: new D(1000) }, now)).toBe("paid");
    expect(paymentStatus({ ...base, amountPaid: new D(1200) }, now)).toBe("overpaid");
    expect(paymentStatus({ ...base, amountPaid: new D(400), dueDate: new Date("2026-09-01") }, now)).toBe("overdue");
    expect(paymentStatus({ ...base, amountPaid: new D(1000), dueDate: new Date("2026-09-01") }, now)).toBe("paid");
    expect(paymentStatus({ ...base, status: "cancelled", amountPaid: new D(0) }, now)).toBe("cancelled");
    expect(balanceOf("1000", "250.5").toFixed(2)).toBe("749.50");
  });

  it("converts money paid in another currency and signs refunds", () => {
    expect(convertReceived(1_750_000, 1750).toFixed(2)).toBe("1000.00");
    expect(convertReceived(100, 3).toFixed(2)).toBe("33.33");
    expect(() => convertReceived(100, 0)).toThrow();
    expect(signedAmount("refund", 50).toFixed(2)).toBe("-50.00");
    expect(signedAmount("payment", 50).toFixed(2)).toBe("50.00");
  });
});
