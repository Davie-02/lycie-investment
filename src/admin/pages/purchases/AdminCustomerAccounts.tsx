/**
 * Finance → Customer accounts: each customer's money at a glance — how much
 * they've bought, paid and still owe (per currency), what they saved on deals,
 * and their account balance. Customers with overdue balances come first.
 */
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAsyncData } from "@/hooks/useAsyncData";
import { money } from "@/utils/purchases";
import { adminApi } from "../../adminApi";
import type { CustomerAccountRow } from "./types";
import "../../components/AdminLayout.css";
import "./purchases.css";

export default function AdminCustomerAccounts() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [all, setAll] = useState(false);
  const [owingOnly, setOwingOnly] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const { data, isLoading } = useAsyncData(
    () => adminApi.get<CustomerAccountRow[]>(`/purchases/customers?q=${encodeURIComponent(search)}${all ? "&all=1" : ""}`),
    [search, all],
    ["purchases"]
  );
  const rows = (data ?? []).filter((c) => !owingOnly || c.totals.some((t) => Number(t.owed) > 0));

  return (
    <div>
      <div className="ws-hero">
        <div>
          <h1>Customer accounts</h1>
          <p>What each customer has bought, paid and still owes. Open one for their full statement.</p>
        </div>
      </div>

      <div className="ws-toolbar">
        <input type="search" placeholder="Name, email or phone…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search customers" />
        <label className="purchase-form__check">
          <input type="checkbox" checked={owingOnly} onChange={(e) => setOwingOnly(e.target.checked)} /> Only customers who owe
        </label>
        <label className="purchase-form__check">
          <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} /> Include customers with no purchases
        </label>
      </div>

      {isLoading && !data && <p className="text-muted">Loading…</p>}
      {data && rows.length === 0 && <div className="admin-empty-state">{search ? "No customers match." : "No customer has bought anything yet."}</div>}
      {rows.length > 0 && (
        <div className="admin-table-wrap">
          <table className="admin-table purchase-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th className="num">Purchases</th>
                <th className="num">Bought</th>
                <th className="num">Paid</th>
                <th className="num">Owes</th>
                <th className="num">Saved</th>
                <th className="num">Account balance</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="purchase-table__row" onClick={() => navigate(`/admin/customer-accounts/${c.id}`)}>
                  <td>
                    <Link to={`/admin/customer-accounts/${c.id}`} onClick={(e) => e.stopPropagation()}>
                      <strong>{c.name}</strong>
                    </Link>
                    <div className="text-muted">{c.email}</div>
                    {c.overdue > 0 && <span className="ws-chip ws-chip--bad">{c.overdue} overdue</span>}
                  </td>
                  <td className="num">
                    {c.purchases}
                    {c.lastPurchaseAt && <div className="text-muted">last {new Date(c.lastPurchaseAt).toLocaleDateString()}</div>}
                  </td>
                  <PerCurrency totals={c.totals} field="purchased" />
                  <PerCurrency totals={c.totals} field="paid" />
                  <PerCurrency totals={c.totals} field="owed" highlight />
                  <PerCurrency totals={c.totals} field="saved" />
                  <td className="num">{c.accountBalance ? money(c.accountBalance.amount, c.accountBalance.currency) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PerCurrency({ totals, field, highlight }: { totals: CustomerAccountRow["totals"]; field: "purchased" | "paid" | "owed" | "saved"; highlight?: boolean }) {
  if (totals.length === 0) return <td className="num text-muted">—</td>;
  return (
    <td className="num">
      {totals.map((t) => (
        <div key={t.currency} className={highlight && Number(t[field]) > 0 ? "purchase-owed" : undefined}>
          {Number(t[field]) === 0 && field !== "purchased" ? <span className="text-muted">—</span> : money(t[field], t.currency)}
        </div>
      ))}
    </td>
  );
}
