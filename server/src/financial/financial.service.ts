import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateFinancialTransactionDto } from "./dto/create-financial-transaction.dto";

@Injectable()
export class FinancialService {
  constructor(private readonly prisma: PrismaService) {}

  async create(customerId: string, type: "DEPOSIT" | "WITHDRAWAL", dto: CreateFinancialTransactionDto) {
    return this.prisma.$transaction(async (tx) => {
      const account = await tx.account.findUnique({ where: { customerId } });
      if (!account) throw new NotFoundException("Account not found.");

      const delta = type === "DEPOSIT" ? dto.amount : -dto.amount;
      const updated = await tx.account.updateMany({
        where: type === "WITHDRAWAL" ? { id: account.id, balance: { gte: dto.amount } } : { id: account.id },
        data: { balance: { increment: delta } },
      });
      if (updated.count !== 1) throw new BadRequestException("Insufficient funds.");

      const transaction = await tx.financialTransaction.create({
        data: {
          accountId: account.id,
          type,
          amount: new Prisma.Decimal(dto.amount),
          currency: account.currency,
          reference: `TX-${crypto.randomUUID()}`,
          description: dto.description,
        },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: customerId,
          action: "CREATE",
          entityType: "FinancialTransaction",
          entityId: transaction.id,
          newValue: { type, amount: dto.amount, accountId: account.id },
        },
      });
      return { ...transaction, amount: transaction.amount.toString() };
    });
  }

  findHistory(customerId: string, page = 1, pageSize = 25) {
    const safePage = Math.max(1, Math.floor(page));
    const safePageSize = Math.min(100, Math.max(1, Math.floor(pageSize)));
    return this.prisma.account.findUnique({
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
      },
    }).then((account) => account && {
      ...account,
      balance: account.balance.toString(),
      transactions: account.transactions.map((transaction) => ({
        ...transaction,
        amount: transaction.amount.toString(),
      })),
    });
  }
}