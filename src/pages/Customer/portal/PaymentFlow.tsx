/**
 * "Make a payment": the customer first chooses WHAT they're paying for (a purchase
 * with a balance, a hire booking, or a deposit that says what it's for), then HOW
 * (mobile money, their account balance, or proof of a bank/cash payment), then how
 * much. As they type, the amount is compared with what they owe (counting proofs
 * already waiting for approval): part, exact, or more — and more than owed needs
 * their explicit agreement that the extra goes to their account balance.
 *
 * All of this is only a guide: the server checks the same things again, with its
 * own prices and exchange rate, and never trusts the figures shown here.
 */
import { useEffect, useMemo, useState, type FormEvent } from "react";
import FormField from "@/components/forms/FormField";
import { getPayTargets, mobileMoneyEnabled, payFromBalance, startMobilePayment, submitPayment, type PayTarget, type PayTargets, type PaymentTarget } from "@/services/customer.service";
import { ApiError } from "@/services/http";
import { money } from "@/utils/purchases";
import { usePortal } from "./PortalContext";

type Method = "mobile" | "balance" | "proof";
const DEPOSIT = "deposit";
const DEPOSIT_KINDS = [
  { key: "import", label: "A vehicle import" },
  { key: "clearing", label: "Clearing" },
  { key: "hire", label: "A hire (not booked yet)" },
  { key: "other", label: "Something else" },
];

const targetKey = (t: PayTarget) => `${t.kind}:${t.id}`;
const numeric = (value: string) => Number(value.replace(/[^\d.]/g, "")) || 0;

export default function PaymentFlow({ preselect }: { preselect?: string | null }) {
  const { reloadPurchases } = usePortal();
  const [targets, setTargets] = useState<PayTargets | null>(null);
  const [mobileOn, setMobileOn] = useState(false);
  const [choice, setChoice] = useState<string>("");
  const [method, setMethod] = useState<Method | "">("");
  const [amount, setAmount] = useState("");
  const [acceptExcess, setAcceptExcess] = useState(false);
  const [depositKind, setDepositKind] = useState("import");
  const [depositNote, setDepositNote] = useState("");
  const [reference, setReference] = useState("");
  const [proof, setProof] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () =>
    getPayTargets()
      .then(setTargets)
      .catch(() => setTargets({ purchases: [], hireBookings: [], account: null }));

  useEffect(() => {
    void load();
    void mobileMoneyEnabled().then(setMobileOn).catch(() => setMobileOn(false));
  }, []);

  // Opened from a purchase's "Pay" button: choose it straight away.
  useEffect(() => {
    if (targets && preselect && !choice && targets.purchases.some((t) => t.id === preselect)) setChoice(`purchase:${preselect}`);
  }, [targets, preselect, choice]);

  const all = useMemo(() => [...(targets?.purchases ?? []), ...(targets?.hireBookings ?? [])], [targets]);
  const selected = all.find((t) => targetKey(t) === choice) ?? null;
  const isDeposit = choice === DEPOSIT;
  const wallet = targets?.account && targets.account.currency === "MWK" ? Number(targets.account.balance) : 0;

  // What's still owed in kwacha, less proofs already sent and waiting (they're in kwacha too).
  const owedMwk = selected?.owedMwk ? Number(selected.owedMwk) : null;
  const pendingMwk = selected?.pendingProofs && selected.pendingProofs.currency === "MWK" ? Number(selected.pendingProofs.amount) : 0;
  const dueMwk = owedMwk === null ? null : Math.max(0, owedMwk - pendingMwk);
  const typed = numeric(amount);
  const comparison = dueMwk === null || typed <= 0 ? null : typed > dueMwk ? "more" : typed === dueMwk ? "exact" : "less";
  const extra = comparison === "more" && dueMwk !== null ? typed - dueMwk : 0;
  const maxFromBalance = dueMwk === null ? 0 : Math.min(wallet, dueMwk);

  function chooseTarget(key: string) {
    setChoice(key);
    setMethod("");
    setError(null);
    setDone(null);
    setAcceptExcess(false);
    const t = all.find((x) => targetKey(x) === key);
    const pending = t?.pendingProofs && t.pendingProofs.currency === "MWK" ? Number(t.pendingProofs.amount) : 0;
    setAmount(t?.owedMwk ? String(Math.max(0, Number(t.owedMwk) - pending)) : "");
  }

  function chooseMethod(next: Method) {
    setMethod(next);
    setError(null);
    setAcceptExcess(false);
    if (next === "balance" && dueMwk !== null) setAmount(String(maxFromBalance));
    else if (dueMwk !== null) setAmount(String(dueMwk));
  }

  const target: PaymentTarget | undefined = selected ? (selected.kind === "purchase" ? { purchaseId: selected.id } : { hireRequestId: selected.id }) : undefined;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!choice) return setError("Choose what you're paying for.");
    if (isDeposit && depositNote.trim().length < 3) return setError("Say what the deposit is for.");
    if (!method) return setError("Choose how you're paying.");
    if (typed <= 0) return setError("Enter the amount.");
    if (method === "mobile" && typed < 100) return setError("Mobile money payments start at MWK 100.");
    if (method === "balance" && typed > maxFromBalance) return setError(`You can pay at most ${money(maxFromBalance, "MWK")} from your balance for this.`);
    if (comparison === "more" && method !== "balance" && !acceptExcess) return setError("That's more than you owe. Lower the amount, or tick the box to put the extra on your account balance.");
    if (method === "proof" && !proof) return setError("Choose a photo or screenshot of your proof of payment.");

    setBusy(true);
    try {
      if (method === "mobile") {
        const { checkoutUrl } = await startMobilePayment(
          target ? { amount: Math.round(typed), target, acceptExcess } : { amount: Math.round(typed), deposit: { purpose: depositKind, note: depositNote.trim() } }
        );
        // Only ever PayChangu's own secure page.
        if (!/^https:\/\/([\w-]+\.)*paychangu\.com\//.test(checkoutUrl)) throw new Error("Unexpected payment address.");
        window.location.assign(checkoutUrl);
        return;
      }
      if (method === "balance" && target) {
        await payFromBalance(target, typed);
        setDone(`Paid ${money(typed, "MWK")} from your balance toward ${selected?.title}.`);
      } else if (method === "proof" && proof) {
        const note = isDeposit ? `${DEPOSIT_KINDS.find((k) => k.key === depositKind)?.label}: ${depositNote.trim()}` : reference.trim() || undefined;
        await submitPayment({ amount: Math.round(typed), proof, note, target, acceptExcess: comparison === "more" && acceptExcess });
        setDone("Proof sent. It counts once our team has checked it — you'll get a message when it's approved.");
      }
      await Promise.all([reloadPurchases(), load()]);
      setChoice("");
      setMethod("");
      setAmount("");
      setProof(null);
      setReference("");
      setDepositNote("");
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : "Couldn't complete the payment.");
    } finally {
      setBusy(false);
    }
  }

  if (!targets) return <p className="text-muted">Loading…</p>;

  return (
    <form className="form-card pay-flow" onSubmit={submit} noValidate>
      <h3 style={{ marginTop: 0 }}>Make a payment</h3>
      {done && (
        <p className="form-status form-status--success" role="status">
          {done}
        </p>
      )}

      <fieldset className="pay-flow__step">
        <legend>1. What are you paying for?</legend>
        <div className="pay-flow__options" role="radiogroup">
          {all.map((t) => (
            <label key={targetKey(t)} className={choice === targetKey(t) ? "pay-option pay-option--on" : "pay-option"}>
              <input type="radio" name="pay-target" checked={choice === targetKey(t)} onChange={() => chooseTarget(targetKey(t))} />
              <span className="pay-option__body">
                <strong>{t.title}</strong>
                <span className="text-muted">
                  {t.kind === "purchase" ? t.reference : `Hire booking (${t.status}) · pick-up ${t.pickupDate ? new Date(t.pickupDate).toLocaleDateString() : ""}`}
                  {t.dueDate ? ` · due ${new Date(t.dueDate).toLocaleDateString()}` : ""}
                </span>
                {t.pendingProofs && (
                  <span className="text-muted">
                    {money(t.pendingProofs.amount, t.pendingProofs.currency ?? "MWK")} already sent, waiting for approval
                  </span>
                )}
              </span>
              <span className="pay-option__amount">
                <strong>{money(t.owed, t.currency)}</strong>
                {t.currency !== "MWK" && t.owedMwk && <span className="text-muted">≈ {money(t.owedMwk, "MWK")}</span>}
              </span>
            </label>
          ))}
          <label className={isDeposit ? "pay-option pay-option--on" : "pay-option"}>
            <input type="radio" name="pay-target" checked={isDeposit} onChange={() => chooseTarget(DEPOSIT)} />
            <span className="pay-option__body">
              <strong>An advance deposit</strong>
              <span className="text-muted">For something we haven't priced yet (an import, clearing…). It goes to your account balance.</span>
            </span>
          </label>
        </div>
        {all.length === 0 && <p className="text-muted">You have nothing to pay right now. You can still make a deposit toward something new.</p>}
        {isDeposit && (
          <div className="form-grid form-grid--2col">
            <FormField as="select" id="deposit-kind" label="It's for" value={depositKind} onChange={(e) => setDepositKind(e.target.value)}>
              {DEPOSIT_KINDS.map((k) => (
                <option key={k.key} value={k.key}>
                  {k.label}
                </option>
              ))}
            </FormField>
            <FormField id="deposit-note" label="Describe it" required placeholder="e.g. Deposit for a 2018 Toyota Vitz import" value={depositNote} maxLength={300} onChange={(e) => setDepositNote(e.target.value)} />
          </div>
        )}
      </fieldset>

      {choice && (
        <fieldset className="pay-flow__step">
          <legend>2. How are you paying?</legend>
          <div className="pay-flow__methods">
            {mobileOn && (
              <button type="button" className={method === "mobile" ? "pay-method pay-method--on" : "pay-method"} aria-pressed={method === "mobile"} onClick={() => chooseMethod("mobile")}>
                <strong>Mobile money</strong>
                <span>Airtel Money or TNM Mpamba</span>
              </button>
            )}
            {!isDeposit && wallet > 0 && (
              <button type="button" className={method === "balance" ? "pay-method pay-method--on" : "pay-method"} aria-pressed={method === "balance"} onClick={() => chooseMethod("balance")}>
                <strong>My account balance</strong>
                <span>{money(wallet, "MWK")} available</span>
              </button>
            )}
            <button type="button" className={method === "proof" ? "pay-method pay-method--on" : "pay-method"} aria-pressed={method === "proof"} onClick={() => chooseMethod("proof")}>
              <strong>I've paid another way</strong>
              <span>Upload a bank slip or screenshot</span>
            </button>
          </div>
        </fieldset>
      )}

      {choice && method && (
        <fieldset className="pay-flow__step">
          <legend>3. How much?</legend>
          <div className="form-grid form-grid--2col">
            <FormField
              id="pay-amount"
              label={method === "proof" ? "Amount you paid (MWK)" : "Amount (MWK)"}
              inputMode="decimal"
              required
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setAcceptExcess(false);
              }}
            />
            {method === "proof" && (
              <>
                {!isDeposit && <FormField id="pay-reference" label="Bank reference (optional)" value={reference} maxLength={120} onChange={(e) => setReference(e.target.value)} />}
                <div className="form-field form-grid__full">
                  <label htmlFor="pay-proof">
                    Proof of payment<span className="form-field__required"> *</span>
                  </label>
                  <input id="pay-proof" type="file" accept="image/jpeg,image/png,image/webp" className="form-field__input" onChange={(e) => setProof(e.target.files?.[0] ?? null)} />
                </div>
              </>
            )}
          </div>

          {selected && dueMwk !== null && comparison && (
            <div className={`pay-compare pay-compare--${comparison}`} role="status" aria-live="polite">
              {comparison === "exact" && <p>This pays {selected.title} in full.</p>}
              {comparison === "less" && (
                <p>
                  This pays part of it. {money(dueMwk - typed, "MWK")} will still be owed{selected.currency !== "MWK" && selected.rateToMwk ? ` (≈ ${money(Math.round(((dueMwk - typed) / Number(selected.rateToMwk)) * 100) / 100, selected.currency)})` : ""}.
                </p>
              )}
              {comparison === "more" && method === "balance" && <p>You owe {money(dueMwk, "MWK")} — you can't pay more than that from your balance.</p>}
              {comparison === "more" && method !== "balance" && (
                <>
                  <p>
                    <strong>This is {money(extra, "MWK")} more than you owe</strong> ({money(dueMwk, "MWK")}
                    {pendingMwk > 0 ? `, after the ${money(pendingMwk, "MWK")} you've already sent` : ""}).
                  </p>
                  <label className="pay-compare__agree">
                    <input type="checkbox" checked={acceptExcess} onChange={(e) => setAcceptExcess(e.target.checked)} /> Put the extra {money(extra, "MWK")} on my account balance (I can use it later or ask for a refund)
                  </label>
                  <button type="button" className="link-button" onClick={() => setAmount(String(dueMwk))}>
                    Pay exactly {money(dueMwk, "MWK")} instead
                  </button>
                </>
              )}
              {selected.currency !== "MWK" && selected.rateToMwk && <p className="text-muted">Today's rate: MWK {Number(selected.rateToMwk).toLocaleString()} per {selected.currency} 1.</p>}
            </div>
          )}
        </fieldset>
      )}

      {error && (
        <p className="form-status form-status--error" role="alert">
          {error}
        </p>
      )}
      {choice && method && (
        <div className="form-actions">
          <button className="btn btn-primary" type="submit" disabled={busy || (comparison === "more" && method !== "balance" && !acceptExcess) || (comparison === "more" && method === "balance")}>
            {busy ? "Please wait…" : method === "mobile" ? "Continue to secure payment" : method === "balance" ? "Pay from my balance" : "Send proof for checking"}
          </button>
        </div>
      )}
    </form>
  );
}
