/**
 * Customers' purchases: what each one bought (type and every cost line), the
 * price before and after any deal, promotion or discount, every payment and
 * refund, and the balance still owed.
 *
 * Money rules:
 *  - `amountPaid` only changes inside the same serializable transaction as the
 *    PurchasePayment row that explains it, so the two can never disagree.
 *  - Payments are never deleted; a mistake is voided with a reason.
 *  - Money from elsewhere (mobile money, an approved proof, the customer's
 *    account balance) carries its own reference in `sourceRef`, which is
 *    unique, so the same money can't be counted twice.
 */
import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { randomBytes } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { PricingService } from "../pricing/pricing.service";
import { NotificationsService } from "../notifications/notifications.service";
import { EventsService } from "../events/events.service";
import { runSerializable } from "../common/run-serializable";
import { toCsv } from "../admin-tools/csv.util";
import { purchaseRecordedEmail, purchasePaymentReceiptEmail } from "../email/email-templates";
import type { StaffActor } from "../access/current-staff.decorator";
import {
  balanceOf,
  cents,
  convertReceived,
  discountFor,
  effectivePricing,
  paymentStatus,
  priceItems,
  signedAmount,
  type PaymentStatus,
} from "./purchase-math";
import type { ApplyBalanceDto, CreatePurchaseDto, PurchaseListQuery, RecordPaymentDto, UpdatePurchaseDto } from "./purchases.dto";

const D = Prisma.Decimal;
type Tx = Prisma.TransactionClient;

export const TYPE_LABEL: Record<string, string> = {
  vehicle: "Vehicle purchase",
  import: "Vehicle import",
  clearing: "Clearing",
  hire: "Vehicle hire",
  parts: "Parts",
  service: "Service",
  other: "Other",
};

const METHOD_LABEL: Record<string, string> = {
  cash: "Cash",
  bank: "Bank transfer",
  mobile_money: "Mobile money",
  card: "Card",
  cheque: "Cheque",
  account_balance: "Account balance",
  other: "Other",
};

const detailInclude = {
  customer: { select: { id: true, name: true, email: true, phone: true } },
  items: { orderBy: { sortOrder: "asc" } },
  payments: { orderBy: { paidAt: "asc" } },
  deal: { select: { id: true, title: true, status: true } },
  vehicle: { select: { id: true, slug: true, make: true, model: true, year: true } },
  shipment: { select: { id: true, title: true, stage: true } },
} satisfies Prisma.PurchaseInclude;

type PurchaseDetail = Prisma.PurchaseGetPayload<{ include: typeof detailInclude }>;
type Actor = Pick<StaffActor, "sub" | "name">;

/** A purchase ready for JSON: money as strings, plus balance and payment status. */
function withBalance<T extends { total: Prisma.Decimal; amountPaid: Prisma.Decimal; status: string; dueDate: Date | null }>(p: T) {
  return { ...p, balance: balanceOf(p.total, p.amountPaid).toFixed(2), paymentStatus: paymentStatus(p) };
}

const money = (amount: Prisma.Decimal.Value, currency: string) =>
  `${currency} ${new D(amount).toNumber().toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

@Injectable()
export class PurchasesService {
  private readonly logger = new Logger(PurchasesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
    private readonly notifications: NotificationsService,
    private readonly events: EventsService
  ) {}

  // ─── Exchange rates ────────────────────────────────────────────────────

  /**
   * Units of `paidIn` per 1 unit of `purchaseCurrency`, from the site's rate
   * (Finance → Prices & currency). Only dollars ↔ kwacha are known; null otherwise.
   */
  async autoRate(purchaseCurrency: string, paidIn: string): Promise<Prisma.Decimal | null> {
    if (purchaseCurrency === paidIn) return new D(1);
    const pair = `${purchaseCurrency}->${paidIn}`;
    if (pair !== "USD->MWK" && pair !== "MWK->USD") return null;
    const { rate } = await this.pricing.getEffectiveRate();
    if (!rate) return null;
    return pair === "USD->MWK" ? new D(rate) : new D(1).div(rate);
  }

  // ─── Creating and changing purchases ──────────────────────────────────

  private async nextReference(tx: Tx): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `PUR-${year}-`;
    const last = await tx.purchase.findFirst({ where: { reference: { startsWith: prefix } }, orderBy: { reference: "desc" }, select: { reference: true } });
    const next = (last ? Number(last.reference.slice(prefix.length)) || 0 : 0) + 1;
    return `${prefix}${String(next).padStart(4, "0")}`;
  }

  /** Checks linked records exist (and a shipment belongs to this customer). */
  private async checkLinks(customerId: string, dto: { dealId?: string | null; vehicleId?: string | null; caseId?: string | null }) {
    const [deal, vehicle, shipment] = await Promise.all([
      dto.dealId ? this.prisma.deal.findUnique({ where: { id: dto.dealId }, select: { id: true, title: true } }) : null,
      dto.vehicleId ? this.prisma.vehicle.findUnique({ where: { id: dto.vehicleId }, select: { id: true } }) : null,
      dto.caseId ? this.prisma.customerCase.findUnique({ where: { id: dto.caseId }, select: { customerId: true } }) : null,
    ]);
    if (dto.dealId && !deal) throw new BadRequestException("That deal no longer exists.");
    if (dto.vehicleId && !vehicle) throw new BadRequestException("That vehicle no longer exists.");
    if (dto.caseId && shipment?.customerId !== customerId) throw new BadRequestException("That shipment belongs to a different customer.");
    return { deal };
  }

  async create(dto: CreatePurchaseDto, actor: Actor) {
    const customer = await this.prisma.customerUser.findUnique({ where: { id: dto.customerId }, select: { id: true, name: true, email: true, phone: true } });
    if (!customer) throw new NotFoundException("Customer not found.");
    const { deal } = await this.checkLinks(customer.id, dto);

    const { items, subtotal } = priceItems(dto.items);
    const discountAmount = discountFor(subtotal, dto.discountType, dto.discountValue);
    const pricing = effectivePricing(dto.pricing, discountAmount, dto.dealId);
    const total = subtotal.sub(discountAmount);
    const currency = dto.currency ?? "USD";

    // The initial deposit is converted before the transaction (the rate may need a network call).
    const initial = dto.initialPayment ? await this.preparePayment(currency, dto.initialPayment) : null;

    const created = await this.withReferenceRetry(() =>
      runSerializable(this.prisma, async (tx) => {
        const purchase = await tx.purchase.create({
          data: {
            reference: await this.nextReference(tx),
            customerId: customer.id,
            type: dto.type,
            title: dto.title,
            currency,
            subtotal,
            pricing,
            offerName: dto.offerName || (pricing === "deal" ? deal?.title : null) || null,
            promoCode: dto.promoCode || null,
            dealId: dto.dealId || null,
            discountAmount,
            total,
            purchasedAt: dto.purchasedAt ? new Date(dto.purchasedAt) : new Date(),
            dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
            vehicleId: dto.vehicleId || null,
            caseId: dto.caseId || null,
            sourceType: dto.sourceType || null,
            sourceId: dto.sourceId || null,
            customerNote: dto.customerNote || null,
            staffNote: dto.staffNote || null,
            createdById: actor.sub,
            createdByName: actor.name,
            items: { create: items },
          },
        });
        if (initial) await this.addPayment(tx, purchase.id, { ...initial, source: "staff", recordedById: actor.sub, recordedByName: actor.name });
        if (dto.markVehicleSold && dto.vehicleId) await tx.vehicle.update({ where: { id: dto.vehicleId }, data: { status: "sold" } });
        return purchase;
      })
    );

    // The listing now says "sold" on every open page.
    if (dto.markVehicleSold && dto.vehicleId) this.events.emit(["vehicles"]);

    const detail = await this.get(created.id);
    if (dto.notifyCustomer !== false) {
      const mail = purchaseRecordedEmail({
        name: customer.name,
        reference: detail.reference,
        title: detail.title,
        total: money(detail.total, currency),
        paid: money(detail.amountPaid, currency),
        balance: money(detail.balance, currency),
        saving: new D(detail.discountAmount).gt(0) ? money(detail.discountAmount, currency) : null,
        accountUrl: `${process.env.FRONTEND_URL ?? "http://localhost:5173"}/account/purchases`,
      });
      void this.notifications.notify({
        email: customer.email,
        phone: customer.phone,
        ...mail,
        text: `Your purchase ${detail.reference} (${detail.title}) is in your Lycie account: total ${money(detail.total, currency)}, balance ${money(detail.balance, currency)}.`,
      });
    }
    return detail;
  }

  /** Two people creating a purchase at the same moment could pick the same number; the second simply tries again. */
  private async withReferenceRetry<T>(work: () => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await work();
      } catch (error) {
        const clash = error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002" && String(error.meta?.target ?? "").includes("reference");
        if (!clash || attempt >= 3) throw error;
      }
    }
  }

  async update(id: string, dto: UpdatePurchaseDto) {
    const existing = await this.prisma.purchase.findUnique({ where: { id }, include: { items: { orderBy: { sortOrder: "asc" } } } });
    if (!existing) throw new NotFoundException("Purchase not found.");
    if (existing.status === "cancelled") throw new ConflictException("This purchase is cancelled. Undo the cancellation first to change it.");
    const { deal } = await this.checkLinks(existing.customerId, dto);

    const itemsInput = dto.items ?? existing.items.map((i) => ({ ...i, unitPrice: i.unitPrice.toString() }));
    const { items, subtotal } = priceItems(itemsInput);
    // Keep the old discount unless a new one is given; a percentage is re-applied to the new subtotal.
    const discountAmount =
      dto.discountType !== undefined || dto.discountValue !== undefined
        ? discountFor(subtotal, dto.discountType ?? "amount", dto.discountValue ?? 0)
        : D.min(existing.discountAmount, subtotal);
    const dealId = dto.dealId !== undefined ? dto.dealId || null : existing.dealId;
    const pricing = effectivePricing(dto.pricing ?? existing.pricing, discountAmount, dealId);

    await runSerializable(this.prisma, async (tx) => {
      if (dto.items) {
        await tx.purchaseItem.deleteMany({ where: { purchaseId: id } });
        await tx.purchaseItem.createMany({ data: items.map((item) => ({ ...item, purchaseId: id })) });
      }
      await tx.purchase.update({
        where: { id },
        data: {
          type: dto.type,
          title: dto.title,
          subtotal,
          discountAmount,
          total: subtotal.sub(discountAmount),
          pricing,
          offerName: pricing === "standard" ? null : dto.offerName !== undefined ? dto.offerName || null : existing.offerName ?? (pricing === "deal" ? deal?.title ?? null : null),
          promoCode: dto.promoCode !== undefined ? dto.promoCode || null : undefined,
          dealId,
          purchasedAt: dto.purchasedAt ? new Date(dto.purchasedAt) : undefined,
          dueDate: dto.dueDate !== undefined ? (dto.dueDate ? new Date(dto.dueDate) : null) : undefined,
          vehicleId: dto.vehicleId !== undefined ? dto.vehicleId || null : undefined,
          caseId: dto.caseId !== undefined ? dto.caseId || null : undefined,
          sourceType: dto.sourceType !== undefined ? dto.sourceType || null : undefined,
          sourceId: dto.sourceId !== undefined ? dto.sourceId || null : undefined,
          customerNote: dto.customerNote !== undefined ? dto.customerNote || null : undefined,
          staffNote: dto.staffNote !== undefined ? dto.staffNote || null : undefined,
        },
      });
    });
    return this.get(id);
  }

  async cancel(id: string, reason: string) {
    const purchase = await this.prisma.purchase.findUnique({ where: { id } });
    if (!purchase) throw new NotFoundException("Purchase not found.");
    if (purchase.status === "cancelled") throw new ConflictException("Already cancelled.");
    await this.prisma.purchase.update({ where: { id }, data: { status: "cancelled", cancelledAt: new Date(), cancelReason: reason } });
    return this.get(id);
  }

  async reopen(id: string) {
    const purchase = await this.prisma.purchase.findUnique({ where: { id } });
    if (!purchase) throw new NotFoundException("Purchase not found.");
    if (purchase.status !== "cancelled") throw new ConflictException("This purchase isn't cancelled.");
    await this.prisma.purchase.update({ where: { id }, data: { status: "active", cancelledAt: null, cancelReason: null } });
    return this.get(id);
  }

  // ─── Payments ──────────────────────────────────────────────────────────

  /**
   * Works out the amount in the purchase's currency. Paid in another currency:
   * amount = received ÷ rate, with the rate given by staff or else today's.
   */
  private async preparePayment(purchaseCurrency: string, dto: RecordPaymentDto) {
    const kind = dto.kind ?? "payment";
    const foreign = dto.receivedCurrency && dto.receivedCurrency !== purchaseCurrency;
    let amount = dto.amount !== undefined ? cents(dto.amount) : null;
    let exchangeRate: Prisma.Decimal | null = null;
    let receivedAmount: Prisma.Decimal | null = null;

    if (foreign) {
      if (dto.receivedAmount === undefined && amount === null) throw new BadRequestException("Enter the amount received.");
      exchangeRate = dto.exchangeRate ? new D(dto.exchangeRate) : await this.autoRate(purchaseCurrency, dto.receivedCurrency!);
      if (!exchangeRate) throw new BadRequestException(`Enter the exchange rate (${dto.receivedCurrency} per 1 ${purchaseCurrency}).`);
      receivedAmount = dto.receivedAmount !== undefined ? cents(dto.receivedAmount) : cents(amount!.mul(exchangeRate));
      amount ??= convertReceived(receivedAmount, exchangeRate);
    }
    if (!amount || amount.lte(0)) throw new BadRequestException("Enter the amount.");

    return {
      kind,
      amount,
      method: dto.method,
      reference: dto.reference || null,
      paidAt: dto.paidAt ? new Date(dto.paidAt) : new Date(),
      note: dto.note || null,
      receivedAmount,
      receivedCurrency: foreign ? dto.receivedCurrency! : null,
      exchangeRate,
    };
  }

  /** Adds a payment/refund row and moves amountPaid with it. Call inside a transaction. */
  private async addPayment(
    tx: Tx,
    purchaseId: string,
    payment: Awaited<ReturnType<PurchasesService["preparePayment"]>> & { source: string; sourceRef?: string | null; recordedById?: string | null; recordedByName?: string | null }
  ) {
    const purchase = await tx.purchase.findUnique({ where: { id: purchaseId } });
    if (!purchase) throw new NotFoundException("Purchase not found.");
    if (payment.kind === "payment" && purchase.status === "cancelled") throw new ConflictException("This purchase is cancelled — payments can't be added. Record a refund instead, or reopen it.");
    if (payment.kind === "refund" && payment.amount.gt(purchase.amountPaid)) {
      throw new BadRequestException(`A refund can't be more than has been paid (${money(purchase.amountPaid, purchase.currency)}).`);
    }
    const row = await tx.purchasePayment.create({
      data: {
        purchaseId,
        kind: payment.kind,
        amount: payment.amount,
        method: payment.method,
        reference: payment.reference,
        paidAt: payment.paidAt,
        note: payment.note,
        receivedAmount: payment.receivedAmount,
        receivedCurrency: payment.receivedCurrency,
        exchangeRate: payment.exchangeRate,
        source: payment.source,
        sourceRef: payment.sourceRef ?? null,
        recordedById: payment.recordedById ?? null,
        recordedByName: payment.recordedByName ?? null,
      },
    });
    await tx.purchase.update({ where: { id: purchaseId }, data: { amountPaid: { increment: signedAmount(payment.kind, payment.amount) } } });
    return row;
  }

  async recordPayment(purchaseId: string, dto: RecordPaymentDto, actor: Actor) {
    const purchase = await this.prisma.purchase.findUnique({ where: { id: purchaseId }, include: { customer: { select: { name: true, email: true, phone: true } } } });
    if (!purchase) throw new NotFoundException("Purchase not found.");
    const prepared = await this.preparePayment(purchase.currency, dto);
    const row = await runSerializable(this.prisma, (tx) =>
      this.addPayment(tx, purchaseId, { ...prepared, source: "staff", recordedById: actor.sub, recordedByName: actor.name })
    );
    if (dto.notifyCustomer !== false) await this.sendReceipt(purchaseId, row.id);
    return this.get(purchaseId);
  }

  /**
   * Money the customer paid through the website (mobile money, an approved
   * proof). Idempotent on `sourceRef`: a second call for the same money does nothing.
   * Returns false when the purchase can't take it (gone or cancelled) so the caller
   * can credit the customer's balance instead.
   */
  async applyExternalPayment(
    tx: Tx,
    input: { purchaseId: string; amount: Prisma.Decimal; method: string; source: "mobile_money" | "payment_proof"; sourceRef: string; receivedAmount?: Prisma.Decimal | null; receivedCurrency?: string | null; exchangeRate?: Prisma.Decimal | null; note?: string | null; recordedByName?: string | null; recordedById?: string | null }
  ): Promise<boolean> {
    const purchase = await tx.purchase.findUnique({ where: { id: input.purchaseId }, select: { status: true } });
    if (!purchase || purchase.status === "cancelled") return false;
    const already = await tx.purchasePayment.findUnique({ where: { sourceRef: input.sourceRef } });
    if (already) return true;
    await this.addPayment(tx, input.purchaseId, {
      kind: "payment",
      amount: cents(input.amount),
      method: input.method,
      reference: input.sourceRef,
      paidAt: new Date(),
      note: input.note ?? null,
      receivedAmount: input.receivedAmount ?? null,
      receivedCurrency: input.receivedCurrency ?? null,
      exchangeRate: input.exchangeRate ?? null,
      source: input.source,
      sourceRef: input.sourceRef,
      recordedById: input.recordedById ?? null,
      recordedByName: input.recordedByName ?? null,
    });
    return true;
  }

  async voidPayment(paymentId: string, reason: string, actor: Actor) {
    const payment = await this.prisma.purchasePayment.findUnique({ where: { id: paymentId }, include: { purchase: { select: { customerId: true, currency: true } } } });
    if (!payment) throw new NotFoundException("Payment not found.");

    await runSerializable(this.prisma, async (tx) => {
      // Claim it, so two people voiding at once can't reverse it twice.
      const claimed = await tx.purchasePayment.updateMany({
        where: { id: paymentId, voidedAt: null },
        data: { voidedAt: new Date(), voidReason: reason, voidedByName: actor.name },
      });
      if (claimed.count !== 1) throw new ConflictException("This payment has already been voided.");
      await tx.purchase.update({ where: { id: payment.purchaseId }, data: { amountPaid: { decrement: signedAmount(payment.kind, payment.amount) } } });

      // Money taken from the customer's balance goes back to it.
      if (payment.source === "account_balance" && payment.kind === "payment") {
        const account = await tx.account.findUnique({ where: { customerId: payment.purchase.customerId } });
        if (account) {
          const back = payment.receivedAmount ?? payment.amount;
          await tx.account.update({ where: { id: account.id }, data: { balance: { increment: back } } });
          await tx.financialTransaction.create({
            data: { accountId: account.id, type: "DEPOSIT", amount: back, currency: account.currency, reference: `VOID-${payment.sourceRef ?? payment.id}`, description: `Returned to balance: ${reason}` },
          });
        }
      }
    });
    return this.get(payment.purchaseId);
  }

  /**
   * Pays part of a purchase from the customer's account balance (money they
   * deposited earlier, referral rewards…). `amount` is in the account's currency.
   * Staff may give the exchange rate; customers always get today's.
   */
  async applyBalance(purchaseId: string, dto: ApplyBalanceDto, by: { customerId?: string; actor?: Actor }) {
    const purchase = await this.prisma.purchase.findUnique({ where: { id: purchaseId } });
    if (!purchase || (by.customerId && purchase.customerId !== by.customerId)) throw new NotFoundException("Purchase not found.");
    if (purchase.status === "cancelled") throw new ConflictException("This purchase is cancelled.");
    const account = await this.prisma.account.findUnique({ where: { customerId: purchase.customerId } });
    if (!account) throw new BadRequestException("This customer has no account balance.");

    const spend = cents(dto.amount);
    const rate = (by.actor && dto.exchangeRate ? new D(dto.exchangeRate) : null) ?? (await this.autoRate(purchase.currency, account.currency));
    if (!rate) throw new BadRequestException(`No ${account.currency}→${purchase.currency} exchange rate is available. Please try again later.`);
    const credit = convertReceived(spend, rate);
    const owed = balanceOf(purchase.total, purchase.amountPaid);
    // A cent of rounding is allowed; anything more would leave the customer overpaid from their own balance.
    if (credit.gt(owed.add(0.01))) throw new BadRequestException(`That's more than is owed (${money(owed, purchase.currency)}).`);

    const ref = `APPLY-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString("hex").toUpperCase()}`;
    await runSerializable(this.prisma, async (tx) => {
      // Only takes the money if it's there, decided by the database in one step.
      const taken = await tx.account.updateMany({ where: { id: account.id, balance: { gte: spend } }, data: { balance: { decrement: spend } } });
      if (taken.count !== 1) throw new BadRequestException(`Not enough in the account balance (${money(account.balance, account.currency)}).`);
      await tx.financialTransaction.create({
        data: { accountId: account.id, type: "WITHDRAWAL", amount: spend, currency: account.currency, reference: ref, description: `Paid toward ${purchase.reference} — ${purchase.title}` },
      });
      await this.addPayment(tx, purchase.id, {
        kind: "payment",
        amount: D.min(credit, owed.gt(0) ? owed : credit),
        method: "account_balance",
        reference: ref,
        paidAt: new Date(),
        note: by.customerId ? "Paid by the customer from their balance" : null,
        receivedAmount: account.currency === purchase.currency ? null : spend,
        receivedCurrency: account.currency === purchase.currency ? null : account.currency,
        exchangeRate: account.currency === purchase.currency ? null : rate,
        source: "account_balance",
        sourceRef: ref,
        recordedById: by.actor?.sub ?? null,
        recordedByName: by.actor?.name ?? null,
      });
    });
    return by.customerId ? this.mineOne(by.customerId, purchaseId) : this.get(purchaseId);
  }

  private async sendReceipt(purchaseId: string, paymentId: string) {
    try {
      const p = await this.prisma.purchase.findUniqueOrThrow({ where: { id: purchaseId }, include: { customer: true } });
      const pay = await this.prisma.purchasePayment.findUniqueOrThrow({ where: { id: paymentId } });
      const balance = balanceOf(p.total, p.amountPaid);
      const mail = purchasePaymentReceiptEmail({
        name: p.customer.name,
        refund: pay.kind === "refund",
        amount: money(pay.amount, p.currency),
        method: METHOD_LABEL[pay.method] ?? pay.method,
        purchaseReference: p.reference,
        title: p.title,
        paid: money(p.amountPaid, p.currency),
        balance: money(balance.gt(0) ? balance : 0, p.currency),
        accountUrl: `${process.env.FRONTEND_URL ?? "http://localhost:5173"}/account/purchases`,
      });
      void this.notifications.notify({
        email: p.customer.email,
        phone: p.customer.phone,
        ...mail,
        text:
          pay.kind === "refund"
            ? `We've refunded ${money(pay.amount, p.currency)} on ${p.reference} (${p.title}).`
            : `Thank you — we've received ${money(pay.amount, p.currency)} for ${p.reference} (${p.title}). Balance still to pay: ${money(balance.gt(0) ? balance : 0, p.currency)}.`,
      });
    } catch (error) {
      this.logger.warn(`Couldn't send a purchase receipt: ${error instanceof Error ? error.message : error}`);
    }
  }

  // ─── Reading (staff) ───────────────────────────────────────────────────

  async get(id: string) {
    const p = await this.prisma.purchase.findUnique({ where: { id }, include: detailInclude });
    if (!p) throw new NotFoundException("Purchase not found.");
    return this.detailView(p);
  }

  private detailView(p: PurchaseDetail) {
    return withBalance(p);
  }

  /**
   * What a purchase can be linked to, for the staff form: current deals, vehicles
   * on sale (choosing one fills in its price), and this customer's shipments.
   */
  async formOptions(customerId?: string) {
    const [deals, vehicles, shipments] = await Promise.all([
      this.prisma.deal.findMany({ where: { status: { not: "DISMISSED" } }, orderBy: { createdAt: "desc" }, take: 50, select: { id: true, title: true, priceUsd: true, status: true } }),
      this.prisma.vehicle.findMany({
        where: { archivedAt: null, status: { in: ["available", "reserved"] } },
        orderBy: { updatedAt: "desc" },
        take: 300,
        select: { id: true, make: true, model: true, year: true, price: true, currency: true, status: true },
      }),
      customerId ? this.prisma.customerCase.findMany({ where: { customerId }, orderBy: { updatedAt: "desc" }, take: 30, select: { id: true, title: true, kind: true, stage: true } }) : [],
    ]);
    return { deals, vehicles, shipments };
  }

  /** Staff: open purchases for a customer (to link a payment proof to one). */
  async openForCustomer(customerId: string) {
    const rows = await this.prisma.purchase.findMany({ where: { customerId, status: "active" }, orderBy: { purchasedAt: "desc" }, select: { id: true, reference: true, title: true, currency: true, total: true, amountPaid: true, status: true, dueDate: true } });
    return rows.map(withBalance).filter((p) => new D(p.balance).gt(0));
  }

  /** Filters shared by the list, the summary and the export. */
  private whereFor(query: PurchaseListQuery): Prisma.PurchaseWhereInput {
    const and: Prisma.PurchaseWhereInput[] = [];
    const q = query.q?.trim();
    if (q) {
      and.push({
        OR: [
          { reference: { contains: q, mode: "insensitive" } },
          { title: { contains: q, mode: "insensitive" } },
          { offerName: { contains: q, mode: "insensitive" } },
          { promoCode: { contains: q, mode: "insensitive" } },
          { customer: { name: { contains: q, mode: "insensitive" } } },
          { customer: { email: { contains: q, mode: "insensitive" } } },
        ],
      });
    }
    if (query.type) and.push({ type: query.type });
    if (query.pricing === "offer") and.push({ pricing: { not: "standard" } });
    else if (query.pricing) and.push({ pricing: query.pricing });
    if (query.customerId) and.push({ customerId: query.customerId });
    if (query.from) and.push({ purchasedAt: { gte: new Date(query.from) } });
    if (query.to) and.push({ purchasedAt: { lt: new Date(new Date(query.to).getTime() + 24 * 60 * 60_000) } });
    if (query.payment === "cancelled") and.push({ status: "cancelled" });
    else if (query.payment) and.push({ status: "active" });
    return and.length ? { AND: and } : {};
  }

  /** Payment status depends on comparing two columns, so it's filtered after reading. */
  private matchesPayment(filter: string | undefined, status: PaymentStatus): boolean {
    if (!filter || filter === "cancelled") return true;
    if (filter === "owing") return ["unpaid", "partial", "overdue"].includes(status);
    return status === filter;
  }

  async list(query: PurchaseListQuery) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;
    const rows = await this.prisma.purchase.findMany({
      where: this.whereFor(query),
      orderBy: { purchasedAt: "desc" },
      take: 5000,
      include: { customer: { select: { id: true, name: true, email: true } }, _count: { select: { payments: true } } },
    });
    const filtered = rows.map(withBalance).filter((p) => this.matchesPayment(query.payment, p.paymentStatus));
    return { items: filtered.slice((page - 1) * pageSize, page * pageSize), total: filtered.length, page, pageSize };
  }

  /** Totals for the Finance page, per currency (dollars and kwacha are never added together). */
  async summary(query: PurchaseListQuery) {
    const rows = (await this.prisma.purchase.findMany({ where: this.whereFor(query), select: { currency: true, type: true, pricing: true, status: true, subtotal: true, discountAmount: true, total: true, amountPaid: true, dueDate: true } }))
      .map(withBalance)
      .filter((p) => this.matchesPayment(query.payment, p.paymentStatus));

    const zero = () => ({ count: 0, gross: new D(0), discounts: new D(0), total: new D(0), paid: new D(0), outstanding: new D(0), overdue: 0, overdueAmount: new D(0), onOffer: 0 });
    const byCurrency = new Map<string, ReturnType<typeof zero>>();
    const byType = new Map<string, { currency: string; type: string; count: number; total: Prisma.Decimal; outstanding: Prisma.Decimal }>();
    const byPricing = new Map<string, { currency: string; pricing: string; count: number; total: Prisma.Decimal; discounts: Prisma.Decimal }>();

    for (const p of rows) {
      if (p.status === "cancelled") continue;
      const c = byCurrency.get(p.currency) ?? zero();
      const owed = new D(p.balance);
      c.count++;
      c.gross = c.gross.add(p.subtotal);
      c.discounts = c.discounts.add(p.discountAmount);
      c.total = c.total.add(p.total);
      c.paid = c.paid.add(p.amountPaid);
      if (owed.gt(0)) c.outstanding = c.outstanding.add(owed);
      if (p.paymentStatus === "overdue") {
        c.overdue++;
        c.overdueAmount = c.overdueAmount.add(owed);
      }
      if (p.pricing !== "standard") c.onOffer++;
      byCurrency.set(p.currency, c);

      const tk = `${p.currency}|${p.type}`;
      const t = byType.get(tk) ?? { currency: p.currency, type: p.type, count: 0, total: new D(0), outstanding: new D(0) };
      t.count++;
      t.total = t.total.add(p.total);
      if (owed.gt(0)) t.outstanding = t.outstanding.add(owed);
      byType.set(tk, t);

      const pk = `${p.currency}|${p.pricing}`;
      const pr = byPricing.get(pk) ?? { currency: p.currency, pricing: p.pricing, count: 0, total: new D(0), discounts: new D(0) };
      pr.count++;
      pr.total = pr.total.add(p.total);
      pr.discounts = pr.discounts.add(p.discountAmount);
      byPricing.set(pk, pr);
    }

    // Money actually received in the period (by payment date, not purchase date).
    const paidWhere: Prisma.PurchasePaymentWhereInput = { voidedAt: null };
    if (query.from || query.to) {
      paidWhere.paidAt = {
        ...(query.from ? { gte: new Date(query.from) } : {}),
        ...(query.to ? { lt: new Date(new Date(query.to).getTime() + 24 * 60 * 60_000) } : {}),
      };
    }
    const payments = await this.prisma.purchasePayment.findMany({ where: paidWhere, select: { kind: true, amount: true, method: true, purchase: { select: { currency: true } } } });
    const collected = new Map<string, { currency: string; received: Prisma.Decimal; refunded: Prisma.Decimal; byMethod: Record<string, string> }>();
    const methodSums = new Map<string, Prisma.Decimal>();
    for (const pay of payments) {
      const cur = pay.purchase.currency;
      const c = collected.get(cur) ?? { currency: cur, received: new D(0), refunded: new D(0), byMethod: {} };
      if (pay.kind === "refund") c.refunded = c.refunded.add(pay.amount);
      else {
        c.received = c.received.add(pay.amount);
        const mk = `${cur}|${pay.method}`;
        methodSums.set(mk, (methodSums.get(mk) ?? new D(0)).add(pay.amount));
      }
      collected.set(cur, c);
    }
    for (const [mk, sum] of methodSums) {
      const [cur, method] = mk.split("|");
      collected.get(cur)!.byMethod[method] = sum.toFixed(2);
    }

    const fx = (d: Prisma.Decimal) => d.toFixed(2);
    return {
      currencies: [...byCurrency.entries()].map(([currency, c]) => ({
        currency,
        count: c.count,
        gross: fx(c.gross),
        discounts: fx(c.discounts),
        total: fx(c.total),
        paid: fx(c.paid),
        outstanding: fx(c.outstanding),
        overdue: c.overdue,
        overdueAmount: fx(c.overdueAmount),
        onOffer: c.onOffer,
      })),
      byType: [...byType.values()].map((t) => ({ ...t, total: fx(t.total), outstanding: fx(t.outstanding) })).sort((a, b) => b.count - a.count),
      byPricing: [...byPricing.values()].map((p) => ({ ...p, total: fx(p.total), discounts: fx(p.discounts) })).sort((a, b) => b.count - a.count),
      collected: [...collected.values()].map((c) => ({ ...c, received: fx(c.received), refunded: fx(c.refunded), net: fx(c.received.sub(c.refunded)) })),
      cancelled: rows.filter((p) => p.status === "cancelled").length,
    };
  }

  /** Recent payments across all purchases (the Finance "money in" feed). */
  async recentPayments(limit = 30) {
    const rows = await this.prisma.purchasePayment.findMany({
      orderBy: { createdAt: "desc" },
      take: Math.min(limit, 100),
      include: { purchase: { select: { id: true, reference: true, title: true, currency: true, customer: { select: { id: true, name: true } } } } },
    });
    return rows;
  }

  async exportCsv(query: PurchaseListQuery): Promise<string> {
    const { items } = await this.list({ ...query, page: 1, pageSize: 5000 });
    return toCsv(
      ["Reference", "Date", "Customer", "Email", "Type", "What", "Currency", "Price before discount", "Pricing", "Deal / promotion", "Promo code", "Discount", "Total", "Paid", "Balance", "Payment status", "Due date"],
      items.map((p) => [
        p.reference,
        p.purchasedAt.toISOString().slice(0, 10),
        p.customer.name,
        p.customer.email,
        TYPE_LABEL[p.type] ?? p.type,
        p.title,
        p.currency,
        p.subtotal.toFixed(2),
        p.pricing,
        p.offerName ?? "",
        p.promoCode ?? "",
        p.discountAmount.toFixed(2),
        p.total.toFixed(2),
        p.amountPaid.toFixed(2),
        p.balance,
        p.paymentStatus,
        p.dueDate ? p.dueDate.toISOString().slice(0, 10) : "",
      ])
    );
  }

  // ─── Customer accounts (staff) ─────────────────────────────────────────

  /**
   * Every customer with money activity: how much they've bought, paid and
   * still owe (per currency), and their account balance. `all` includes
   * customers who haven't bought anything yet.
   */
  async customerAccounts(q = "", all = false) {
    const term = q.trim();
    const customers = await this.prisma.customerUser.findMany({
      where: {
        ...(term ? { OR: [{ name: { contains: term, mode: "insensitive" } }, { email: { contains: term, mode: "insensitive" } }, { phone: { contains: term } }] } : {}),
        ...(all || term ? {} : { OR: [{ purchases: { some: {} } }, { account: { balance: { not: 0 } } }] }),
      },
      take: 500,
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        account: { select: { balance: true, currency: true } },
        purchases: { where: { status: "active" }, select: { currency: true, total: true, amountPaid: true, discountAmount: true, dueDate: true, status: true, purchasedAt: true } },
      },
    });

    return customers
      .map((c) => {
        const totals = new Map<string, { currency: string; purchased: Prisma.Decimal; paid: Prisma.Decimal; owed: Prisma.Decimal; saved: Prisma.Decimal }>();
        let overdue = 0;
        let last: Date | null = null;
        for (const p of c.purchases) {
          const t = totals.get(p.currency) ?? { currency: p.currency, purchased: new D(0), paid: new D(0), owed: new D(0), saved: new D(0) };
          t.purchased = t.purchased.add(p.total);
          t.paid = t.paid.add(p.amountPaid);
          const owed = balanceOf(p.total, p.amountPaid);
          if (owed.gt(0)) t.owed = t.owed.add(owed);
          t.saved = t.saved.add(p.discountAmount);
          totals.set(p.currency, t);
          if (paymentStatus(p) === "overdue") overdue++;
          if (!last || p.purchasedAt > last) last = p.purchasedAt;
        }
        return {
          id: c.id,
          name: c.name,
          email: c.email,
          phone: c.phone,
          purchases: c.purchases.length,
          overdue,
          lastPurchaseAt: last,
          accountBalance: c.account ? { amount: c.account.balance.toFixed(2), currency: c.account.currency } : null,
          totals: [...totals.values()].map((t) => ({ currency: t.currency, purchased: t.purchased.toFixed(2), paid: t.paid.toFixed(2), owed: t.owed.toFixed(2), saved: t.saved.toFixed(2) })),
        };
      })
      .sort((a, b) => b.overdue - a.overdue || Number(b.totals.some((t) => Number(t.owed) > 0)) - Number(a.totals.some((t) => Number(t.owed) > 0)) || a.name.localeCompare(b.name));
  }

  /** One customer's full statement: purchases, payments, account balance and its ledger. */
  async statement(customerId: string) {
    const customer = await this.prisma.customerUser.findUnique({
      where: { id: customerId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        createdAt: true,
        account: { select: { balance: true, currency: true, transactions: { orderBy: { createdAt: "desc" }, take: 100 } } },
        purchases: { orderBy: { purchasedAt: "desc" }, include: { items: { orderBy: { sortOrder: "asc" } }, payments: { orderBy: { paidAt: "asc" } }, deal: { select: { id: true, title: true } } } },
        paymentSubmissions: { where: { status: "PENDING" }, select: { id: true, amount: true, currency: true, reference: true, createdAt: true, purchaseId: true } },
      },
    });
    if (!customer) throw new NotFoundException("Customer not found.");
    const accounts = await this.customerAccounts(customer.email, true);
    return {
      ...customer,
      purchases: customer.purchases.map(withBalance),
      totals: accounts.find((a) => a.id === customerId)?.totals ?? [],
    };
  }

  // ─── The customer's own view ───────────────────────────────────────────

  private customerSelect = {
    id: true,
    reference: true,
    type: true,
    title: true,
    currency: true,
    subtotal: true,
    pricing: true,
    offerName: true,
    promoCode: true,
    discountAmount: true,
    total: true,
    amountPaid: true,
    status: true,
    purchasedAt: true,
    dueDate: true,
    customerNote: true,
    cancelReason: true,
    items: { orderBy: { sortOrder: "asc" }, select: { id: true, category: true, description: true, quantity: true, unitPrice: true, amount: true } },
    // Staff names and internal notes are never sent to the customer.
    payments: {
      where: { voidedAt: null },
      orderBy: { paidAt: "asc" },
      select: { id: true, kind: true, amount: true, method: true, reference: true, paidAt: true, receivedAmount: true, receivedCurrency: true },
    },
    shipment: { select: { id: true, title: true, stage: true } },
    vehicle: { select: { slug: true } },
  } satisfies Prisma.PurchaseSelect;

  async mine(customerId: string) {
    const rows = await this.prisma.purchase.findMany({ where: { customerId }, orderBy: { purchasedAt: "desc" }, select: this.customerSelect });
    return rows.map(withBalance);
  }

  async mineOne(customerId: string, id: string) {
    const row = await this.prisma.purchase.findFirst({ where: { id, customerId }, select: this.customerSelect });
    if (!row) throw new NotFoundException("Purchase not found.");
    return withBalance(row);
  }

  /** For the "pay toward this purchase" options: checks it's theirs and still owing. */
  async payable(customerId: string, purchaseId: string) {
    const purchase = await this.prisma.purchase.findFirst({ where: { id: purchaseId, customerId } });
    if (!purchase) throw new NotFoundException("Purchase not found.");
    if (purchase.status === "cancelled") throw new ConflictException("This purchase is cancelled.");
    const owed = balanceOf(purchase.total, purchase.amountPaid);
    if (owed.lte(0)) throw new ConflictException("This purchase is already fully paid.");
    return { purchase, owed };
  }
}
