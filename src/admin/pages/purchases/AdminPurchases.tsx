/**
 * Finance → Sales & balances: every customer purchase with its total, what's
 * paid and what's owed, and how it was priced (standard, deal, promotion,
 * discount). Totals for the chosen period sit on top — sales, money collected,
 * outstanding and overdue balances, discounts given — with breakdowns by kind
 * of purchase and by pricing. Filter, export to a spreadsheet, or record a new
 * purchase; open one to see its costs and payments.
 */
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAsyncData } from "@/hooks/useAsyncData";
import { PAYMENT_METHODS, PAYMENT_STATUS_LABELS, PRICING_LABELS, PURCHASE_TYPES, money, paymentTone } from "@/utils/purchases";
import { adminApi, downloadCsv } from "../../adminApi";
import { useAdminAuth } from "../../context/AdminAuthContext";
import AdminPagination from "../../components/AdminPagination";
import PurchaseForm from "./PurchaseForm";
import type { PurchaseRow, PurchaseSummary } from "./types";
import { chipTone } from "./ui";
import "../../components/AdminLayout.css";
import "./purchases.css";

type Period = "month" | "30d" | "year" | "all" | "custom";

const PERIODS: Array<[Period, string]> = [
  ["month", "This month"],
  ["30d", "Last 30 days"],
  ["year", "This year"],
  ["all", "All time"],
  ["custom", "Choose dates"],
];

const iso = (d: Date) => d.toISOString().slice(0, 10);

function periodRange(period: Period, from: string, to: string): { from?: string; to?: string } {
  const now = new Date();
  if (period === "month") return { from: iso(new Date(now.getFullYear(), now.getMonth(), 1)) };
  if (period === "30d") return { from: iso(new Date(now.getTime() - 30 * 24 * 60 * 60_000)) };
  if (period === "year") return { from: iso(new Date(now.getFullYear(), 0, 1)) };
  if (period === "custom") return { from: from || undefined, to: to || undefined };
  return {};
}

export default function AdminPurchases() {
  const { can } = useAdminAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const canEdit = can("finance", "edit");
  const canManage = can("finance", "manage");

  const [period, setPeriod] = useState<Period>((params.get("period") as Period) || "all");
  const [from, setFrom] = useState(params.get("from") ?? "");
  const [to, setTo] = useState(params.get("to") ?? "");
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [search, setSearch] = useState(query);
  const [type, setType] = useState(params.get("type") ?? "");
  const [pricing, setPricing] = useState(params.get("pricing") ?? "");
  const [payment, setPayment] = useState(params.get("payment") ?? "");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(params.get("new") === "1");
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const filterQuery = useMemo(() => {
    const range = periodRange(period, from, to);
    const qs = new URLSearchParams();
    if (search) qs.set("q", search);
    if (type) qs.set("type", type);
    if (pricing) qs.set("pricing", pricing);
    if (payment) qs.set("payment", payment);
    if (range.from) qs.set("from", range.from);
    if (range.to) qs.set("to", range.to);
    return qs.toString();
  }, [search, type, pricing, payment, period, from, to]);

  // Keep the filters in the address, so a filtered view can be bookmarked or shared with a colleague.
  useEffect(() => {
    const next = new URLSearchParams();
    if (period !== "all") next.set("period", period);
    if (period === "custom" && from) next.set("from", from);
    if (period === "custom" && to) next.set("to", to);
    if (search) next.set("q", search);
    if (type) next.set("type", type);
    if (pricing) next.set("pricing", pricing);
    if (payment) next.set("payment", payment);
    setParams(next, { replace: true });
    setPage(1);
  }, [period, from, to, search, type, pricing, payment, setParams]);

  const { data: list, isLoading } = useAsyncData(
    () => adminApi.get<{ items: PurchaseRow[]; total: number; page: number; pageSize: number }>(`/purchases?${filterQuery}&page=${page}&pageSize=50`),
    [filterQuery, page],
    ["purchases"]
  );
  const { data: summary } = useAsyncData(() => adminApi.get<PurchaseSummary>(`/purchases/summary?${filterQuery}`), [filterQuery], ["purchases"]);

  async function exportCsv() {
    setExportError(null);
    try {
      await downloadCsv(`/purchases/export?${filterQuery}`, "purchases.csv");
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Couldn't export.");
    }
  }

  const filtered = Boolean(search || type || pricing || payment || period !== "all");

  return (
    <div>
      <div className="ws-hero">
        <div>
          <h1>Sales & balances</h1>
          <p>What customers bought, what it cost, deals and discounts, and what is still owed.</p>
        </div>
        <div className="admin-table__actions">
          {canManage && (
            <button type="button" className="btn btn-secondary" onClick={() => void exportCsv()}>
              Export to spreadsheet
            </button>
          )}
          {canEdit && (
            <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
              + Record a purchase
            </button>
          )}
        </div>
      </div>
      {exportError && (
        <p className="form-status form-status--error" role="alert">
          {exportError}
        </p>
      )}

      {creating && (
        <PurchaseForm
          onDone={(saved) => {
            setCreating(false);
            if (saved) navigate(`/admin/purchases/${saved.id}`);
          }}
        />
      )}

      <div className="ws-toolbar purchase-toolbar">
        <select value={period} onChange={(e) => setPeriod(e.target.value as Period)} aria-label="Period">
          {PERIODS.map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        {period === "custom" && (
          <>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From" />
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To" />
          </>
        )}
        <input type="search" placeholder="Customer, reference, vehicle, promo code…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search purchases" />
        <select value={type} onChange={(e) => setType(e.target.value)} aria-label="Type">
          <option value="">All types</option>
          {Object.entries(PURCHASE_TYPES).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        <select value={pricing} onChange={(e) => setPricing(e.target.value)} aria-label="Pricing">
          <option value="">Any pricing</option>
          <option value="offer">Any deal, promotion or discount</option>
          {Object.entries(PRICING_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        <select value={payment} onChange={(e) => setPayment(e.target.value)} aria-label="Payment status">
          <option value="">Any payment status</option>
          <option value="owing">Still owing</option>
          {Object.entries(PAYMENT_STATUS_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        {filtered && (
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              setPeriod("all");
              setQuery("");
              setType("");
              setPricing("");
              setPayment("");
            }}
          >
            Clear filters
          </button>
        )}
      </div>

      {summary && <SummaryPanels summary={summary} onPick={(next) => {
            if (next.payment !== undefined) setPayment(next.payment);
            if (next.pricing !== undefined) setPricing(next.pricing);
            if (next.type !== undefined) setType(next.type);
          }} />}

      {isLoading && !list && <p className="text-muted">Loading…</p>}
      {list && list.items.length === 0 && <div className="admin-empty-state">{filtered ? "No purchases match these filters." : "No purchases recorded yet."}</div>}
      {list && list.items.length > 0 && (
        <>
          <div className="admin-table-wrap">
            <table className="admin-table purchase-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>What</th>
                  <th>Pricing</th>
                  <th className="num">Total</th>
                  <th className="num">Paid</th>
                  <th className="num">Balance</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {list.items.map((p) => (
                  <tr key={p.id} className="purchase-table__row" onClick={() => navigate(`/admin/purchases/${p.id}`)}>
                    <td>
                      {new Date(p.purchasedAt).toLocaleDateString()}
                      <div className="text-muted mono">{p.reference}</div>
                    </td>
                    <td>
                      <Link to={`/admin/customer-accounts/${p.customer.id}`} onClick={(e) => e.stopPropagation()}>
                        {p.customer.name}
                      </Link>
                      <div className="text-muted">{p.customer.email}</div>
                    </td>
                    <td>
                      <Link to={`/admin/purchases/${p.id}`} onClick={(e) => e.stopPropagation()}>
                        <strong>{p.title}</strong>
                      </Link>
                      <div className="text-muted">{PURCHASE_TYPES[p.type] ?? p.type}</div>
                    </td>
                    <td>
                      {p.pricing === "standard" ? (
                        <span className="text-muted">Standard</span>
                      ) : (
                        <>
                          <span className="ws-chip purchase-chip--offer">{PRICING_LABELS[p.pricing]}</span>
                          {p.offerName && <div className="text-muted">{p.offerName}</div>}
                          {Number(p.discountAmount) > 0 && <div className="text-muted">−{money(p.discountAmount, p.currency)}</div>}
                        </>
                      )}
                    </td>
                    <td className="num">{money(p.total, p.currency)}</td>
                    <td className="num">{money(p.amountPaid, p.currency)}</td>
                    <td className={Number(p.balance) > 0 && p.status === "active" ? "num purchase-owed" : "num"}>{money(p.balance, p.currency)}</td>
                    <td>
                      <span className={chipTone(paymentTone(p.paymentStatus))}>{PAYMENT_STATUS_LABELS[p.paymentStatus]}</span>
                      {p.dueDate && p.paymentStatus !== "paid" && p.status === "active" && <div className="text-muted">due {new Date(p.dueDate).toLocaleDateString()}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <AdminPagination page={list.page} pageSize={list.pageSize} total={list.total} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}

function SummaryPanels({ summary, onPick }: { summary: PurchaseSummary; onPick: (filter: { payment?: string; pricing?: string; type?: string }) => void }) {
  if (summary.currencies.length === 0) return null;
  return (
    <section className="ws-section">
      {summary.currencies.map((c) => {
        const collected = summary.collected.find((x) => x.currency === c.currency);
        return (
          <div key={c.currency} className="purchase-summary">
            {summary.currencies.length > 1 && <h2 className="purchase-summary__currency">{c.currency}</h2>}
            <div className="ws-stats">
              <div className="ws-stat">
                <span className="ws-stat__value">{money(c.total, c.currency)}</span>
                <span className="ws-stat__label">
                  Sales ({c.count} purchase{c.count === 1 ? "" : "s"})
                </span>
              </div>
              <div className="ws-stat">
                <span className="ws-stat__value">{money(c.paid, c.currency)}</span>
                <span className="ws-stat__label">Paid on these</span>
              </div>
              <button type="button" className="ws-stat purchase-stat-button" onClick={() => onPick({ payment: "owing" })}>
                <span className="ws-stat__value">{money(c.outstanding, c.currency)}</span>
                <span className="ws-stat__label">Still owed by customers</span>
              </button>
              <button type="button" className={c.overdue > 0 ? "ws-stat ws-stat--attention purchase-stat-button" : "ws-stat purchase-stat-button"} onClick={() => onPick({ payment: "overdue" })}>
                <span className="ws-stat__value">{money(c.overdueAmount, c.currency)}</span>
                <span className="ws-stat__label">Overdue ({c.overdue})</span>
              </button>
              <button type="button" className="ws-stat purchase-stat-button" onClick={() => onPick({ pricing: "offer" })}>
                <span className="ws-stat__value">{money(c.discounts, c.currency)}</span>
                <span className="ws-stat__label">Discounts given ({c.onOffer} on an offer)</span>
              </button>
              {collected && (
                <div className="ws-stat" title="Money actually received in this period, by payment date, minus refunds">
                  <span className="ws-stat__value">{money(collected.net, c.currency)}</span>
                  <span className="ws-stat__label">Money received in period</span>
                </div>
              )}
            </div>

            <div className="purchase-breakdowns">
              <div className="purchase-breakdown">
                <h3>By kind of purchase</h3>
                <table className="admin-table">
                  <tbody>
                    {summary.byType
                      .filter((t) => t.currency === c.currency)
                      .map((t) => (
                        <tr key={t.type}>
                          <td>
                            <button type="button" className="link-button" onClick={() => onPick({ type: t.type })}>
                              {PURCHASE_TYPES[t.type] ?? t.type}
                            </button>
                          </td>
                          <td className="num">{t.count}</td>
                          <td className="num">
                            {money(t.total, c.currency)}
                            <div className="text-muted">{Number(t.outstanding) > 0 ? `${money(t.outstanding, c.currency)} owed` : "all paid"}</div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              <div className="purchase-breakdown">
                <h3>By pricing</h3>
                <table className="admin-table">
                  <tbody>
                    {summary.byPricing
                      .filter((p) => p.currency === c.currency)
                      .map((p) => (
                        <tr key={p.pricing}>
                          <td>
                            <button type="button" className="link-button" onClick={() => onPick({ pricing: p.pricing })}>
                              {PRICING_LABELS[p.pricing] ?? p.pricing}
                            </button>
                          </td>
                          <td className="num">{p.count}</td>
                          <td className="num">
                            {money(p.total, c.currency)}
                            {Number(p.discounts) > 0 && <div className="text-muted">−{money(p.discounts, c.currency)} discount</div>}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              {collected && Object.keys(collected.byMethod).length > 0 && (
                <div className="purchase-breakdown">
                  <h3>Received, by how they paid</h3>
                  <table className="admin-table">
                    <tbody>
                      {Object.entries(collected.byMethod).map(([method, amount]) => (
                        <tr key={method}>
                          <td>{PAYMENT_METHODS[method] ?? method}</td>
                          <td className="num">{money(amount, c.currency)}</td>
                        </tr>
                      ))}
                      {Number(collected.refunded) > 0 && (
                        <tr>
                          <td>Refunded</td>
                          <td className="num">−{money(collected.refunded, c.currency)}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </section>
  );
}
