import { useState, type FormEvent, type ChangeEvent } from "react";
import FormField from "@/components/forms/FormField";
import FormStatusBanner from "@/components/forms/FormStatusBanner";
import { useFormSubmission } from "@/hooks/useFormSubmission";
import { submitHireRequest } from "@/services/inquiries.service";
import type { HireRequest } from "@/types/requests";
import type { HireVehicle } from "@/types/vehicle";

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

function validate(values: FormValues) {
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

  function handleChange(field: keyof FormValues) {
    return (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setValues((prev) => ({ ...prev, [field]: e.target.value }));
    };
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const validationErrors = validate(values);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    await submit({
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
          successMessage={`Your hire request for the ${vehicle.name} has been received. We'll confirm availability with you.`}
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
        <FormField id="email" label="Email" type="email" required value={values.email} onChange={handleChange("email")} error={errors.email} />
        <FormField id="pickupLocation" label="Pickup Location" required value={values.pickupLocation} onChange={handleChange("pickupLocation")} error={errors.pickupLocation} />
        <FormField id="pickupDate" label="Pickup Date" type="date" required value={values.pickupDate} onChange={handleChange("pickupDate")} error={errors.pickupDate} />
        <FormField id="returnDate" label="Return Date" type="date" required value={values.returnDate} onChange={handleChange("returnDate")} error={errors.returnDate} />
        <FormField
          id="additionalRequirements"
          label="Additional Requirements"
          as="textarea"
          value={values.additionalRequirements}
          onChange={handleChange("additionalRequirements")}
          wrapperClassName="form-grid__full"
        />
      </div>

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
