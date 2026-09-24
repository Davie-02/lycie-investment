/**
 * My purchases: everything the customer has bought from us — each cost, any
 * deal, promotion or discount (and what they saved), every payment, and the
 * balance still to pay. "Pay" opens the payment flow with that purchase chosen.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
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
            <PurchaseCard key={purchase.id} purchase={purchase} />
          ))}
        </>
      )}
    </>
  );
}

function PurchaseCard({ purchase: p }: { purchase: Purchase }) {
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

      {owing && (
        <div className="purchase-pay">
          <div className="purchase-pay__buttons">
            <Link to={`/account/payments?purchase=${p.id}`} className="btn btn-primary">
              Pay {money(p.balance, p.currency)}
            </Link>
            <span className="text-muted">By mobile money, from your balance, or with proof of a bank payment.</span>
          </div>
        </div>
      )}
    </article>
  );
}
