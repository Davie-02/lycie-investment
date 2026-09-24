/**
 * Finance → one purchase: the customer, every cost line, how it was priced
 * (deal / promotion / discount and the saving), each payment and refund with
 * who recorded it, and the balance. From here staff record a payment (in any
 * currency, converted at a rate they can see), pay from the customer's
 * account balance, record a refund, void a mistaken payment (with a reason —
 * payments are never deleted), edit, cancel or reopen, and print a statement.
 */
import { useCallback, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import FormField from "@/components/forms/FormField";
import { useAsyncData } from "@/hooks/useAsyncData";
import { stageLabel } from "@/utils/shipmentStages";
import { ITEM_CATEGORIES, PAYMENT_METHODS, PAYMENT_STATUS_LABELS, PRICING_LABELS, PURCHASE_TYPES, money, paidPercent, paymentTone } from "@/utils/purchases";
import { adminApi } from "../../adminApi";
import { useAdminAuth } from "../../context/AdminAuthContext";
import PurchaseForm from "./PurchaseForm";
import { chipTone } from "./ui";
import type { AdminPurchase } from "./types";
import "../../components/AdminLayout.css";
import "./purchases.css";

type Panel = "none" | "payment" | "refund" | "balance" | "edit" | "cancel";

const SOURCE_LABEL: Record<string, string> = {
  staff: "Recorded by staff",
  mobile_money: "Mobile money (automatic)",
  payment_proof: "Approved payment proof",
  account_balance: "From account balance",
  overpayment: "Extra moved to balance",
};

export default function AdminPurchaseDetail() {
  const { id = "" } = useParams();
  const { can } = useAdminAuth();
  const canEdit = can("finance", "edit");
  const canManage = can("finance", "manage");
  const [refresh, setRefresh] = useState(0);
  const [panel, setPanel] = useState<Panel>("none");
  const [notice, setNotice] = useState<string | null>(null);
  const { data: p, isLoading, error } = useAsyncData(() => adminApi.get<AdminPurchase>(`/purchases/${id}`), [id, refresh], ["purchases"]);
  const { data: statement } = useAsyncData(
    () => (p ? adminApi.get<{ account: { balance: string; currency: string } | null }>(`/purchases/customers/${p.customer.id}`) : Promise.resolve(null)),
    [p?.customer.id, refresh]
  );

  const done = useCallback((message: string) => {
    setPanel("none");
    setNotice(message);
    setRefresh((n) => n + 1);
  }, []);

  if (isLoading && !p) return <p className="text-muted">Loading…</p>;
  if (error || !p) return <p className="form-status form-status--error">{error ?? "Purchase not found."}</p>;

  const active = p.status === "active";
  const owed = Number(p.balance);
  const wallet = statement?.account;

  async function voidPayment(paymentId: string) {
    const reason = window.prompt("Why is this payment being voided? (kept in the history)");
    if (!reason || reason.trim().length < 3) return;
    try {
      await adminApi.post(`/purchases/payments/${paymentId}/void`, { reason: reason.trim() });
      done("Payment voided. It stays in the history, crossed out.");
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Couldn't void it.");
    }
  }

  async function moveCredit() {
    try {
      await adminApi.post(`/purchases/${p!.id}/move-credit`, {});
      done("The extra has been moved to the customer's account balance, and they've been told.");
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Couldn't move it.");
    }
  }

  async function reopen() {
    try {
      await adminApi.post(`/purchases/${p!.id}/reopen`, {});
      done("Purchase reopened.");
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Couldn't reopen it.");
    }
  }

  return (
    <div className="purchase-detail">
      <p className="purchase-detail__back no-print">
        <Link to="/admin/purchases">← All purchases</Link>
      </p>

      <div className="ws-hero">
        <div>
          <h1>{p.title}</h1>
          <p>
            {PURCHASE_TYPES[p.type] ?? p.type} · <span className="mono">{p.reference}</span> · {new Date(p.purchasedAt).toLocaleDateString()}
            {p.createdByName ? ` · recorded by ${p.createdByName}` : ""}
          </p>
        </div>
        <div className="purchase-detail__badges">
          {p.pricing !== "standard" && <span className="ws-chip purchase-chip--offer">{PRICING_LABELS[p.pricing]}</span>}
          <span className={chipTone(paymentTone(p.paymentStatus))}>{PAYMENT_STATUS_LABELS[p.paymentStatus]}</span>
        </div>
      </div>

      {notice && (
        <p className="form-status form-status--info" role="status">
          {notice}
        </p>
      )}

      <section className="purchase-detail__top">
        <div className="form-card">
          <h2 className="purchase-detail__h">Customer</h2>
          <p style={{ margin: 0 }}>
            <Link to={`/admin/customer-accounts/${p.customer.id}`}>
              <strong>{p.customer.name}</strong>
            </Link>
          </p>
          <p className="text-muted" style={{ margin: 0 }}>
            {p.customer.email}
            {p.customer.phone ? ` · ${p.customer.phone}` : ""}
          </p>
          {wallet && (
            <p className="text-muted" style={{ marginBottom: 0 }}>
              Account balance: <strong>{money(wallet.balance, wallet.currency)}</strong>
            </p>
          )}
          {(p.vehicle || p.shipment || p.deal) && (
            <ul className="purchase-detail__links">
              {p.vehicle && (
                <li>
                  Vehicle: <Link to={`/vehicles/${p.vehicle.slug}`}>{`${p.vehicle.year} ${p.vehicle.make} ${p.vehicle.model}`}</Link>
                </li>
              )}
              {p.shipment && (
                <li>
                  Shipment: {p.shipment.title} · {stageLabel(p.shipment.stage)}
                </li>
              )}
              {p.deal && <li>Deal: {p.deal.title}</li>}
            </ul>
          )}
        </div>

        <div className="form-card purchase-detail__money">
          <div className="purchase-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={paidPercent(p.total, p.amountPaid)} aria-label="Paid">
            <span style={{ width: `${paidPercent(p.total, p.amountPaid)}%` }} />
          </div>
          <dl className="purchase-form__totals">
            <div>
              <dt>Total</dt>
              <dd>
                <strong>{money(p.total, p.currency)}</strong>
              </dd>
            </div>
            <div>
              <dt>Paid</dt>
              <dd>{money(p.amountPaid, p.currency)}</dd>
            </div>
            <div>
              <dt>{owed < 0 ? "Overpaid" : "Balance"}</dt>
              <dd className={owed > 0 && active ? "purchase-owed" : undefined}>
                <strong>{money(Math.abs(owed), p.currency)}</strong>
              </dd>
            </div>
            {p.dueDate && (
              <div>
                <dt>Due by</dt>
                <dd>{new Date(p.dueDate).toLocaleDateString()}</dd>
              </div>
            )}
          </dl>
          {canEdit && (
            <div className="purchase-detail__actions no-print">
              {active && owed > 0 && (
                <button type="button" className="btn btn-primary" onClick={() => setPanel("payment")}>
                  Record a payment
                </button>
              )}
              {active && owed > 0 && wallet && Number(wallet.balance) > 0 && (
                <button type="button" className="btn btn-secondary" onClick={() => setPanel("balance")}>
                  Pay from account balance
                </button>
              )}
              {owed < 0 && (
                <button type="button" className="btn btn-secondary" onClick={() => void moveCredit()}>
                  Move the extra {money(-owed, p.currency)} to their balance
                </button>
              )}
              {canManage && Number(p.amountPaid) > 0 && (
                <button type="button" className="btn-ghost" onClick={() => setPanel("refund")}>
                  Record a refund
                </button>
              )}
              {active && (
                <button type="button" className="btn-ghost" onClick={() => setPanel("edit")}>
                  Edit
                </button>
              )}
              {active ? (
                <button type="button" className="btn-ghost" onClick={() => setPanel("cancel")}>
                  Cancel purchase
                </button>
              ) : (
                <button type="button" className="btn-ghost" onClick={() => void reopen()}>
                  Reopen
                </button>
              )}
              <button type="button" className="btn-ghost" onClick={() => window.print()}>
                Print
              </button>
            </div>
          )}
        </div>
      </section>

      {!active && (
        <p className="form-status form-status--error">
          Cancelled{p.cancelledAt ? ` on ${new Date(p.cancelledAt).toLocaleDateString()}` : ""}
          {p.cancelReason ? `: ${p.cancelReason}` : ""}. {Number(p.amountPaid) > 0 ? "Money paid on it is still recorded — record a refund if it was given back." : ""}
        </p>
      )}

      {panel === "payment" && <PaymentForm purchase={p} kind="payment" onDone={done} onCancel={() => setPanel("none")} />}
      {panel === "refund" && <PaymentForm purchase={p} kind="refund" onDone={done} onCancel={() => setPanel("none")} />}
      {panel === "balance" && wallet && <BalanceForm purchase={p} wallet={wallet} onDone={done} onCancel={() => setPanel("none")} />}
      {panel === "cancel" && <CancelForm purchase={p} onDone={done} onCancel={() => setPanel("none")} />}
      {panel === "edit" && (
        <PurchaseForm
          existing={p}
          onDone={(saved) => {
            if (saved) done("Changes saved.");
            else setPanel("none");
          }}
        />
      )}

      <section className="form-card">
        <h2 className="purchase-detail__h">Costs</h2>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Kind</th>
                <th className="num">Qty</th>
                <th className="num">Price</th>
                <th className="num">Amount</th>
              </tr>
            </thead>
            <tbody>
              {p.items.map((item) => (
                <tr key={item.id}>
                  <td>{item.description}</td>
                  <td>{ITEM_CATEGORIES[item.category] ?? item.category}</td>
                  <td className="num">{item.quantity}</td>
                  <td className="num">{money(item.unitPrice, p.currency)}</td>
                  <td className="num">{money(item.amount, p.currency)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4}>Price before discount</td>
                <td className="num">{money(p.subtotal, p.currency)}</td>
              </tr>
              <tr>
                <td colSpan={4}>
                  {PRICING_LABELS[p.pricing]}
                  {p.offerName ? ` — ${p.offerName}` : ""}
                  {p.promoCode ? ` (code ${p.promoCode})` : ""}
                </td>
                <td className="num">{Number(p.discountAmount) > 0 ? `−${money(p.discountAmount, p.currency)}` : "—"}</td>
              </tr>
              <tr>
                <th colSpan={4}>Total</th>
                <th className="num">{money(p.total, p.currency)}</th>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <section className="form-card">
        <h2 className="purchase-detail__h">Payments & refunds</h2>
        {p.payments.length === 0 ? (
          <p className="text-muted">No payments yet.</p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>How</th>
                  <th>Reference</th>
                  <th className="num">Amount</th>
                  <th>Recorded</th>
                  {canManage && <th className="no-print" />}
                </tr>
              </thead>
              <tbody>
                {p.payments.map((pay) => (
                  <tr key={pay.id} className={pay.voidedAt ? "purchase-payment--void" : undefined}>
                    <td>{new Date(pay.paidAt).toLocaleDateString()}</td>
                    <td>
                      {pay.kind === "refund" ? <strong>Refund</strong> : PAYMENT_METHODS[pay.method] ?? pay.method}
                      {pay.receivedAmount && pay.receivedCurrency && (
                        <div className="text-muted">
                          {money(pay.receivedAmount, pay.receivedCurrency)} @ {Number(pay.exchangeRate).toLocaleString()} {pay.receivedCurrency}/{p.currency}
                        </div>
                      )}
                      {pay.note && <div className="text-muted">{pay.note}</div>}
                    </td>
                    <td className="mono">{pay.reference ?? "—"}</td>
                    <td className="num">{pay.kind === "refund" ? `−${money(pay.amount, p.currency)}` : money(pay.amount, p.currency)}</td>
                    <td>
                      <span className="text-muted">{pay.recordedByName ?? SOURCE_LABEL[pay.source] ?? pay.source}</span>
                      {pay.voidedAt && (
                        <div className="purchase-void-note">
                          Voided {new Date(pay.voidedAt).toLocaleDateString()}
                          {pay.voidedByName ? ` by ${pay.voidedByName}` : ""}: {pay.voidReason}
                        </div>
                      )}
                    </td>
                    {canManage && (
                      <td className="no-print">
                        {!pay.voidedAt && pay.source !== "overpayment" && (
                          <button type="button" className="btn-ghost" onClick={() => void voidPayment(pay.id)}>
                            Void
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {(p.customerNote || p.staffNote) && (
        <section className="form-card">
          <h2 className="purchase-detail__h">Notes</h2>
          {p.customerNote && (
            <p>
              <span className="text-muted">For the customer:</span> {p.customerNote}
            </p>
          )}
          {p.staffNote && (
            <p className="no-print">
              <span className="text-muted">Staff only:</span> {p.staffNote}
            </p>
          )}
        </section>
      )}
    </div>
  );
}

/** Kwacha per 1 of the purchase currency, from Finance → Prices & currency. */
function useRate(from: string, to: string) {
  return useAsyncData(() => (from === to ? Promise.resolve({ rate: "1" }) : adminApi.get<{ rate: string | null }>(`/purchases/rate?from=${from}&to=${to}`)), [from, to]).data?.rate ?? null;
}

function PaymentForm({ purchase: p, kind, onDone, onCancel }: { purchase: AdminPurchase; kind: "payment" | "refund"; onDone: (message: string) => void; onCancel: () => void }) {
  const [paidIn, setPaidIn] = useState(p.currency);
  const suggestedRate = useRate(p.currency, paidIn);
  const [amount, setAmount] = useState(kind === "payment" ? String(Math.max(0, Number(p.balance))) : "");
  const [received, setReceived] = useState("");
  const [rate, setRate] = useState("");
  const [method, setMethod] = useState("cash");
  const [reference, setReference] = useState("");
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [notify, setNotify] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const foreign = paidIn !== p.currency;
  const effectiveRate = Number(rate || suggestedRate || 0);
  const converted = foreign && effectiveRate > 0 && Number(received) > 0 ? Math.round((Number(received) / effectiveRate) * 100) / 100 : null;
  // What this payment counts as, compared with what's still owed.
  const counts = foreign ? converted : Number(amount) || null;
  const stillOwed = Math.max(0, Number(p.balance));
  const extra = kind === "payment" && counts !== null && counts > stillOwed ? Math.round((counts - stillOwed) * 100) / 100 : 0;

  async function submit(event: FormEvent) {
    event.preventDefault();
    const body: Record<string, unknown> = { kind, method, reference: reference.trim() || undefined, note: note.trim() || undefined, paidAt: new Date(`${paidAt}T12:00:00`).toISOString(), notifyCustomer: notify };
    if (foreign) {
      if (!(Number(received) > 0)) return setError("Enter the amount received.");
      if (!(effectiveRate > 0)) return setError(`Enter the exchange rate (${paidIn} per 1 ${p.currency}).`);
      Object.assign(body, { receivedAmount: Number(received), receivedCurrency: paidIn, exchangeRate: effectiveRate });
    } else {
      if (!(Number(amount) > 0)) return setError("Enter the amount.");
      body.amount = Math.round(Number(amount) * 100) / 100;
    }
    setBusy(true);
    setError(null);
    try {
      const saved = await adminApi.post<{ excess: { amount: string; currency: string } | null }>(`/purchases/${p.id}/payments`, body);
      onDone(
        kind === "refund"
          ? "Refund recorded."
          : `Payment recorded${notify ? " — the customer has been sent a receipt" : ""}.${saved.excess ? ` ${money(saved.excess.amount, saved.excess.currency)} extra went to their account balance and they've been told.` : ""}`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="form-card" onSubmit={submit} noValidate>
      <h2 className="purchase-detail__h">{kind === "refund" ? "Record a refund" : "Record a payment"}</h2>
      {error && (
        <p className="form-status form-status--error" role="alert">
          {error}
        </p>
      )}
      <div className="form-grid form-grid--2col">
        <FormField as="select" id="pay-currency" label={kind === "refund" ? "Refunded in" : "Paid in"} value={paidIn} onChange={(e) => setPaidIn(e.target.value)}>
          {[p.currency, ...["MWK", "USD"].filter((c) => c !== p.currency)].map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </FormField>
        {foreign ? (
          <>
            <FormField id="pay-received" label={`Amount (${paidIn})`} type="number" min="0" step="0.01" value={received} onChange={(e) => setReceived(e.target.value)} />
            <FormField
              id="pay-rate"
              label={`Exchange rate (${paidIn} per 1 ${p.currency})`}
              type="number"
              min="0"
              step="0.000001"
              value={rate}
              placeholder={suggestedRate ? String(Number(suggestedRate)) : "e.g. 1750"}
              onChange={(e) => setRate(e.target.value)}
              footer={<p className="text-muted purchase-pay__hint">{suggestedRate ? `Leave empty to use today's rate (${Number(suggestedRate).toLocaleString()}).` : "No rate is known — please enter one."}</p>}
            />
            <div className="purchase-line__amount">
              <span className="text-muted">Counts as</span>
              <strong>{converted !== null ? money(converted, p.currency) : "—"}</strong>
            </div>
          </>
        ) : (
          <FormField id="pay-amount" label={`Amount (${p.currency})`} type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
        )}
        <FormField as="select" id="pay-method" label="How" value={method} onChange={(e) => setMethod(e.target.value)}>
          {Object.entries(PAYMENT_METHODS)
            .filter(([key]) => key !== "account_balance")
            .map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
        </FormField>
        <FormField id="pay-ref" label="Receipt / bank / mobile-money reference" value={reference} maxLength={120} onChange={(e) => setReference(e.target.value)} />
        <FormField id="pay-date" label={kind === "refund" ? "Date refunded" : "Date received"} type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
        <FormField id="pay-note" label="Note (optional)" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
      </div>
      {kind === "payment" && counts !== null && counts > 0 && (
        <p className={extra > 0 ? "pay-note pay-note--warn" : "pay-note"}>
          {extra > 0
            ? `This is ${money(extra, p.currency)} more than is owed (${money(stillOwed, p.currency)}). Only what's owed goes on this purchase; the extra goes to the customer's account balance and they'll be told.`
            : counts === stillOwed
              ? "This pays the purchase in full."
              : `This pays part of it; ${money(Math.round((stillOwed - counts) * 100) / 100, p.currency)} will still be owed.`}
        </p>
      )}
      <label className="purchase-form__check">
        <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} /> Send the customer a receipt
      </label>
      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? "Saving…" : kind === "refund" ? "Record refund" : "Record payment"}
        </button>
        <button type="button" className="btn-ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function BalanceForm({ purchase: p, wallet, onDone, onCancel }: { purchase: AdminPurchase; wallet: { balance: string; currency: string }; onDone: (message: string) => void; onCancel: () => void }) {
  const suggestedRate = useRate(p.currency, wallet.currency);
  const [rate, setRate] = useState("");
  const effectiveRate = Number(rate || suggestedRate || 0);
  const maxSpend = effectiveRate > 0 ? Math.min(Number(wallet.balance), Math.ceil(Number(p.balance) * effectiveRate * 100) / 100) : Number(wallet.balance);
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const foreign = wallet.currency !== p.currency;

  async function submit(event: FormEvent) {
    event.preventDefault();
    const spend = Number(amount || maxSpend);
    if (!(spend > 0)) return setError("Enter the amount.");
    setBusy(true);
    setError(null);
    try {
      await adminApi.post(`/purchases/${p.id}/apply-balance`, { amount: spend, exchangeRate: foreign && rate ? Number(rate) : undefined });
      onDone(`${money(spend, wallet.currency)} taken from the account balance and paid toward this purchase.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="form-card" onSubmit={submit} noValidate>
      <h2 className="purchase-detail__h">Pay from the account balance</h2>
      <p className="text-muted">
        The customer has {money(wallet.balance, wallet.currency)} in their account (deposits, referral rewards…).
      </p>
      {error && (
        <p className="form-status form-status--error" role="alert">
          {error}
        </p>
      )}
      <div className="form-grid form-grid--2col">
        <FormField id="bal-amount" label={`Amount to take (${wallet.currency})`} type="number" min="0" step="0.01" value={amount} placeholder={String(maxSpend)} onChange={(e) => setAmount(e.target.value)} />
        {foreign && (
          <FormField
            id="bal-rate"
            label={`Exchange rate (${wallet.currency} per 1 ${p.currency})`}
            type="number"
            min="0"
            step="0.000001"
            value={rate}
            placeholder={suggestedRate ? String(Number(suggestedRate)) : ""}
            onChange={(e) => setRate(e.target.value)}
          />
        )}
      </div>
      {foreign && effectiveRate > 0 && <p className="text-muted">Counts as {money(Math.round((Number(amount || maxSpend) / effectiveRate) * 100) / 100, p.currency)} toward this purchase.</p>}
      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? "Saving…" : "Pay from balance"}
        </button>
        <button type="button" className="btn-ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function CancelForm({ purchase: p, onDone, onCancel }: { purchase: AdminPurchase; onDone: (message: string) => void; onCancel: () => void }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      await adminApi.post(`/purchases/${p.id}/cancel`, { reason: reason.trim() });
      onDone("Purchase cancelled.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't cancel.");
    }
  }

  return (
    <form className="form-card" onSubmit={submit} noValidate>
      <h2 className="purchase-detail__h">Cancel this purchase</h2>
      <p className="text-muted">It stays on record (marked cancelled) and stops counting toward what the customer owes.{Number(p.amountPaid) > 0 ? " Payments already made stay recorded — record a refund if money is given back." : ""}</p>
      {error && (
        <p className="form-status form-status--error" role="alert">
          {error}
        </p>
      )}
      <FormField id="cancel-reason" label="Reason" required value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} />
      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={reason.trim().length < 3}>
          Cancel purchase
        </button>
        <button type="button" className="btn-ghost" onClick={onCancel}>
          Keep it
        </button>
      </div>
    </form>
  );
}
