/**
 * Referral programme: every customer gets a share link (/account/register?ref=CODE).
 * A friend who signs up through it is linked to them. Once the friend has done
 * business with us, Finance rewards the referrer — the reward is credited to
 * their account balance (ledger entry REF-…), exactly once.
 */
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { randomInt } from "crypto";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

@Injectable()
export class ReferralsService {
  constructor(private readonly prisma: PrismaService) {}

  private async codeFor(customerId: string): Promise<string> {
    const customer = await this.prisma.customerUser.findUniqueOrThrow({ where: { id: customerId }, select: { referralCode: true } });
    if (customer.referralCode) return customer.referralCode;
    for (let attempt = 0; attempt < 5; attempt++) {
      let code = "";
      for (let i = 0; i < 7; i++) code += CODE_CHARS[randomInt(CODE_CHARS.length)];
      try {
        await this.prisma.customerUser.update({ where: { id: customerId }, data: { referralCode: code } });
        return code;
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) throw error;
      }
    }
    throw new BadRequestException("Couldn't create a referral code. Please try again.");
  }

  async mine(customerId: string) {
    const code = await this.codeFor(customerId);
    const referrals = await this.prisma.referral.findMany({ where: { referrerId: customerId }, select: { status: true, rewardAmount: true } });
    const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:5173";
    return {
      code,
      link: `${frontendUrl}/account/register?ref=${code}`,
      invited: referrals.length,
      rewarded: referrals.filter((r) => r.status === "rewarded").length,
      rewardsTotal: referrals.reduce((sum, r) => sum + (r.status === "rewarded" ? r.rewardAmount ?? 0 : 0), 0),
    };
  }

  /** Called at sign-up. Silently ignores unknown codes (a typo shouldn't block registering). */
  async linkNewCustomer(newCustomerId: string, code: string | undefined): Promise<void> {
    const clean = code?.trim().toUpperCase();
    if (!clean) return;
    const referrer = await this.prisma.customerUser.findUnique({ where: { referralCode: clean }, select: { id: true } });
    if (!referrer || referrer.id === newCustomerId) return;
    await this.prisma.$transaction([
      this.prisma.customerUser.update({ where: { id: newCustomerId }, data: { referredById: referrer.id } }),
      this.prisma.referral.create({ data: { referrerId: referrer.id, referredId: newCustomerId } }),
    ]);
  }

  /** Finance list, with whether the referred friend has done any business yet. */
  async list() {
    const referrals = await this.prisma.referral.findMany({
      orderBy: { createdAt: "desc" },
      take: 300,
      include: {
        referrer: { select: { id: true, name: true, email: true } },
        referred: {
          select: {
            id: true,
            name: true,
            email: true,
            createdAt: true,
            _count: { select: { hireRequests: true, importRequests: true, clearingRequests: true, inquiries: true, mobilePayments: true, paymentSubmissions: true } },
          },
        },
      },
    });
    return referrals.map((r) => {
      const c = r.referred._count;
      return { ...r, referredActivity: c.hireRequests + c.importRequests + c.clearingRequests + c.inquiries + c.mobilePayments + c.paymentSubmissions };
    });
  }

  async reward(id: string, amount: number, note: string | undefined) {
    return this.prisma.$transaction(async (tx) => {
      const referral = await tx.referral.findUnique({ where: { id } });
      if (!referral) throw new NotFoundException("Referral not found.");
      const claimed = await tx.referral.updateMany({
        where: { id, status: "pending" },
        data: { status: "rewarded", rewardAmount: amount, rewardNote: note ?? null, rewardedAt: new Date() },
      });
      if (claimed.count !== 1) throw new BadRequestException("This referral has already been decided.");
      const account = await tx.account.upsert({ where: { customerId: referral.referrerId }, update: {}, create: { customerId: referral.referrerId } });
      await tx.account.update({ where: { id: account.id }, data: { balance: { increment: amount } } });
      await tx.financialTransaction.create({
        data: { accountId: account.id, type: "DEPOSIT", amount, currency: account.currency, reference: `REF-${referral.id}`, description: note ? `Referral reward: ${note}` : "Referral reward" },
      });
      return tx.referral.findUniqueOrThrow({ where: { id } });
    });
  }

  async decline(id: string, note: string | undefined) {
    const result = await this.prisma.referral.updateMany({ where: { id, status: "pending" }, data: { status: "declined", rewardNote: note ?? null } });
    if (result.count !== 1) throw new BadRequestException("This referral has already been decided.");
    return { declined: true };
  }

  async summary() {
    const [pending, rewarded] = await Promise.all([
      this.prisma.referral.count({ where: { status: "pending" } }),
      this.prisma.referral.aggregate({ where: { status: "rewarded" }, _sum: { rewardAmount: true }, _count: true }),
    ]);
    return { pending, rewarded: rewarded._count, rewardsPaid: rewarded._sum.rewardAmount ?? 0 };
  }
}
