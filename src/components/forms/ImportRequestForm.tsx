import { useState, type FormEvent, type ChangeEvent } from "react";
import FormField from "@/components/forms/FormField";
import FormStatusBanner from "@/components/forms/FormStatusBanner";
import { useFormSubmission } from "@/hooks/useFormSubmission";
import { submitImportRequest } from "@/services/inquiries.service";
import type { ImportRequest } from "@/types/requests";

type FormValues = {
  fullName: string;
  phone: string;
  email: string;
  preferredMake: string;
  preferredModel: string;
  preferredYear: string;
  budget: string;
  fuelType: string;
  transmission: string;
  vehicleType: string;
  preferredSourceCountry: string;
  additionalRequirements: string;
};

const INITIAL_VALUES: FormValues = {
  fullName: "",
  phone: "",
  email: "",
  preferredMake: "",
  preferredModel: "",
  preferredYear: "",
  budget: "",
  fuelType: "",
  transmission: "",
  vehicleType: "",
  preferredSourceCountry: "",
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
  if (!values.preferredMake.trim()) errors.preferredMake = "Preferred make is required.";
  return errors;
}

export default function ImportRequestForm() {
  const [values, setValues] = useState<FormValues>(INITIAL_VALUES);
  const [errors, setErrors] = useState<Partial<Record<keyof FormValues, string>>>({});
  const { status, errorMessage, submit } = useFormSubmission<ImportRequest>(submitImportRequest);

  function handleChange(field: keyof FormValues) {
    return (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
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
      preferredMake: values.preferredMake,
      preferredModel: values.preferredModel,
      preferredYear: values.preferredYear ? Number(values.preferredYear) : undefined,
      budget: values.budget ? Number(values.budget) : undefined,
      fuelType: values.fuelType || undefined,
      transmission: values.transmission || undefined,
      vehicleType: values.vehicleType || undefined,
      preferredSourceCountry: values.preferredSourceCountry || undefined,
      additionalRequirements: values.additionalRequirements || undefined,
    });
  }

  if (status === "success") {
    return (
      <div className="form-card">
        <FormStatusBanner
          status="success"
          successMessage="Your import request has been received. We'll contact you to confirm the details."
          errorMessage={null}
        />
      </div>
    );
  }

  return (
    <form className="form-card" onSubmit={handleSubmit} noValidate>
      {status === "error" && (
        <FormStatusBanner status="error" successMessage="" errorMessage={errorMessage} />
      )}

      <div className="form-grid form-grid--2col">
        <FormField
          id="fullName"
          label="Full Name"
          required
          value={values.fullName}
          onChange={handleChange("fullName")}
          error={errors.fullName}
        />
        <FormField
          id="phone"
          label="Phone Number"
          required
          value={values.phone}
          onChange={handleChange("phone")}
          error={errors.phone}
        />
        <FormField
          id="email"
          label="Email"
          type="email"
          required
          value={values.email}
          onChange={handleChange("email")}
          error={errors.email}
        />
        <FormField
          id="preferredMake"
          label="Preferred Make"
          required
          value={values.preferredMake}
          onChange={handleChange("preferredMake")}
          error={errors.preferredMake}
        />
        <FormField
          id="preferredModel"
          label="Preferred Model"
          value={values.preferredModel}
          onChange={handleChange("preferredModel")}
        />
        <FormField
          id="preferredYear"
          label="Preferred Year"
          type="number"
          value={values.preferredYear}
          onChange={handleChange("preferredYear")}
        />
        <FormField
          id="budget"
          label="Budget (MWK)"
          type="number"
          value={values.budget}
          onChange={handleChange("budget")}
        />
        <FormField
          id="fuelType"
          label="Fuel Type"
          as="select"
          value={values.fuelType}
          onChange={handleChange("fuelType")}
        >
          <option value="">Any</option>
          <option value="Petrol">Petrol</option>
          <option value="Diesel">Diesel</option>
          <option value="Hybrid">Hybrid</option>
          <option value="Electric">Electric</option>
        </FormField>
        <FormField
          id="transmission"
          label="Transmission"
          as="select"
          value={values.transmission}
          onChange={handleChange("transmission")}
        >
          <option value="">Any</option>
          <option value="Automatic">Automatic</option>
          <option value="Manual">Manual</option>
        </FormField>
        <FormField
          id="vehicleType"
          label="Vehicle Type"
          value={values.vehicleType}
          onChange={handleChange("vehicleType")}
          placeholder="e.g. SUV, Pickup, Sedan"
        />
        <FormField
          id="preferredSourceCountry"
          label="Preferred Source Country"
          value={values.preferredSourceCountry}
          onChange={handleChange("preferredSourceCountry")}
        />
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
          {status === "submitting" ? "Sending…" : "Request an Imported Vehicle"}
        </button>
      </div>
    </form>
  );
}
