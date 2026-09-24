/**
 * My purchases: everything the customer has bought from us — each cost, any
 * deal, promotion or discount (and what they saved), every payment, and the
 * balance still to pay — with ways to pay the balance: mobile money, their
 * account balance, or a proof of payment for that purchase.
 */
import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import FormField from "@/components/forms/FormField";
import { usePricing } from "@/context/PricingContext";
import { mobileMoneyEnabled, payPurchaseFromBalance, startPurchaseMobilePayment } from "@/services/customer.service";
import { ApiError } from "@/services/http";
import { stageLabel } from "@/utils/shipmentStages";
import {
  ITEM_CATEGORIES,
  PAYMENT_METHODS,
  PAYMENT_STATUS_LABELS,
  PRICING_LABELS,
  PURCHASE_TYPES,
  money,
  paidPercent,
  paymentTone,
  type Purchase,
} from "@/utils/purchases";
import { usePortal } from "./PortalContext";
import PortalHeading from "./PortalHeading";

type Filter = "all" | "owing" | "paid";

/** Per-currency totals (dollars and kwacha are never added together). */
function totalsByCurrency(purchases: Purchase[]) {
  const map = new Map<string, { total: number; paid: number; owed: number; saved: number }>();
  for (const p of purchases) {
    if (p.status === "cancelled") continue;
    const t = map.get(p.currency) ?? { total: 0, paid: 0, owed: 0, saved: 0 };
    t.total += Number(p.total);
    t.paid += Number(p.amountPaid);
    t.owed += Math.max(0, Number(p.balance));
    t.saved += Number(p.discountAmount);
    map.set(p.currency, t);
  }
  return [...map.entries()];
}

export default function Purchases() {
  const { purchases, isLoading } = usePortal();
  const [filter, setFilter] = useState<Filter>("all");
  const [mobileOn, setMobileOn] = useState(false);

  useEffect(() => {
    void mobileMoneyEnabled().then(setMobileOn).catch(() => setMobileOn(false));
  }, []);

  if (isLoading) return <p className="text-muted">Loading…</p>;

  const totals = totalsByCurrency(purchases);
  const shown = purchases.filter((p) =>
    filter === "all" ? true : filter === "paid" ? p.paymentStatus === "paid" || p.paymentStatus === "overpaid" : p.status === "active" && Number(p.balance) > 0
  );

  return (
    <>
      <PortalHeading title="My purchases" intro="What you've bought from us, what it cost, what you've paid and what's left to pay." />

      {purchases.length === 0 ? (
        <section className="portal-card">
          <p className="text-muted" style={{ margin: 0 }}>
            Nothing here yet. When you buy a vehicle, an import, clearing or a hire from us, it appears here with every cost and payment.
          </p>
        </section>
      ) : (
        <>
          {totals.map(([currency, t]) => (
            <div key={currency} className="portal-stats">
              <div className="portal-stat">
                <span className="portal-stat__value">{money(t.total, currency)}</span>
                <span className="portal-stat__label">Total bought</span>
              </div>
              <div className="portal-stat">
                <span className="portal-stat__value">{money(t.paid, currency)}</span>
                <span className="portal-stat__label">Paid so far</span>
              </div>
              <div className={t.owed > 0 ? "portal-stat portal-stat--owing" : "portal-stat"}>
                <span className="portal-stat__value">{money(t.owed, currency)}</span>
                <span className="portal-stat__label">Balance to pay</span>
              </div>
              {t.saved > 0 && (
                <div className="portal-stat">
                  <span className="portal-stat__value">{money(t.saved, currency)}</span>
                  <span className="portal-stat__label">Saved on deals & discounts</span>
                </div>
              )}
            </div>
          ))}

          <div className="portal-filters" role="group" aria-label="Show">
            {(
              [
                ["all", "All"],
                ["owing", "Still to pay"],
                ["paid", "Paid"],
              ] as Array<[Filter, string]>
            ).map(([key, label]) => (
              <button key={key} type="button" className={filter === key ? "portal-filter portal-filter--on" : "portal-filter"} aria-pressed={filter === key} onClick={() => setFilter(key)}>
                {label}
              </button>
            ))}
          </div>

          {shown.length === 0 && <p className="text-muted">Nothing to show here.</p>}
          {shown.map((purchase) => (
            <PurchaseCard key={purchase.id} purchase={purchase} mobileOn={mobileOn} />
          ))}
        </>
      )}
    </>
  );
}

function PurchaseCard({ purchase: p, mobileOn }: { purchase: Purchase; mobileOn: boolean }) {
  const owing = p.status === "active" && Number(p.balance) > 0;
  const tone = paymentTone(p.paymentStatus);
  const onOffer = p.pricing !== "standard";

  return (
    <article className="portal-card purchase-card" aria-labelledby={`purchase-${p.id}`}>
      <header className="purchase-card__head">
        <div>
          <h3 id={`purchase-${p.id}`}>{p.title}</h3>
          <p className="text-muted">
            {PURCHASE_TYPES[p.type] ?? p.type} · <span className="mono">{p.reference}</span> · {new Date(p.purchasedAt).toLocaleDateString()}
          </p>
        </div>
        <div className="purchase-card__badges">
          {onOffer && (
            <span className="portal-pill purchase-offer">
              {PRICING_LABELS[p.pricing]}
              {p.offerName ? `: ${p.offerName}` : ""}
            </span>
          )}
          <span className={`portal-pill ${tone === "good" ? "portal-pill--good" : tone === "bad" ? "portal-pill--bad" : tone === "warn" ? "portal-pill--warn" : ""}`}>
            {PAYMENT_STATUS_LABELS[p.paymentStatus]}
          </span>
        </div>
      </header>

      {p.status === "active" && (
        <div className="purchase-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={paidPercent(p.total, p.amountPaid)} aria-label="Paid">
          <span style={{ width: `${paidPercent(p.total, p.amountPaid)}%` }} />
        </div>
      )}

      <dl className="purchase-figures">
        <div>
          <dt>Total</dt>
          <dd>{money(p.total, p.currency)}</dd>
        </div>
        <div>
          <dt>Paid</dt>
          <dd>{money(p.amountPaid, p.currency)}</dd>
        </div>
        <div>
          <dt>{Number(p.balance) < 0 ? "In your favour" : "Balance"}</dt>
          <dd className={owing ? "purchase-figures__owing" : undefined}>{money(Math.abs(Number(p.balance)), p.currency)}</dd>
        </div>
        {p.dueDate && owing && (
          <div>
            <dt>Pay by</dt>
            <dd>{new Date(p.dueDate).toLocaleDateString()}</dd>
          </div>
        )}
        {Number(p.discountAmount) > 0 && (
          <div>
            <dt>You saved</dt>
            <dd>{money(p.discountAmount, p.currency)}</dd>
          </div>
        )}
      </dl>

      {p.status === "cancelled" && <p className="text-muted">This purchase was cancelled{p.cancelReason ? `: ${p.cancelReason}` : "."}</p>}
      {p.customerNote && <p className="purchase-note">{p.customerNote}</p>}
      {p.shipment && (
        <p className="text-muted">
          Shipment: <Link to="/account/track">{p.shipment.title}</Link> · {stageLabel(p.shipment.stage)}
        </p>
      )}

      <details className="purchase-details">
        <summary>Cost breakdown and payments</summary>
        <div className="customer-account__table-wrap">
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Qty</th>
                <th>Price</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {p.items.map((item) => (
                <tr key={item.id}>
                  <td>
                    {item.description}
                    <div className="text-muted">{ITEM_CATEGORIES[item.category] ?? item.category}</div>
                  </td>
                  <td>{item.quantity}</td>
                  <td>{money(item.unitPrice, p.currency)}</td>
                  <td>{money(item.amount, p.currency)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              {Number(p.discountAmount) > 0 && (
                <>
                  <tr>
                    <td colSpan={3}>Price before discount</td>
                    <td>{money(p.subtotal, p.currency)}</td>
                  </tr>
                  <tr>
                    <td colSpan={3}>
                      {PRICING_LABELS[p.pricing]}
                      {p.offerName ? ` — ${p.offerName}` : ""}
                      {p.promoCode ? ` (code ${p.promoCode})` : ""}
                    </td>
                    <td>−{money(p.discountAmount, p.currency)}</td>
                  </tr>
                </>
              )}
              <tr>
                <th colSpan={3}>Total</th>
                <th>{money(p.total, p.currency)}</th>
              </tr>
            </tfoot>
          </table>
        </div>

        <h4>Payments</h4>
        {p.payments.length === 0 ? (
          <p className="text-muted">No payments yet.</p>
        ) : (
          <div className="customer-account__table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>How</th>
                  <th>Reference</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {p.payments.map((pay) => (
                  <tr key={pay.id}>
                    <td>{new Date(pay.paidAt).toLocaleDateString()}</td>
                    <td>
                      {pay.kind === "refund" ? "Refund" : PAYMENT_METHODS[pay.method] ?? pay.method}
                      {pay.receivedAmount && pay.receivedCurrency && <div className="text-muted">{money(pay.receivedAmount, pay.receivedCurrency)} paid</div>}
                    </td>
                    <td className="mono">{pay.reference ?? "—"}</td>
                    <td>{pay.kind === "refund" ? `−${money(pay.amount, p.currency)}` : money(pay.amount, p.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </details>

      {owing && <PayBalance purchase={p} mobileOn={mobileOn} />}
    </article>
  );
}

/** The ways to pay what's left: mobile money, the account balance, or a proof of payment. */
function PayBalance({ purchase: p, mobileOn }: { purchase: Purchase; mobileOn: boolean }) {
  const { account, reloadPurchases } = usePortal();
  const { rate } = usePricing();
  const [mode, setMode] = useState<"none" | "mobile" | "balance">("none");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Kwacha per 1 unit of the purchase's currency (only dollars and kwacha are converted here).
  const kwachaRate = p.currency === "MWK" ? 1 : p.currency === "USD" ? rate : null;
  const owedMwk = kwachaRate ? Math.ceil(Number(p.balance) * kwachaRate) : null;
  const walletMwk = account && account.currency === "MWK" ? Number(account.balance) : 0;
  const canMobile = mobileOn && owedMwk !== null && owedMwk >= 100;
  const canBalance = walletMwk > 0 && owedMwk !== null;

  function open(next: "mobile" | "balance") {
    setMode(next);
    setError(null);
    setDone(null);
    setAmount(String(next === "balance" ? Math.min(walletMwk, owedMwk ?? 0) : owedMwk ?? ""));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const value = Number(amount.replace(/[^\d.]/g, ""));
    if (!value || value <= 0) {
      setError("Enter an amount.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (mode === "mobile") {
        const { checkoutUrl } = await startPurchaseMobilePayment(p.id, Math.round(value));
        // Only ever PayChangu's own secure page.
        if (!/^https:\/\/([\w-]+\.)*paychangu\.com\//.test(checkoutUrl)) throw new Error("Unexpected payment address.");
        window.location.assign(checkoutUrl);
        return;
      }
      await payPurchaseFromBalance(p.id, value);
      await reloadPurchases();
      setDone(`Paid MWK ${value.toLocaleString()} from your balance.`);
      setMode("none");
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : "Couldn't complete the payment.");
    } finally {
      setBusy(false);
    }
  }

  const typed = Number(amount.replace(/[^\d.]/g, "")) || 0;

  return (
    <div className="purchase-pay">
      {done && (
        <p className="form-status form-status--success" role="status">
          {done}
        </p>
      )}
      <div className="purchase-pay__buttons">
        {canMobile && (
          <button type="button" className={mode === "mobile" ? "btn btn-primary" : "btn btn-secondary"} onClick={() => open("mobile")}>
            Pay with mobile money
          </button>
        )}
        {canBalance && (
          <button type="button" className={mode === "balance" ? "btn btn-primary" : "btn btn-secondary"} onClick={() => open("balance")}>
            Use my balance ({money(walletMwk, "MWK")})
          </button>
        )}
        <Link to={`/account/payments?purchase=${p.id}`} className="btn-ghost">
          Paid another way? Upload proof
        </Link>
      </div>

      {mode !== "none" && (
        <form className="purchase-pay__form" onSubmit={submit} noValidate>
          {error && (
            <p className="form-status form-status--error" role="alert">
              {error}
            </p>
          )}
          <FormField
            id={`pay-${p.id}`}
            label={mode === "mobile" ? "Amount to pay (MWK)" : "Amount from your balance (MWK)"}
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            footer={
              <p className="text-muted purchase-pay__hint">
                {kwachaRate && p.currency !== "MWK" && typed > 0
                  ? `≈ ${money(Math.round((typed / kwachaRate) * 100) / 100, p.currency)} at today's rate. Balance owed: ${money(p.balance, p.currency)} (≈ MWK ${owedMwk?.toLocaleString()}).`
                  : `Balance owed: ${money(p.balance, p.currency)}.`}
              </p>
            }
          />
          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? "Please wait…" : mode === "mobile" ? "Continue to secure payment" : "Pay from my balance"}
            </button>
            <button type="button" className="btn-ghost" onClick={() => setMode("none")}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
