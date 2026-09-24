import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { CreateFinancialTransactionDto } from "./dto/create-financial-transaction.dto";
import { UploadsService } from "../uploads/uploads.service";
import { runSerializable } from "../common/run-serializable";
import { PurchasesService } from "../purchases/purchases.service";

@Injectable()
export class FinancialService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uploads: UploadsService,
    private readonly purchases: PurchasesService
  ) {}

  async submitPayment(customerId: string, file: Express.Multer.File, dto: CreateFinancialTransactionDto) {
    const account = await this.prisma.account.findUnique({ where: { customerId } });
    if (!account) throw new NotFoundException("Account not found.");
    // Checked before the upload: it must be theirs and still owing.
    if (dto.purchaseId) await this.purchases.payable(customerId, dto.purchaseId);

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
        purchaseId: dto.purchaseId ?? null,
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
   */
  async reviewPayment(paymentId: string, admin: { sub: string; name?: string }, approved: boolean, reviewNote?: string, creditAmount?: number) {
    const adminId = admin.sub;
    const linked = approved ? await this.prisma.paymentSubmission.findUnique({ where: { id: paymentId }, include: { purchase: true } }) : null;
    let toPurchase: { amount: Prisma.Decimal; rate: Prisma.Decimal | null } | null = null;
    if (linked?.purchase && linked.purchase.status !== "cancelled") {
      const same = linked.purchase.currency === linked.currency;
      if (same) toPurchase = { amount: linked.amount, rate: null };
      else if (creditAmount && creditAmount > 0) toPurchase = { amount: new Prisma.Decimal(creditAmount), rate: linked.amount.div(creditAmount) };
      else {
        const rate = await this.purchases.autoRate(linked.purchase.currency, linked.currency);
        if (!rate) throw new BadRequestException(`Enter how much this is in ${linked.purchase.currency} (no exchange rate is available).`);
        toPurchase = { amount: linked.amount.div(rate), rate };
      }
    }

    return runSerializable(this.prisma, async (tx) => {
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
        const applied = await this.purchases.applyExternalPayment(tx, {
          purchaseId: payment.purchaseId,
          amount: toPurchase.amount,
          method: "bank",
          source: "payment_proof",
          sourceRef: payment.reference,
          receivedAmount: toPurchase.rate ? payment.amount : null,
          receivedCurrency: toPurchase.rate ? payment.currency : null,
          exchangeRate: toPurchase.rate,
          note: payment.note,
          recordedById: adminId,
          recordedByName: admin.name ?? null,
        });
        if (applied) {
          const updated = await tx.paymentSubmission.update({ where: { id: paymentId }, data: { ...review, status: "APPROVED" } });
          await tx.auditLog.create({
            data: { action: "APPROVE_PAYMENT", entityType: "Purchase", entityId: payment.purchaseId, newValue: { amount: payment.amount.toString(), paymentId } },
          });
          return updated;
        }
        // The purchase was cancelled meanwhile: credit the balance instead (below).
      }

      const account = await tx.account.findUnique({ where: { customerId: payment.customerId } });
      if (!account) throw new NotFoundException("Account not found.");

      // `increment` is an atomic database operation — it tells Postgres
      // "add this amount to whatever the balance currently is", computed
      // by the database itself in one step. This is deliberately NOT
      // "read the balance, add in JavaScript, write it back", which would
      // be unsafe: if two payments were approved at the same moment, the
      // second write could overwrite the first and silently lose money.
      await tx.account.update({
        where: { id: account.id },
        data: { balance: { increment: payment.amount } },
      });

      // The ledger entry (FinancialTransaction) is the permanent, auditable
      // record of this credit — it's created in the same transaction as
      // the balance update, so the two can never end up out of sync.
      const transaction = await tx.financialTransaction.create({
        data: {
          accountId: account.id,
          type: "DEPOSIT",
          amount: payment.amount,
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
          newValue: { amount: payment.amount.toString(), paymentId },
        },
      });

      return transaction;
    });
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