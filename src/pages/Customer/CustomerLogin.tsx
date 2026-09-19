import { useState, type FormEvent, type ChangeEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import Seo from "@/components/common/Seo";
import FormField from "@/components/forms/FormField";
import FormStatusBanner from "@/components/forms/FormStatusBanner";
import { useCustomerAuth } from "@/context/CustomerAuthContext";
import "./customer.css";

type FormValues = { email: string; password: string };

function validate(values: FormValues) {
  const errors: Partial<Record<keyof FormValues, string>> = {};
  if (!values.email.trim()) {
    errors.email = "Email is required.";
  } else if (!/^\S+@\S+\.\S+$/.test(values.email)) {
    errors.email = "Enter a valid email address.";
  }
  if (!values.password) errors.password = "Password is required.";
  return errors;
}

export default function CustomerLogin() {
  const { login, isSubmitting, errorMessage } = useCustomerAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [values, setValues] = useState<FormValues>({ email: "", password: "" });
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

    if (await login(values.email, values.password)) {
      const destination = (location.state as { from?: string } | null)?.from ?? "/account";
      navigate(destination, { replace: true });
    }
  }

  return (
    <>
      <Seo title="Customer Login" description="Sign in to view your Lycie Investments account." />
      <section className="service-hero">
        <div className="container">
          <h1>Customer account</h1>
          <p>Sign in to view your balance and transaction history.</p>
        </div>
      </section>
      <section className="section container customer-auth">
        <form className="form-card customer-auth__form" onSubmit={handleSubmit} noValidate>
          <h2>Sign in</h2>

          {errorMessage && (
            <FormStatusBanner status="error" successMessage="" errorMessage={errorMessage} />
          )}

          <div className="form-grid">
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
              autoComplete="current-password"
            />
          </div>

          <div className="form-actions">
            <button className="btn btn-primary" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Signing in…" : "Sign In"}
            </button>
          </div>

          <p className="text-muted customer-auth__switch">
            <Link to="/account/forgot-password">Forgot your password?</Link>
          </p>
          <p className="text-muted customer-auth__switch">
            New customer? <Link to="/account/register">Create an account</Link>
          </p>
        </form>
      </section>
    </>
  );
}
