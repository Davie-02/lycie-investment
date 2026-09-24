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

describe("paying against what's owed", () => {
  it("pays the purchase up to what's owed; the rest is extra", () => {
    const { splitPayment } = jest.requireActual("./purchase-math");
    const a = splitPayment(1200, 1000);
    expect([a.applied.toFixed(2), a.excess.toFixed(2)]).toEqual(["1000.00", "200.00"]);
    const b = splitPayment(300, 1000);
    expect([b.applied.toFixed(2), b.excess.toFixed(2)]).toEqual(["300.00", "0.00"]);
    const c = splitPayment(50, 0);
    expect([c.applied.toFixed(2), c.excess.toFixed(2)]).toEqual(["0.00", "50.00"]);
    const d = splitPayment(50, -20); // already overpaid
    expect([d.applied.toFixed(2), d.excess.toFixed(2)]).toEqual(["0.00", "50.00"]);
  });

  it("warns before paying: less, exact or more (counting proofs already sent)", () => {
    const { compareWithOwed } = jest.requireActual("./purchase-math");
    expect(compareWithOwed(500, 1000).status).toBe("less");
    expect(compareWithOwed(500, 1000).remaining.toFixed(2)).toBe("500.00");
    expect(compareWithOwed(1000, 1000).status).toBe("exact");
    const more = compareWithOwed(800, 1000, 400);
    expect(more.status).toBe("more");
    expect(more.excess.toFixed(2)).toBe("200.00");
  });
});
