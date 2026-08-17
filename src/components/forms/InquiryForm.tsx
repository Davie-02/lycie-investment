import { useState, type FormEvent, type ChangeEvent } from "react";
import FormField from "@/components/forms/FormField";
import FormStatusBanner from "@/components/forms/FormStatusBanner";
import { useFormSubmission } from "@/hooks/useFormSubmission";
import { submitInquiry } from "@/services/inquiries.service";
import type { InquiryRequest } from "@/types/requests";

interface InquiryFormProps {
  vehicleId: string;
  vehicleLabel: string;
}

type FormValues = {
  fullName: string;
  phone: string;
  email: string;
  message: string;
};

const INITIAL_VALUES: FormValues = {
  fullName: "",
  phone: "",
  email: "",
  message: "",
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
  return errors;
}

export default function InquiryForm({ vehicleId, vehicleLabel }: InquiryFormProps) {
  const [values, setValues] = useState<FormValues>(INITIAL_VALUES);
  const [errors, setErrors] = useState<Partial<Record<keyof FormValues, string>>>({});
  const { status, errorMessage, submit } = useFormSubmission<InquiryRequest>(submitInquiry);

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
      vehicleId,
      message: values.message,
    });
  }

  if (status === "success") {
    return (
      <div className="form-card">
        <FormStatusBanner
          status="success"
          successMessage={`Your inquiry about the ${vehicleLabel} has been received. We'll be in touch.`}
          errorMessage={null}
        />
      </div>
    );
  }

  return (
    <form className="form-card" onSubmit={handleSubmit} noValidate>
      <p className="text-muted hire-form__vehicle">
        Inquiring about: <strong className="mono">{vehicleLabel}</strong>
      </p>

      {status === "error" && (
        <FormStatusBanner status="error" successMessage="" errorMessage={errorMessage} />
      )}

      <div className="form-grid">
        <FormField id="fullName" label="Full Name" required value={values.fullName} onChange={handleChange("fullName")} error={errors.fullName} />
        <FormField id="phone" label="Phone" required value={values.phone} onChange={handleChange("phone")} error={errors.phone} />
        <FormField id="email" label="Email" type="email" required value={values.email} onChange={handleChange("email")} error={errors.email} />
        <FormField
          id="message"
          label="Message"
          as="textarea"
          value={values.message}
          onChange={handleChange("message")}
          placeholder="Any questions about this vehicle?"
        />
      </div>

      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={status === "submitting"}>
          {status === "submitting" ? "Sending…" : "Make an Inquiry"}
        </button>
      </div>
    </form>
  );
}
