/**
 * Recording (or correcting) a purchase: who bought it, what it is, each cost
 * line, how it was priced (standard, deal, promotion or discount), links to the
 * vehicle/deal/shipment, notes, and — when recording — a deposit taken there
 * and then. Totals are shown as you type; the server works out the real ones.
 */
import { useEffect, useMemo, useState, type FormEvent } from "react";
import FormField from "@/components/forms/FormField";
import { ITEM_CATEGORIES, PAYMENT_METHODS, PRICING_LABELS, PURCHASE_TYPES, money } from "@/utils/purchases";
import { adminApi } from "../../adminApi";
import CustomerPicker, { type CustomerChoice } from "./CustomerPicker";
import type { AdminPurchase } from "./types";

interface Options {
  deals: Array<{ id: string; title: string; priceUsd: number | null; status: string }>;
  vehicles: Array<{ id: string; make: string; model: string; year: number; price: number; currency: string; status: string }>;
  shipments: Array<{ id: string; title: string; kind: string; stage: string | null }>;
}

interface Line {
  key: number;
  category: string;
  description: string;
  quantity: string;
  unitPrice: string;
}

const CURRENCIES = ["USD", "MWK", "ZAR", "EUR", "GBP", "JPY"];
const round2 = (n: number) => Math.round(n * 100) / 100;
const dateInput = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : "");
let nextKey = 1;
const blankLine = (category = "vehicle"): Line => ({ key: nextKey++, category, description: "", quantity: "1", unitPrice: "" });

/** Sensible first cost line for each kind of purchase. */
const FIRST_CATEGORY: Record<string, string> = { vehicle: "vehicle", import: "vehicle", clearing: "clearing", hire: "hire", parts: "parts", service: "service", other: "other" };

export default function PurchaseForm({
  existing,
  presetCustomer,
  onDone,
}: {
  existing?: AdminPurchase;
  presetCustomer?: CustomerChoice | null;
  onDone: (saved: AdminPurchase | null) => void;
}) {
  const editing = Boolean(existing);
  const [customer, setCustomer] = useState<CustomerChoice | null>(existing ? existing.customer : presetCustomer ?? null);
  const [type, setType] = useState(existing?.type ?? "vehicle");
  const [title, setTitle] = useState(existing?.title ?? "");
  const [currency, setCurrency] = useState(existing?.currency ?? "USD");
  const [purchasedAt, setPurchasedAt] = useState(dateInput(existing?.purchasedAt) || new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(dateInput(existing?.dueDate));
  const [lines, setLines] = useState<Line[]>(
    existing
      ? existing.items.map((i) => ({ key: nextKey++, category: i.category, description: i.description, quantity: String(i.quantity), unitPrice: String(Number(i.unitPrice)) }))
      : [blankLine()]
  );
  const [pricing, setPricing] = useState(existing?.pricing ?? "standard");
  const [dealId, setDealId] = useState(existing?.deal?.id ?? "");
  const [offerName, setOfferName] = useState(existing?.offerName ?? "");
  const [promoCode, setPromoCode] = useState(existing?.promoCode ?? "");
  const [discountType, setDiscountType] = useState<"amount" | "percent">("amount");
  const [discountValue, setDiscountValue] = useState(existing && Number(existing.discountAmount) > 0 ? String(Number(existing.discountAmount)) : "");
  const [vehicleId, setVehicleId] = useState(existing?.vehicle?.id ?? "");
  const [markSold, setMarkSold] = useState(true);
  const [caseId, setCaseId] = useState(existing?.shipment?.id ?? "");
  const [customerNote, setCustomerNote] = useState(existing?.customerNote ?? "");
  const [staffNote, setStaffNote] = useState(existing?.staffNote ?? "");
  const [deposit, setDeposit] = useState("");
  const [depositMethod, setDepositMethod] = useState("cash");
  const [depositRef, setDepositRef] = useState("");
  const [notify, setNotify] = useState(true);
  const [options, setOptions] = useState<Options>({ deals: [], vehicles: [], shipments: [] });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    adminApi
      .get<Options>(`/purchases/options${customer ? `?customerId=${customer.id}` : ""}`)
      .then(setOptions)
      .catch(() => undefined);
  }, [customer]);

  const subtotal = useMemo(() => round2(lines.reduce((sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0), 0)), [lines]);
  const discount = useMemo(() => {
    const value = Number(discountValue) || 0;
    if (value <= 0) return 0;
    return round2(Math.min(subtotal, discountType === "percent" ? (subtotal * Math.min(value, 100)) / 100 : value));
  }, [discountType, discountValue, subtotal]);
  const total = round2(subtotal - discount);

  const setLine = (key: number, patch: Partial<Line>) => setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  function chooseVehicle(id: string) {
    setVehicleId(id);
    const vehicle = options.vehicles.find((v) => v.id === id);
    if (!vehicle) return;
    const label = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
    if (!title.trim()) setTitle(label);
    if (vehicle.currency !== currency && !editing) setCurrency(vehicle.currency);
    // Fill the first vehicle cost line (or add one) with the listed price.
    setLines((prev) => {
      const index = prev.findIndex((l) => l.category === "vehicle");
      const filled = { category: "vehicle", description: label, quantity: "1", unitPrice: String(vehicle.price) };
      if (index === -1) return [{ key: nextKey++, ...filled }, ...prev];
      return prev.map((l, i) => (i === index ? { ...l, ...filled } : l));
    });
  }

  function chooseDeal(id: string) {
    setDealId(id);
    const deal = options.deals.find((d) => d.id === id);
    if (deal && !offerName.trim()) setOfferName(deal.title);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!customer) return setError("Choose the customer.");
    const items = lines
      .filter((l) => l.description.trim() || l.unitPrice.trim())
      .map((l) => ({ category: l.category, description: l.description.trim(), quantity: Math.max(1, Math.round(Number(l.quantity) || 1)), unitPrice: round2(Number(l.unitPrice) || 0) }));
    if (items.length === 0) return setError("Add at least one cost line.");
    if (items.some((i) => !i.description)) return setError("Every cost line needs a description.");
    if (pricing === "deal" && !dealId && !offerName.trim()) return setError("Choose the deal, or type its name.");
    if (pricing === "promotion" && !offerName.trim()) return setError("Type the promotion's name.");

    const body: Record<string, unknown> = {
      type,
      title: title.trim(),
      items,
      pricing,
      dealId: pricing === "deal" && dealId ? dealId : null,
      offerName: pricing === "standard" ? null : offerName.trim() || null,
      promoCode: pricing === "standard" ? null : promoCode.trim() || null,
      discountType,
      discountValue: Number(discountValue) || 0,
      purchasedAt: new Date(`${purchasedAt}T12:00:00`).toISOString(),
      dueDate: dueDate ? new Date(`${dueDate}T12:00:00`).toISOString() : null,
      vehicleId: vehicleId || null,
      caseId: caseId || null,
      customerNote: customerNote.trim() || null,
      staffNote: staffNote.trim() || null,
    };
    if (!editing) {
      Object.assign(body, { customerId: customer.id, currency, notifyCustomer: notify, markVehicleSold: Boolean(vehicleId) && markSold });
      if (Number(deposit) > 0) body.initialPayment = { amount: round2(Number(deposit)), method: depositMethod, reference: depositRef.trim() || undefined, notifyCustomer: false };
      // Null means "not set" when editing; a new purchase simply leaves it out.
      for (const key of Object.keys(body)) if (body[key] === null) delete body[key];
    }

    setBusy(true);
    setError(null);
    try {
      const saved = editing ? await adminApi.patch<AdminPurchase>(`/purchases/${existing!.id}`, body) : await adminApi.post<AdminPurchase>("/purchases", body);
      onDone(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="form-card purchase-form" onSubmit={submit} noValidate>
      <h2 style={{ marginTop: 0 }}>{editing ? `Edit ${existing!.reference}` : "Record a purchase"}</h2>
      {error && (
        <p className="form-status form-status--error" role="alert">
          {error}
        </p>
      )}

      <fieldset className="purchase-form__group">
        <legend>What was bought</legend>
        <div className="form-grid form-grid--2col">
          <div className="form-grid__full">{editing ? <p style={{ margin: 0 }}>Customer: <strong>{customer?.name}</strong> ({customer?.email})</p> : <CustomerPicker value={customer} onChange={setCustomer} />}</div>
          <FormField as="select" id="purchase-type" label="Type" value={type} onChange={(e) => setType(e.target.value)}>
            {Object.entries(PURCHASE_TYPES).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </FormField>
          <FormField id="purchase-title" label="Description" required placeholder="e.g. 2019 Toyota Hilux, white" value={title} maxLength={160} onChange={(e) => setTitle(e.target.value)} />
          {(type === "vehicle" || type === "import") && (
            <FormField as="select" id="purchase-vehicle" label="Vehicle from our listings (optional)" value={vehicleId} onChange={(e) => chooseVehicle(e.target.value)}>
              <option value="">— none —</option>
              {options.vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.year} {v.make} {v.model} · {money(v.price, v.currency)}
                  {v.status === "reserved" ? " (reserved)" : ""}
                </option>
              ))}
            </FormField>
          )}
          {options.shipments.length > 0 && (
            <FormField as="select" id="purchase-shipment" label="Shipment it pays for (optional)" value={caseId} onChange={(e) => setCaseId(e.target.value)}>
              <option value="">— none —</option>
              {options.shipments.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title} ({s.kind})
                </option>
              ))}
            </FormField>
          )}
          {!editing && vehicleId && (
            <label className="purchase-form__check form-grid__full">
              <input type="checkbox" checked={markSold} onChange={(e) => setMarkSold(e.target.checked)} /> Mark this vehicle as sold on the website
            </label>
          )}
          <FormField as="select" id="purchase-currency" label="Currency" value={currency} disabled={editing} onChange={(e) => setCurrency(e.target.value)}>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </FormField>
          <FormField id="purchase-date" label="Date of purchase" type="date" value={purchasedAt} onChange={(e) => setPurchasedAt(e.target.value)} />
          <FormField id="purchase-due" label="Balance due by (optional)" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
      </fieldset>

      <fieldset className="purchase-form__group">
        <legend>Costs</legend>
        <div className="purchase-lines">
          {lines.map((line, index) => (
            <div key={line.key} className="purchase-line">
              <FormField as="select" id={`line-cat-${line.key}`} label="Kind" value={line.category} onChange={(e) => setLine(line.key, { category: e.target.value })}>
                {Object.entries(ITEM_CATEGORIES).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </FormField>
              <FormField id={`line-desc-${line.key}`} label="Description" value={line.description} maxLength={200} onChange={(e) => setLine(line.key, { description: e.target.value })} />
              <FormField id={`line-qty-${line.key}`} label="Qty" type="number" min="1" step="1" value={line.quantity} onChange={(e) => setLine(line.key, { quantity: e.target.value })} />
              <FormField id={`line-price-${line.key}`} label={`Price (${currency})`} type="number" min="0" step="0.01" value={line.unitPrice} onChange={(e) => setLine(line.key, { unitPrice: e.target.value })} />
              <div className="purchase-line__amount">
                <span className="text-muted">Amount</span>
                <strong>{money(round2((Number(line.quantity) || 0) * (Number(line.unitPrice) || 0)), currency)}</strong>
              </div>
              {lines.length > 1 && (
                <button type="button" className="btn-ghost purchase-line__remove" aria-label={`Remove cost line ${index + 1}`} onClick={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}>
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
        <button type="button" className="btn-ghost" onClick={() => setLines((prev) => [...prev, blankLine(prev.length ? "fee" : FIRST_CATEGORY[type])])}>
          + Add a cost
        </button>
      </fieldset>

      <fieldset className="purchase-form__group">
        <legend>Price, deals and discounts</legend>
        <div className="purchase-pricing" role="radiogroup" aria-label="How it was priced">
          {Object.entries(PRICING_LABELS).map(([key, label]) => (
            <label key={key} className={pricing === key ? "purchase-pricing__option purchase-pricing__option--on" : "purchase-pricing__option"}>
              <input type="radio" name="pricing" value={key} checked={pricing === key} onChange={() => setPricing(key)} /> {label}
            </label>
          ))}
        </div>
        <div className="form-grid form-grid--2col">
          {pricing === "deal" && (
            <FormField as="select" id="purchase-deal" label="Which deal" value={dealId} onChange={(e) => chooseDeal(e.target.value)}>
              <option value="">— not in the list —</option>
              {options.deals.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title}
                  {d.status === "PUBLISHED" ? "" : " (not published)"}
                </option>
              ))}
            </FormField>
          )}
          {pricing !== "standard" && (
            <FormField
              id="purchase-offer"
              label={pricing === "discount" ? "Reason for the discount" : pricing === "deal" ? "Deal name" : "Promotion name"}
              value={offerName}
              maxLength={120}
              placeholder={pricing === "discount" ? "e.g. Returning customer, cash payment" : "e.g. September Hilux promotion"}
              onChange={(e) => setOfferName(e.target.value)}
            />
          )}
          {(pricing === "promotion" || pricing === "deal") && (
            <FormField id="purchase-promo" label="Promo code (optional)" value={promoCode} maxLength={40} onChange={(e) => setPromoCode(e.target.value.toUpperCase())} />
          )}
          <FormField as="select" id="purchase-discount-type" label="Discount given as" value={discountType} onChange={(e) => setDiscountType(e.target.value as "amount" | "percent")}>
            <option value="amount">An amount ({currency})</option>
            <option value="percent">A percentage</option>
          </FormField>
          <FormField
            id="purchase-discount"
            label={discountType === "percent" ? "Discount (%)" : `Discount (${currency})`}
            type="number"
            min="0"
            step="0.01"
            value={discountValue}
            placeholder="0"
            onChange={(e) => setDiscountValue(e.target.value)}
          />
        </div>
        <p className="text-muted purchase-form__help">
          A deal or promotion price can be typed straight into the costs (leave the discount at 0), or given as a discount off the normal price — whichever shows the customer their saving best.
        </p>
        <dl className="purchase-form__totals">
          <div>
            <dt>Price before discount</dt>
            <dd>{money(subtotal, currency)}</dd>
          </div>
          <div>
            <dt>Discount</dt>
            <dd>{discount > 0 ? `−${money(discount, currency)}` : "—"}</dd>
          </div>
          <div>
            <dt>Total to pay</dt>
            <dd>
              <strong>{money(total, currency)}</strong>
            </dd>
          </div>
        </dl>
      </fieldset>

      {!editing && (
        <fieldset className="purchase-form__group">
          <legend>Deposit paid now (optional)</legend>
          <div className="form-grid form-grid--2col">
            <FormField id="purchase-deposit" label={`Amount (${currency})`} type="number" min="0" step="0.01" value={deposit} onChange={(e) => setDeposit(e.target.value)} />
            <FormField as="select" id="purchase-deposit-method" label="Paid by" value={depositMethod} onChange={(e) => setDepositMethod(e.target.value)}>
              {Object.entries(PAYMENT_METHODS)
                .filter(([key]) => key !== "account_balance")
                .map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
            </FormField>
            <FormField id="purchase-deposit-ref" label="Receipt / reference (optional)" value={depositRef} maxLength={120} onChange={(e) => setDepositRef(e.target.value)} />
          </div>
        </fieldset>
      )}

      <fieldset className="purchase-form__group">
        <legend>Notes</legend>
        <div className="form-grid form-grid--2col">
          <FormField as="textarea" id="purchase-customer-note" label="Note for the customer (they see it)" value={customerNote} maxLength={2000} onChange={(e) => setCustomerNote(e.target.value)} />
          <FormField as="textarea" id="purchase-staff-note" label="Staff note (never shown to the customer)" value={staffNote} maxLength={2000} onChange={(e) => setStaffNote(e.target.value)} />
        </div>
      </fieldset>

      {!editing && (
        <label className="purchase-form__check">
          <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} /> Email the customer (and WhatsApp when set up) that it's in their account
        </label>
      )}

      <div className="form-actions">
        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? "Saving…" : editing ? "Save changes" : "Record purchase"}
        </button>
        <button className="btn-ghost" type="button" onClick={() => onDone(null)}>
          Cancel
        </button>
      </div>
    </form>
  );
}
