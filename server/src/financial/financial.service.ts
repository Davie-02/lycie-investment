import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { CreateFinancialTransactionDto } from "./dto/create-financial-transaction.dto";
import { UploadsService } from "../uploads/uploads.service";
import { runSerializable } from "../common/run-serializable";
import { escapeHtml } from "../email/email-templates";
import { PurchasesService, type Excess } from "../purchases/purchases.service";
import { NotificationsService } from "../notifications/notifications.service";

@Injectable()
export class FinancialService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uploads: UploadsService,
    private readonly purchases: PurchasesService,
    private readonly notifications: NotificationsService
  ) {}

  /** Tells the customer their proof was approved or rejected (account inbox, email, WhatsApp). Never throws. */
  private async tellCustomer(paymentId: string, approved: boolean, received?: Prisma.Decimal | null) {
    try {
      const p = await this.prisma.paymentSubmission.findUnique({
        where: { id: paymentId },
        include: { customer: { select: { id: true, name: true, email: true, phone: true } }, purchase: { select: { reference: true, title: true } } },
      });
      if (!p) return;
      const what = p.purchase ? `${p.purchase.reference} (${p.purchase.title})` : "your account balance";
      const amount = `${p.currency} ${(received ?? p.amount).toNumber().toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
      const subject = approved ? `Payment approved: ${amount}` : "We couldn't approve your payment proof";
      const body = approved
        ? `Your payment (reference ${p.reference}) has been checked and approved. It has been added to ${what}.${p.reviewNote ? ` Note from our team: ${p.reviewNote}` : ""}`
        : `We couldn't approve your proof of payment (reference ${p.reference}) for ${what}. Reason: ${p.reviewNote ?? "not given"}. Please contact us or send a clearer proof.`;
      await this.prisma.customerMessage.create({ data: { customerId: p.customer.id, subject, body, requestType: "payment", requestId: p.reference, sentByName: "Lycie Investments accounts" } });
      const url = `${process.env.FRONTEND_URL ?? "http://localhost:5173"}/account/messages`;
      void this.notifications.notify({
        email: p.customer.email,
        phone: p.customer.phone,
        subject,
        html: `<p>Hi ${escapeHtml(p.customer.name)},</p><p>${escapeHtml(body)}</p><p><a href="${escapeHtml(url)}">Open my account</a></p>`,
        text: body,
      });
    } catch {
      // A failed notice must never undo the review.
    }
  }

  async submitPayment(customerId: string, file: Express.Multer.File, dto: CreateFinancialTransactionDto) {
    const account = await this.prisma.account.upsert({ where: { customerId }, update: {}, create: { customerId } });
    // Every proof says what it's for (checked before the upload): a purchase or hire booking
    // of theirs that still owes — compared with what's owed — or a deposit with a description.
    let purchaseId: string | null = null;
    if (dto.purchaseId || dto.hireRequestId) {
      const { purchase } = await this.purchases.resolveTarget(customerId, { purchaseId: dto.purchaseId, hireRequestId: dto.hireRequestId });
      await this.purchases.checkAgainstOwed(customerId, purchase.id, dto.amount, account.currency, dto.acceptExcess === true || dto.acceptExcess === "true");
      purchaseId = purchase.id;
    } else if (!dto.note || dto.note.trim().length < 3) {
      throw new BadRequestException("Choose what you're paying for — or, for a deposit, say what it's for.");
    }

    const { url: proofUrl } = await this.uploads.upload(file);
    const submission = await this.prisma.paymentSubmission.create({
      data: {
        customerId,
        accountId: account.id,
        amount: new Prisma.Decimal(dto.amount),
        currency: account.currency,
        proofUrl,
        reference: `PAY-${randomUUID()}`,
        note: dto.note,
        purchaseId,
      },
      select: {
        id: true,
        amount: true,
        currency: true,
        proofUrl: true,
        reference: true,
        note: true,
        status: true,
        reviewNote: true,
        createdAt: true,
        purchaseId: true,
      },
    });

    return { ...submission, amount: submission.amount.toString() };
  }

  /**
   * Approving a proof that names a purchase pays that purchase. When the proof's
   * currency differs from the purchase's, `creditAmount` (in the purchase's
   * currency) is what the approver confirmed; without it today's rate is used.
   * `receivedAmount` (in the proof's currency) is what actually arrived when it differs
   * from what the customer said — the customer's figure is kept in the review note.
   */
  async reviewPayment(paymentId: string, admin: { sub: string; name?: string }, approved: boolean, reviewNote?: string, creditAmount?: number, receivedAmount?: number) {
    const adminId = admin.sub;
    const linked = approved ? await this.prisma.paymentSubmission.findUnique({ where: { id: paymentId }, include: { purchase: true } }) : null;
    const received = linked ? (receivedAmount && receivedAmount > 0 ? new Prisma.Decimal(receivedAmount) : linked.amount) : null;
    if (linked && received && !received.eq(linked.amount)) {
      reviewNote = [reviewNote, `Received ${linked.currency} ${received.toFixed(2)} (customer said ${linked.amount.toFixed(2)})`].filter(Boolean).join(" · ");
    }
    let toPurchase: { amount: Prisma.Decimal; rate: Prisma.Decimal | null } | null = null;
    if (linked?.purchase && received && linked.purchase.status !== "cancelled") {
      const same = linked.purchase.currency === linked.currency;
      if (same) toPurchase = { amount: received, rate: null };
      else if (creditAmount && creditAmount > 0) toPurchase = { amount: new Prisma.Decimal(creditAmount), rate: received.div(creditAmount) };
      else {
        const rate = await this.purchases.autoRate(linked.purchase.currency, linked.currency);
        if (!rate) throw new BadRequestException(`Enter how much this is in ${linked.purchase.currency} (no exchange rate is available).`);
        toPurchase = { amount: received.div(rate), rate };
      }
    }

    const walletRate = linked?.purchase ? (await this.purchases.walletRateFor(linked.customerId, linked.purchase.currency)).rate : null;
    let excess: Excess | null = null;

    const result = await runSerializable(this.prisma, async (tx) => {
      const payment = await tx.paymentSubmission.findUnique({ where: { id: paymentId } });
      if (!payment) throw new NotFoundException("Payment submission not found.");
      if (payment.status !== "PENDING") {
        throw new ConflictException("This payment submission has already been reviewed.");
      }

      const review = {
        reviewNote,
        reviewedAt: new Date(),
        reviewedByAdminId: adminId,
      };

      if (!approved) {
        // Rejecting never touches the account balance — nothing to credit.
        return tx.paymentSubmission.update({
          where: { id: paymentId },
          data: { ...review, status: "REJECTED" },
        });
      }

      if (payment.purchaseId && toPurchase) {
        const outcome = await this.purchases.applyExternalPayment(tx, {
          purchaseId: payment.purchaseId,
          amount: toPurchase.amount,
          method: "bank",
          source: "payment_proof",
          sourceRef: payment.reference,
          receivedAmount: toPurchase.rate ? received : null,
          receivedCurrency: toPurchase.rate ? payment.currency : null,
          exchangeRate: toPurchase.rate,
          note: payment.note,
          recordedById: adminId,
          recordedByName: admin.name ?? null,
          walletRate,
        });
        excess = outcome.excess;
        if (outcome.applied) {
          const updated = await tx.paymentSubmission.update({ where: { id: paymentId }, data: { ...review, status: "APPROVED" } });
          await tx.auditLog.create({
            data: { action: "APPROVE_PAYMENT", entityType: "Purchase", entityId: payment.purchaseId, newValue: { claimed: payment.amount.toString(), received: received!.toString(), paymentId } },
          });
          return updated;
        }
        // The purchase was cancelled meanwhile: credit the balance instead (below).
      }

      const account = await tx.account.findUnique({ where: { customerId: payment.customerId } });
      if (!account) throw new NotFoundException("Account not found.");
      const credit = received ?? payment.amount;

      // `increment` is an atomic database operation — it tells Postgres
      // "add this amount to whatever the balance currently is", computed
      // by the database itself in one step. This is deliberately NOT
      // "read the balance, add in JavaScript, write it back", which would
      // be unsafe: if two payments were approved at the same moment, the
      // second write could overwrite the first and silently lose money.
      await tx.account.update({
        where: { id: account.id },
        data: { balance: { increment: credit } },
      });

      // The ledger entry (FinancialTransaction) is the permanent, auditable
      // record of this credit — it's created in the same transaction as
      // the balance update, so the two can never end up out of sync.
      const transaction = await tx.financialTransaction.create({
        data: {
          accountId: account.id,
          type: "DEPOSIT",
          amount: credit,
          currency: payment.currency,
          reference: payment.reference,
          description: payment.note,
        },
      });

      await tx.paymentSubmission.update({
        where: { id: paymentId },
        data: { ...review, status: "APPROVED" },
      });
      await tx.auditLog.create({
        data: {
          action: "APPROVE_PAYMENT",
          entityType: "FinancialTransaction",
          entityId: transaction.id,
          newValue: { claimed: payment.amount.toString(), received: credit.toString(), paymentId },
        },
      });

      return transaction;
    });
    // Paid more than owed: the extra is on their balance — tell them (after the money is committed).
    if (excess) await this.purchases.notifyExcess(excess);
    await this.tellCustomer(paymentId, approved, received);
    return result;
  }

  listPayments(status?: "PENDING" | "APPROVED" | "REJECTED") {
    return this.prisma.paymentSubmission.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: "desc" },
      include: { customer: { select: { id: true, name: true, email: true } }, purchase: { select: { id: true, reference: true, title: true, currency: true, total: true, amountPaid: true } } },
    });
  }

  async findHistory(customerId: string, page = 1, pageSize = 25) {
    const safePage = Math.max(1, Math.floor(page));
    const safePageSize = Math.min(100, Math.max(1, Math.floor(pageSize)));
    const account = await this.prisma.account.findUnique({
      where: { customerId },
      select: {
        id: true,
        balance: true,
        currency: true,
        transactions: {
          orderBy: { createdAt: "desc" },
          skip: (safePage - 1) * safePageSize,
          take: safePageSize,
        },
        paymentSubmissions: {
          orderBy: { createdAt: "desc" },
          take: safePageSize,
        },
      },
    });

    if (!account) {
      return null;
    }

    return {
      ...account,
      balance: account.balance.toString(),
      transactions: account.transactions.map((transaction) => ({
        ...transaction,
        amount: transaction.amount.toString(),
      })),
    };
  }
}