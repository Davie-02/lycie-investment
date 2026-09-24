/**
 * "Tell me when it arrives": a customer's vehicle alerts, on their account page.
 *
 * They describe what they want (any mix of make, model, type, top price and
 * oldest year) and are emailed as soon as a matching vehicle is listed. Saved
 * vehicles also get an email if their price drops. Needs a confirmed email so
 * alerts only ever go to an inbox the customer owns. Server: server/src/alerts/.
 */
import { useEffect, useState, type FormEvent } from "react";
import FormField from "@/components/forms/FormField";
import FormStatusBanner from "@/components/forms/FormStatusBanner";
import {
  createVehicleAlert,
  deleteVehicleAlert,
  getVehicleAlerts,
  setVehicleAlertActive,
  type NewVehicleAlert,
  type VehicleAlert,
} from "@/services/customer.service";

const BODY_TYPES = ["", "SUV", "Sedan", "Pickup", "Hatchback", "Minibus", "Van", "Truck", "Wagon", "Coupe"];

interface Props {
  emailConfirmed: boolean;
}

const EMPTY = { make: "", model: "", bodyType: "", maxPrice: "", minYear: "" };

export default function VehicleAlerts({ emailConfirmed }: Props) {
  const [alerts, setAlerts] = useState<VehicleAlert[] | null>(null);
  const [values, setValues] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getVehicleAlerts()
      .then(setAlerts)
      .catch(() => setAlerts([]));
  }, []);

  const set = (field: keyof typeof EMPTY) => (event: { target: { value: string } }) => {
    setSaved(false);
    setValues((prev) => ({ ...prev, [field]: event.target.value }));
  };

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const alert: NewVehicleAlert = {
      make: values.make.trim() || undefined,
      model: values.model.trim() || undefined,
      bodyType: values.bodyType || undefined,
      maxPrice: values.maxPrice ? Number(values.maxPrice) : undefined,
      minYear: values.minYear ? Number(values.minYear) : undefined,
    };
    if (!alert.make && !alert.model && !alert.bodyType && !alert.maxPrice && !alert.minYear) {
      setError("Fill in at least one thing you're looking for.");
      return;
    }
    setBusy(true);
    try {
      const created = await createVehicleAlert(alert);
      setAlerts((prev) => [created, ...(prev ?? [])]);
      setValues(EMPTY);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the alert.");
    } finally {
      setBusy(false);
    }
  }

  async function toggle(alert: VehicleAlert) {
    await setVehicleAlertActive(alert.id, !alert.isActive);
    setAlerts((prev) => prev?.map((a) => (a.id === alert.id ? { ...a, isActive: !a.isActive } : a)) ?? null);
  }

  async function remove(alert: VehicleAlert) {
    await deleteVehicleAlert(alert.id);
    setAlerts((prev) => prev?.filter((a) => a.id !== alert.id) ?? null);
  }

  const thisYear = new Date().getFullYear();

  return (
    <div className="customer-account__history" id="alerts">
      <h2>Vehicle alerts</h2>
      <p className="text-muted">
        Looking for something we don't have yet? Tell us, and we'll email you the moment it's listed. We'll also email you
        if a vehicle you saved drops in price.
      </p>

      {!emailConfirmed ? (
        <p className="form-status form-status--info">Confirm your email address first (see the note at the top of this page) so alerts can reach you.</p>
      ) : (
        <form className="form-card customer-account__form" onSubmit={handleSubmit} noValidate>
          {saved && <FormStatusBanner status="success" successMessage="Alert saved. We'll email you when a match is listed." errorMessage={null} />}
          {error && <FormStatusBanner status="error" successMessage="" errorMessage={error} />}
          <div className="form-grid form-grid--2col">
            <FormField id="alert-make" label="Make" placeholder="e.g. Toyota" value={values.make} onChange={set("make")} maxLength={60} />
            <FormField id="alert-model" label="Model" placeholder="e.g. Hilux" value={values.model} onChange={set("model")} maxLength={60} />
            <FormField as="select" id="alert-body" label="Type" value={values.bodyType} onChange={set("bodyType")}>
              {BODY_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type || "Any type"}
                </option>
              ))}
            </FormField>
            <FormField
              id="alert-price"
              label="Top price (USD)"
              type="number"
              inputMode="numeric"
              min={1}
              placeholder="e.g. 25000"
              value={values.maxPrice}
              onChange={set("maxPrice")}
            />
            <FormField
              id="alert-year"
              label="Oldest year"
              type="number"
              inputMode="numeric"
              min={1950}
              max={thisYear + 1}
              placeholder={`e.g. ${thisYear - 8}`}
              value={values.minYear}
              onChange={set("minYear")}
            />
          </div>
          <div className="form-actions">
            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? "Saving…" : "Create alert"}
            </button>
          </div>
        </form>
      )}

      {alerts && alerts.length > 0 && (
        <ul className="customer-alerts">
          {alerts.map((alert) => (
            <li key={alert.id} className={alert.isActive ? "customer-alert" : "customer-alert customer-alert--paused"}>
              <div>
                <strong>{alert.label}</strong>
                <span className="text-muted">
                  {alert.isActive ? "Active" : "Paused"}
                  {alert.sentCount > 0 ? ` · ${alert.sentCount} match${alert.sentCount === 1 ? "" : "es"} sent` : ""}
                </span>
              </div>
              <div className="customer-alert__actions">
                <button type="button" className="link-button" onClick={() => void toggle(alert)}>
                  {alert.isActive ? "Pause" : "Resume"}
                </button>
                <button type="button" className="link-button" onClick={() => void remove(alert)}>
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
