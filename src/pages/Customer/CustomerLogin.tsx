import { useState, type FormEvent, type ChangeEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import Seo from "@/components/common/Seo";
import FormField from "@/components/forms/FormField";
import EmailField from "@/components/forms/EmailField";
import RememberMe from "@/components/forms/RememberMe";
import SocialSignIn from "@/components/forms/SocialSignIn";
import FormStatusBanner from "@/components/forms/FormStatusBanner";
import { useSiteContent } from "@/context/SiteContentContext";
import { useCustomerAuth } from "@/context/CustomerAuthContext";
import { emailError } from "@/utils/email";
import { offerToSavePassword } from "@/utils/credentials";
import "./customer.css";

type FormValues = { email: string; password: string };

/** Field-level checks run before anything is sent to the server. */
function validate(values: FormValues) {
  const errors: Partial<Record<keyof FormValues, string>> = {};
  const emailProblem = emailError(values.email);
  if (emailProblem) errors.email = emailProblem;
  if (!values.password) errors.password = "Password is required.";
  return errors;
}

export default function CustomerLogin() {
  const { login, isSubmitting, errorMessage } = useCustomerAuth();
  const { content } = useSiteContent();
  const navigate = useNavigate();
  const location = useLocation();
  const [values, setValues] = useState<FormValues>({ email: "", password: "" });
  const [errors, setErrors] = useState<Partial<Record<keyof FormValues, string>>>({});
  // "Keep me signed in": a 30-day session instead of one that ends with the browser.
  const [remember, setRemember] = useState(false);

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

    if (await login(values.email, values.password, remember)) {
      // Ask the browser to offer to save the password (see utils/credentials.ts).
      void offerToSavePassword(values.email, values.password);
      const destination = (location.state as { from?: string } | null)?.from ?? "/account";
      navigate(destination, { replace: true });
    }
  }

  return (
    <>
      <Seo title="Customer Login" description="Sign in to view your Lycie Investments account." />
      <section className="service-hero">
        <div className="container">
          <h1>{content.pageHeadings.login.heading}</h1>
          <p>{content.pageHeadings.login.body}</p>
        </div>
      </section>
      <section className="section container customer-auth">
        <form className="form-card customer-auth__form" onSubmit={handleSubmit} noValidate name="customer-login">
          <h2>Sign in</h2>

          {errorMessage && (
            <FormStatusBanner status="error" successMessage="" errorMessage={errorMessage} />
          )}

          <div className="form-grid">
            <EmailField
              id="customer-email"
              name="email"
              value={values.email}
              onChange={(email) => setValues((prev) => ({ ...prev, email }))}
              error={errors.email}
              autoComplete="username"
            />
            <FormField
              id="customer-password"
              name="password"
              label="Password"
              type="password"
              required
              value={values.password}
              onChange={handleChange("password")}
              error={errors.password}
              autoComplete="current-password"
            />
            <RememberMe id="customer-remember" checked={remember} onChange={setRemember} />
          </div>

          <div className="form-actions">
            <button className="btn btn-primary" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Signing in…" : "Sign In"}
            </button>
          </div>

          <SocialSignIn remember={remember} mode="signin" />

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
