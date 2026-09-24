/**
 * Public form to request a hire vehicle: the customer's details, pickup/return dates and
 * a live price estimate (utils/hirePricing.ts). Validated in the browser, then sent
 * through services/inquiries.service.ts to POST /api/hire-requests, where the server
 * recalculates the price.
 */
import { useEffect, useMemo, useState, type FormEvent, type ChangeEvent } from "react";
import FormField from "@/components/forms/FormField";
import EmailField from "@/components/forms/EmailField";
import FormStatusBanner from "@/components/forms/FormStatusBanner";
import { useFormSubmission } from "@/hooks/useFormSubmission";
import { submitHireRequest } from "@/services/inquiries.service";
import { calculateHireCost } from "@/utils/hirePricing";
import { apiGet } from "@/services/http";
import { subscribeLive } from "@/services/liveContent";

import type { HireRequest } from "@/types/requests";
import type { HireVehicle } from "@/types/vehicle";
import PreferredContactSelect, { type PreferredContact } from "./PreferredContactSelect";
import Price from "@/components/common/Price";

type FormValues = {
  fullName: string;
  phone: string;
  email: string;
  pickupDate: string;
  returnDate: string;
  pickupLocation: string;
  additionalRequirements: string;
};

const INITIAL_VALUES: FormValues = {
  fullName: "",
  phone: "",
  email: "",
  pickupDate: "",
  returnDate: "",
  pickupLocation: "",
  additionalRequirements: "",
};

/** A date range the vehicle is already booked for (from GET /hire-requests/availability/:id). */
interface BookedRange {
  from: string;
  to: string;
}

/** "YYYY-MM-DD" of a date in the visitor's own calendar, the format date inputs use. */
function dayKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const shortDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

/** The first booked range the chosen dates run into, if any (same rule the server uses). */
function findClash(pickup: string, returnDate: string, booked: BookedRange[]): BookedRange | undefined {
  if (!pickup || !returnDate) return undefined;
  return booked.find((range) => pickup < dayKey(new Date(range.to)) && returnDate > dayKey(new Date(range.from)));
}

function validate(values: FormValues, booked: BookedRange[] = []) {
  const errors: Partial<Record<keyof FormValues, string>> = {};
  if (!values.fullName.trim()) errors.fullName = "Full name is required.";
  if (!values.phone.trim()) errors.phone = "Phone number is required.";
  if (!values.email.trim()) {
    errors.email = "Email is required.";
  } else if (!/^\S+@\S+\.\S+$/.test(values.email)) {
    errors.email = "Enter a valid email address.";
  }
  if (!values.pickupDate) errors.pickupDate = "Pickup date is required.";
  if (!values.returnDate) errors.returnDate = "Return date is required.";
  if (values.pickupDate && values.returnDate && values.returnDate < values.pickupDate) {
    errors.returnDate = "Return date cannot be before pickup date.";
  }
  if (values.pickupDate && values.pickupDate < dayKey(new Date())) {
    errors.pickupDate = "Pickup date can't be in the past.";
  }
  const clash = findClash(values.pickupDate, values.returnDate, booked);
  if (clash && !errors.returnDate) {
    errors.returnDate = `Already booked ${shortDate(clash.from)} – ${shortDate(clash.to)}. Please choose other dates.`;
  }
  if (!values.pickupLocation.trim()) errors.pickupLocation = "Pickup location is required.";
  return errors;
}

interface HireRequestFormProps {
  vehicle: HireVehicle;
  onCancel: () => void;
}

export default function HireRequestForm({ vehicle, onCancel }: HireRequestFormProps) {
  const [values, setValues] = useState<FormValues>(INITIAL_VALUES);
  const [errors, setErrors] = useState<Partial<Record<keyof FormValues, string>>>({});
  const { status, errorMessage, submit } = useFormSubmission<HireRequest>(submitHireRequest);
  const [booked, setBooked] = useState<BookedRange[]>([]);

  // Dates already taken, so customers can pick free ones instead of being turned down later.
  // Refreshed the moment staff confirm or cancel a booking.
  useEffect(() => {
    const load = () =>
      apiGet<{ booked: BookedRange[] }>(`/hire-requests/availability/${encodeURIComponent(vehicle.id)}`)
        .then((result) => setBooked(result.booked))
        .catch(() => setBooked([])); // unknown availability: the server still checks on submit
    void load();
    return subscribeLive(["hire-vehicles"], () => void load());
  }, [vehicle.id]);

  const clash = findClash(values.pickupDate, values.returnDate, booked);

  const estimate = useMemo(() => {
    if (!values.pickupDate || !values.returnDate) return null;
    const pickup = new Date(values.pickupDate);
    const returnD = new Date(values.returnDate);
    if (returnD < pickup) return null;
    return calculateHireCost(vehicle.dailyRate, vehicle.weeklyRate, pickup, returnD);
  }, [values.pickupDate, values.returnDate, vehicle.dailyRate, vehicle.weeklyRate]);

  function handleChange(field: keyof FormValues) {
    return (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setValues((prev) => ({ ...prev, [field]: e.target.value }));
    };
  }

  const [preferredContact, setPreferredContact] = useState<PreferredContact | "">("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const validationErrors = validate(values, booked);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    await submit({
      preferredContact: preferredContact || undefined,
      fullName: values.fullName,
      phone: values.phone,
      email: values.email,
      vehicleId: vehicle.id,
      pickupDate: values.pickupDate,
      returnDate: values.returnDate,
      pickupLocation: values.pickupLocation,
      additionalRequirements: values.additionalRequirements || undefined,
    });
  }

  if (status === "success") {
    return (
      <div className="form-card">
        <FormStatusBanner
          status="success"
          successMessage={`Your hire request for the ${vehicle.name} has been received. We'll confirm availability and final pricing with you.`}
          errorMessage={null}
        />
      </div>
    );
  }

  return (
    <form className="form-card" onSubmit={handleSubmit} noValidate>
      <p className="text-muted hire-form__vehicle">
        Requesting hire for: <strong className="mono">{vehicle.name}</strong>
      </p>

      {status === "error" && (
        <FormStatusBanner status="error" successMessage="" errorMessage={errorMessage} />
      )}

      <div className="form-grid form-grid--2col">
        <FormField id="fullName" label="Full Name" required value={values.fullName} onChange={handleChange("fullName")} error={errors.fullName} />
        <FormField id="phone" label="Phone" required value={values.phone} onChange={handleChange("phone")} error={errors.phone} />
        <EmailField id="email" value={values.email} onChange={(email) => setValues((prev) => ({ ...prev, email }))} error={errors.email} autoComplete="email" />
        <FormField id="pickupLocation" label="Pickup Location" required value={values.pickupLocation} onChange={handleChange("pickupLocation")} error={errors.pickupLocation} />
        <FormField id="pickupDate" label="Pickup Date" type="date" required min={dayKey(new Date())} value={values.pickupDate} onChange={handleChange("pickupDate")} error={errors.pickupDate} />
        <FormField id="returnDate" label="Return Date" type="date" required min={values.pickupDate || dayKey(new Date())} value={values.returnDate} onChange={handleChange("returnDate")} error={errors.returnDate} />
        <div className="form-grid__full hire-form__availability" aria-live="polite">
          {booked.length === 0 ? (
            <p className="text-muted">No confirmed bookings yet — any dates are open.</p>
          ) : (
            <>
              <p className="text-muted">Already booked (choose dates outside these):</p>
              <ul>
                {booked.map((range) => (
                  <li key={range.from} className={clash === range ? "hire-form__booked hire-form__booked--clash" : "hire-form__booked"}>
                    {shortDate(range.from)} – {shortDate(range.to)}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
        <FormField
          id="additionalRequirements"
          label="Additional Requirements"
          as="textarea"
          value={values.additionalRequirements}
          onChange={handleChange("additionalRequirements")}
          wrapperClassName="form-grid__full"
        />
      </div>

      {estimate && (
        <div className="hire-form__estimate">
          <span>
            {estimate.days} day{estimate.days === 1 ? "" : "s"}
            {estimate.days >= 7 && vehicle.weeklyRate ? " (weekly rate applied automatically where cheaper)" : ""}
          </span>
          <strong className="mono"><Price amount={estimate.totalCost} currency={vehicle.currency} layout="inline" /></strong>
        </div>
      )}
      <p className="text-muted hire-form__estimate-note">
        Estimated total — final pricing is confirmed when we get in touch.
      </p>

      <PreferredContactSelect value={preferredContact} onChange={setPreferredContact} />

      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={status === "submitting"}>
          {status === "submitting" ? "Sending…" : "Submit Hire Request"}
        </button>
        <button type="button" className="btn-ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
