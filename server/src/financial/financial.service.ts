import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateFinancialTransactionDto } from "./dto/create-financial-transaction.dto";
import { UploadsService } from "../uploads/uploads.service";

@Injectable()
export class FinancialService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uploads: UploadsService
  ) {}

  async submitPayment(customerId: string, file: Express.Multer.File, dto: CreateFinancialTransactionDto) {
    const account = await this.prisma.account.findUnique({ where: { customerId } });
    if (!account) throw new NotFoundException("Account not found.");

    const { url: proofUrl } = await this.uploads.upload(file);
    const submission = await this.prisma.paymentSubmission.create({
      data: {
        customerId,
        accountId: account.id,
        amount: new Prisma.Decimal(dto.amount),
        currency: account.currency,
        proofUrl,
        reference: `PAY-${crypto.randomUUID()}`,
        note: dto.note,
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
      },
    });

    return { ...submission, amount: submission.amount.toString() };
  }

  async reviewPayment(paymentId: string, adminId: string, approved: boolean, reviewNote?: string) {
    return this.prisma.$transaction(async (tx) => {
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
        return tx.paymentSubmission.update({
          where: { id: paymentId },
          data: { ...review, status: "REJECTED" },
        });
      }

      const account = await tx.account.findUnique({ where: { customerId: payment.customerId } });
      if (!account) throw new NotFoundException("Account not found.");

      await tx.account.update({
        where: { id: account.id },
        data: { balance: { increment: payment.amount } },
      });

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
      include: { customer: { select: { id: true, name: true, email: true } } },
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