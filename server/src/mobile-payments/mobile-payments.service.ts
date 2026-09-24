/**
 * Mobile-money payments by customers (Airtel Money / TNM Mpamba through PayChangu).
 *
 * A successful, verified payment is credited to the customer's account ledger
 * exactly once (the ledger entry's reference is the payment's unique txRef, and
 * the whole credit happens in one transaction), then a receipt is sent by email
 * and WhatsApp. Finance staff see every attempt and can re-check a pending one.
 */
import { BadRequestException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { randomBytes, createHmac, timingSafeEqual } from "crypto";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import { mobilePaymentReceiptEmail } from "../email/email-templates";
import { createCheckout, paychanguConfigured, verifyPayment } from "./paychangu.client";
import { StartMobilePaymentDto } from "./mobile-payments.dto";

const PURPOSE_LABEL: Record<string, string> = {
  deposit: "account deposit",
  hire: "vehicle hire",
  import: "vehicle import",
  clearing: "clearing",
  other: "payment",
};

const mwk = (amount: number) => `MWK ${amount.toLocaleString("en-US")}`;

@Injectable()
export class MobilePaymentsService {
  private readonly logger = new Logger(MobilePaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService
  ) {}

  get enabled(): boolean {
    return paychanguConfigured();
  }

  async start(customerId: string, dto: StartMobilePaymentDto) {
    if (!this.enabled) throw new ServiceUnavailableException("Mobile money payments aren't available yet.");
    const customer = await this.prisma.customerUser.findUnique({ where: { id: customerId } });
    if (!customer) throw new NotFoundException("Customer not found.");

    const txRef = `LYC-${Date.now().toString(36).toUpperCase()}-${randomBytes(4).toString("hex").toUpperCase()}`;
    const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:5173";
    const apiUrl = process.env.PUBLIC_API_URL ?? `${frontendUrl}/api`;
    const [firstName, ...rest] = customer.name.trim().split(/\s+/);

    const payment = await this.prisma.mobilePayment.create({
      data: { customerId, txRef, amount: dto.amount, purpose: dto.purpose, note: dto.note ?? "" },
    });
    try {
      const checkoutUrl = await createCheckout({
        txRef,
        amount: dto.amount,
        currency: "MWK",
        email: customer.email,
        firstName: firstName || "Customer",
        lastName: rest.join(" ") || "-",
        returnUrl: `${frontendUrl}/account/payment-return?tx_ref=${txRef}`,
        callbackUrl: `${apiUrl}/mobile-payments/webhook`,
        title: "Lycie Investments",
        description: `${PURPOSE_LABEL[dto.purpose]}${dto.note ? ` — ${dto.note}` : ""}`.slice(0, 120),
      });
      await this.prisma.mobilePayment.update({ where: { id: payment.id }, data: { checkoutUrl } });
      return { txRef, checkoutUrl };
    } catch (error) {
      await this.prisma.mobilePayment.update({ where: { id: payment.id }, data: { status: "failed" } });
      this.logger.warn(`Couldn't start payment ${txRef}: ${error instanceof Error ? error.message : error}`);
      throw new ServiceUnavailableException("The payment service didn't respond. Please try again in a few minutes.");
    }
  }

  /** Asks the gateway for the real outcome and records it. Safe to call repeatedly. */
  async confirm(txRef: string, customerId?: string) {
    const payment = await this.prisma.mobilePayment.findUnique({ where: { txRef }, include: { customer: true } });
    if (!payment || (customerId && payment.customerId !== customerId)) throw new NotFoundException("Payment not found.");
    if (payment.status !== "pending" || !this.enabled) return this.publicView(payment);

    const verified = await verifyPayment(txRef);
    if (verified.status === "pending") return this.publicView(payment);

    const genuine =
      verified.status === "success" && verified.amount !== null && verified.amount >= payment.amount && (verified.currency ?? "MWK") === payment.currency;
    if (!genuine) {
      const failed = await this.prisma.mobilePayment.update({
        where: { id: payment.id },
        data: { status: "failed", providerData: verified.raw as Prisma.InputJsonValue },
      });
      return this.publicView(failed);
    }

    const credited = await this.prisma.$transaction(async (tx) => {
      // Claim it: only one caller (return page, webhook, staff re-check) moves pending → success.
      const claimed = await tx.mobilePayment.updateMany({
        where: { id: payment.id, status: "pending" },
        data: { status: "success", confirmedAt: new Date(), providerData: verified.raw as Prisma.InputJsonValue },
      });
      if (claimed.count !== 1) return false;
      if (payment.customerId) {
        const account = await tx.account.upsert({ where: { customerId: payment.customerId }, update: {}, create: { customerId: payment.customerId } });
        await tx.account.update({ where: { id: account.id }, data: { balance: { increment: payment.amount } } });
        await tx.financialTransaction.create({
          data: {
            accountId: account.id,
            type: "DEPOSIT",
            amount: payment.amount,
            currency: payment.currency,
            reference: payment.txRef,
            description: `Mobile money — ${PURPOSE_LABEL[payment.purpose] ?? payment.purpose}${payment.note ? `: ${payment.note}` : ""}`,
          },
        });
      }
      return true;
    });

    if (credited && payment.customer) {
      const receipt = mobilePaymentReceiptEmail({
        name: payment.customer.name,
        amount: mwk(payment.amount),
        reference: payment.txRef,
        purpose: PURPOSE_LABEL[payment.purpose] ?? payment.purpose,
      });
      void this.notifications.notify({
        email: payment.customer.email,
        phone: payment.customer.phone,
        ...receipt,
        text: `We've received your payment of ${mwk(payment.amount)} (reference ${payment.txRef}). Thank you!`,
      });
    }
    const fresh = await this.prisma.mobilePayment.findUniqueOrThrow({ where: { id: payment.id } });
    return this.publicView(fresh);
  }

  /** Webhook: checks PayChangu's signature, then verifies independently (the body itself is never trusted). */
  async handleWebhook(rawBody: Buffer | undefined, signature: string | undefined, body: Record<string, unknown>) {
    const secret = process.env.PAYCHANGU_WEBHOOK_SECRET;
    if (!secret || !rawBody || !signature) throw new BadRequestException("Webhook not accepted.");
    const expected = Buffer.from(createHmac("sha256", secret).update(rawBody).digest("hex"));
    const actual = Buffer.from(signature.trim());
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) throw new BadRequestException("Bad signature.");
    const txRef = String(body.tx_ref ?? (body.data as Record<string, unknown> | undefined)?.tx_ref ?? "");
    if (!txRef) return { received: true };
    await this.confirm(txRef).catch((error) => this.logger.warn(`Webhook confirm of ${txRef} failed: ${error instanceof Error ? error.message : error}`));
    return { received: true };
  }

  mine(customerId: string) {
    return this.prisma.mobilePayment.findMany({
      where: { customerId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { txRef: true, amount: true, currency: true, purpose: true, note: true, status: true, createdAt: true, confirmedAt: true },
    });
  }

  list(status?: string) {
    return this.prisma.mobilePayment.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: "desc" },
      take: 300,
      include: { customer: { select: { id: true, name: true, email: true } } },
    });
  }

  async summary() {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60_000);
    const [received, pending] = await Promise.all([
      this.prisma.mobilePayment.aggregate({ where: { status: "success", confirmedAt: { gte: since } }, _sum: { amount: true }, _count: true }),
      this.prisma.mobilePayment.count({ where: { status: "pending", createdAt: { gte: since } } }),
    ]);
    return { enabled: this.enabled, received30d: received._sum.amount ?? 0, count30d: received._count, pending };
  }

  private publicView(payment: { txRef: string; amount: number; currency: string; status: string; purpose: string; confirmedAt: Date | null }) {
    return { txRef: payment.txRef, amount: payment.amount, currency: payment.currency, status: payment.status, purpose: payment.purpose, confirmedAt: payment.confirmedAt };
  }
}
