/**
 * PayChangu — a Malawian payment gateway that takes Airtel Money, TNM Mpamba
 * and cards on one hosted checkout page. https://paychangu.com
 *
 * Flow: we create a payment with our own reference (tx_ref) and get a
 * checkout address; the customer pays there and is sent back to us; we then
 * ASK PayChangu for the payment's status (verify) — we never trust the
 * browser's word, or even the webhook body, that a payment succeeded.
 *
 * Settings (Render):  PAYCHANGU_SECRET_KEY   (sec-live-… or sec-test-… for the sandbox)
 *                     PAYCHANGU_WEBHOOK_SECRET  (optional; enables the webhook)
 * Until the key is set, the "Pay with mobile money" option stays hidden.
 * Check field names against PayChangu's current API docs when going live.
 */
const BASE = "https://api.paychangu.com";

export function paychanguConfigured(): boolean {
  return Boolean(process.env.PAYCHANGU_SECRET_KEY);
}

function headers() {
  return { Authorization: `Bearer ${process.env.PAYCHANGU_SECRET_KEY}`, Accept: "application/json", "Content-Type": "application/json" };
}

export interface CheckoutRequest {
  txRef: string;
  amount: number;
  currency: string;
  email: string;
  firstName: string;
  lastName: string;
  returnUrl: string;
  callbackUrl: string;
  title: string;
  description: string;
}

export async function createCheckout(input: CheckoutRequest): Promise<string> {
  const response = await fetch(`${BASE}/payment`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      amount: input.amount,
      currency: input.currency,
      email: input.email,
      first_name: input.firstName,
      last_name: input.lastName,
      callback_url: input.callbackUrl,
      return_url: input.returnUrl,
      tx_ref: input.txRef,
      customization: { title: input.title, description: input.description },
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const body = (await response.json().catch(() => ({}))) as { data?: { checkout_url?: string }; message?: unknown };
  const url = body.data?.checkout_url;
  if (!response.ok || !url) throw new Error(`PayChangu didn't start the payment (${response.status}): ${JSON.stringify(body.message ?? body).slice(0, 200)}`);
  return url;
}

export interface VerifiedPayment {
  status: "success" | "failed" | "pending";
  amount: number | null;
  currency: string | null;
  raw: Record<string, unknown>;
}

/** Reads PayChangu's answer into our three states. Exported for tests. */
export function interpretVerification(body: Record<string, unknown>): VerifiedPayment {
  const data = (body.data ?? {}) as Record<string, unknown>;
  const state = String(data.status ?? "").toLowerCase();
  const status = state === "success" || state === "successful" ? "success" : state === "failed" || state === "cancelled" ? "failed" : "pending";
  const amount = Number(data.amount);
  return { status, amount: Number.isFinite(amount) ? amount : null, currency: typeof data.currency === "string" ? data.currency : null, raw: data };
}

export async function verifyPayment(txRef: string): Promise<VerifiedPayment> {
  const response = await fetch(`${BASE}/verify-payment/${encodeURIComponent(txRef)}`, { headers: headers(), signal: AbortSignal.timeout(15_000) });
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (response.status === 404) return { status: "pending", amount: null, currency: null, raw: body };
  if (!response.ok) throw new Error(`PayChangu verify failed (${response.status}).`);
  return interpretVerification(body);
}
