import { useState, type FormEvent, type ChangeEvent } from "react";
import FormField from "@/components/forms/FormField";
import FormStatusBanner from "@/components/forms/FormStatusBanner";
import { useFormSubmission } from "@/hooks/useFormSubmission";
import { submitClearingRequest } from "@/services/inquiries.service";
import type { ClearingRequest } from "@/types/requests";

type FormValues = {
  fullName: string;
  phone: string;
  email: string;
  vehicleMake: string;
  vehicleModel: string;
  year: string;
  vin: string;
  currentLocation: string;
  arrivalPortOrBorder: string;
  expectedArrivalDate: string;
  availableDocuments: string;
  additionalInformation: string;
};

const INITIAL_VALUES: FormValues = {
  fullName: "",
  phone: "",
  email: "",
  vehicleMake: "",
  vehicleModel: "",
  year: "",
  vin: "",
  currentLocation: "",
  arrivalPortOrBorder: "",
  expectedArrivalDate: "",
  availableDocuments: "",
  additionalInformation: "",
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
  if (!values.vehicleMake.trim()) errors.vehicleMake = "Vehicle make is required.";
  if (!values.vin.trim()) errors.vin = "VIN/Chassis number is required.";
  if (!values.currentLocation.trim()) errors.currentLocation = "Current vehicle location is required.";
  return errors;
}

export default function ClearingRequestForm() {
  const [values, setValues] = useState<FormValues>(INITIAL_VALUES);
  const [errors, setErrors] = useState<Partial<Record<keyof FormValues, string>>>({});
  const { status, errorMessage, submit } = useFormSubmission<ClearingRequest>(submitClearingRequest);

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
      vehicleMake: values.vehicleMake,
      vehicleModel: values.vehicleModel,
      year: values.year ? Number(values.year) : undefined,
      vin: values.vin,
      currentLocation: values.currentLocation,
      arrivalPortOrBorder: values.arrivalPortOrBorder,
      expectedArrivalDate: values.expectedArrivalDate || undefined,
      availableDocuments: values.availableDocuments || undefined,
      additionalInformation: values.additionalInformation || undefined,
    });
  }

  if (status === "success") {
    return (
      <div className="form-card">
        <FormStatusBanner
          status="success"
          successMessage="Your clearing request has been received. We'll follow up with next steps."
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
        <FormField id="fullName" label="Full Name" required value={values.fullName} onChange={handleChange("fullName")} error={errors.fullName} />
        <FormField id="phone" label="Phone" required value={values.phone} onChange={handleChange("phone")} error={errors.phone} />
        <FormField id="email" label="Email" type="email" required value={values.email} onChange={handleChange("email")} error={errors.email} />
        <FormField id="vehicleMake" label="Vehicle Make" required value={values.vehicleMake} onChange={handleChange("vehicleMake")} error={errors.vehicleMake} />
        <FormField id="vehicleModel" label="Vehicle Model" value={values.vehicleModel} onChange={handleChange("vehicleModel")} />
        <FormField id="year" label="Year" type="number" value={values.year} onChange={handleChange("year")} />
        <FormField id="vin" label="VIN / Chassis Number" required value={values.vin} onChange={handleChange("vin")} error={errors.vin} />
        <FormField id="currentLocation" label="Current Vehicle Location" required value={values.currentLocation} onChange={handleChange("currentLocation")} error={errors.currentLocation} />
        <FormField id="arrivalPortOrBorder" label="Arrival Port / Border" value={values.arrivalPortOrBorder} onChange={handleChange("arrivalPortOrBorder")} />
        <FormField id="expectedArrivalDate" label="Expected Arrival Date" type="date" value={values.expectedArrivalDate} onChange={handleChange("expectedArrivalDate")} />
        <FormField
          id="availableDocuments"
          label="Available Documents"
          as="textarea"
          value={values.availableDocuments}
          onChange={handleChange("availableDocuments")}
          placeholder="e.g. Bill of lading, invoice, logbook"
          wrapperClassName="form-grid__full"
        />
        <FormField
          id="additionalInformation"
          label="Additional Information"
          as="textarea"
          value={values.additionalInformation}
          onChange={handleChange("additionalInformation")}
          wrapperClassName="form-grid__full"
        />
      </div>

      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={status === "submitting"}>
          {status === "submitting" ? "Sending…" : "Submit Clearing Request"}
        </button>
      </div>
    </form>
  );
}
