import { useState, type FormEvent, type ChangeEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import Seo from "@/components/common/Seo";
import FormField from "@/components/forms/FormField";
import FormStatusBanner from "@/components/forms/FormStatusBanner";
import { useCustomerAuth } from "@/context/CustomerAuthContext";
import "./customer.css";

type FormValues = { name: string; email: string; password: string };

function validate(values: FormValues) {
  const errors: Partial<Record<keyof FormValues, string>> = {};
  if (!values.name.trim()) errors.name = "Full name is required.";
  if (!values.email.trim()) {
    errors.email = "Email is required.";
  } else if (!/^\S+@\S+\.\S+$/.test(values.email)) {
    errors.email = "Enter a valid email address.";
  }
  if (!values.password) {
    errors.password = "Password is required.";
  } else if (values.password.length < 8) {
    errors.password = "Password must be at least 8 characters.";
  }
  return errors;
}

export default function CustomerRegister() {
  const { register, isSubmitting, errorMessage } = useCustomerAuth();
  const navigate = useNavigate();
  const [values, setValues] = useState<FormValues>({ name: "", email: "", password: "" });
  const [errors, setErrors] = useState<Partial<Record<keyof FormValues, string>>>({});

  function handleChange(field: keyof FormValues) {
    return (e: ChangeEvent<HTMLInputElement>) => {
      setValues((prev) => ({ ...prev, [field]: e.target.value }));
    };
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const validationErrors = validate(values);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    if (await register(values.name, values.email, values.password)) {
      navigate("/account", { replace: true });
    }
  }

  return (
    <>
      <Seo title="Create Customer Account" description="Create a Lycie Investments customer account." />
      <section className="service-hero">
        <div className="container">
          <h1>Open an account</h1>
          <p>Create a secure customer account to keep track of your transactions.</p>
        </div>
      </section>
      <section className="section container customer-auth">
        <form className="form-card customer-auth__form" onSubmit={handleSubmit} noValidate>
          <h2>Create account</h2>

          {errorMessage && (
            <FormStatusBanner status="error" successMessage="" errorMessage={errorMessage} />
          )}

          <div className="form-grid">
            <FormField
              id="customer-name"
              label="Full Name"
              required
              value={values.name}
              onChange={handleChange("name")}
              error={errors.name}
              autoComplete="name"
            />
            <FormField
              id="customer-email"
              label="Email"
              type="email"
              required
              value={values.email}
              onChange={handleChange("email")}
              error={errors.email}
              autoComplete="username"
            />
            <FormField
              id="customer-password"
              label="Password"
              type="password"
              required
              value={values.password}
              onChange={handleChange("password")}
              error={errors.password}
              autoComplete="new-password"
            />
          </div>

          <div className="form-actions">
            <button className="btn btn-primary" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating account…" : "Create Account"}
            </button>
          </div>

          <p className="text-muted customer-auth__switch">
            Already registered? <Link to="/account/login">Sign in</Link>
          </p>
        </form>
      </section>
    </>
  );
}
