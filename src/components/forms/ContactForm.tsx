import { useState, type FormEvent, type ChangeEvent } from "react";
import FormField from "@/components/forms/FormField";
import FormStatusBanner from "@/components/forms/FormStatusBanner";
import { useFormSubmission } from "@/hooks/useFormSubmission";
import { submitContactMessage } from "@/services/inquiries.service";
import type { ContactMessage } from "@/types/requests";

type FormValues = {
  fullName: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
};

const INITIAL_VALUES: FormValues = {
  fullName: "",
  email: "",
  phone: "",
  subject: "",
  message: "",
};

function validate(values: FormValues) {
  const errors: Partial<Record<keyof FormValues, string>> = {};
  if (!values.fullName.trim()) errors.fullName = "Full name is required.";
  if (!values.email.trim()) {
    errors.email = "Email is required.";
  } else if (!/^\S+@\S+\.\S+$/.test(values.email)) {
    errors.email = "Enter a valid email address.";
  }
  if (!values.subject.trim()) errors.subject = "Subject is required.";
  if (!values.message.trim()) errors.message = "Message is required.";
  return errors;
}

export default function ContactForm() {
  const [values, setValues] = useState<FormValues>(INITIAL_VALUES);
  const [errors, setErrors] = useState<Partial<Record<keyof FormValues, string>>>({});
  const { status, errorMessage, submit } = useFormSubmission<ContactMessage>(submitContactMessage);

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
      email: values.email,
      phone: values.phone || undefined,
      subject: values.subject,
      message: values.message,
    });
  }

  if (status === "success") {
    return (
      <div className="form-card">
        <FormStatusBanner
          status="success"
          successMessage="Your message has been received. We'll get back to you soon."
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
        <FormField id="email" label="Email" type="email" required value={values.email} onChange={handleChange("email")} error={errors.email} />
        <FormField id="phone" label="Phone (optional)" value={values.phone} onChange={handleChange("phone")} />
        <FormField id="subject" label="Subject" required value={values.subject} onChange={handleChange("subject")} error={errors.subject} />
        <FormField
          id="message"
          label="Message"
          as="textarea"
          required
          value={values.message}
          onChange={handleChange("message")}
          error={errors.message}
          wrapperClassName="form-grid__full"
        />
      </div>

      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={status === "submitting"}>
          {status === "submitting" ? "Sending…" : "Send Message"}
        </button>
      </div>
    </form>
  );
}
