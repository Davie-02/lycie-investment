/**
 * Customer sign-up page: name, email (with typo hints), a strong-password helper with
 * strength meter and suggestion, confirm password, 'Keep me signed in' and
 * Google/Facebook buttons (when configured). The server re-checks every rule.
 */
import { useState, type FormEvent, type ChangeEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import Seo from "@/components/common/Seo";
import FormField from "@/components/forms/FormField";
import EmailField from "@/components/forms/EmailField";
import NewPasswordField from "@/components/forms/NewPasswordField";
import RememberMe from "@/components/forms/RememberMe";
import SocialSignIn from "@/components/forms/SocialSignIn";
import FormStatusBanner from "@/components/forms/FormStatusBanner";
import { useSiteContent } from "@/context/SiteContentContext";
import { useCustomerAuth } from "@/context/CustomerAuthContext";
import { emailError } from "@/utils/email";
import { checkPassword } from "@/utils/password";
import { offerToSavePassword } from "@/utils/credentials";
import "./customer.css";

type FormValues = { name: string; email: string; password: string; confirmPassword: string };

/** Field-level checks run before anything is sent to the server (which re-checks everything). */
function validate(values: FormValues) {
  const errors: Partial<Record<keyof FormValues, string>> = {};
  if (!values.name.trim()) errors.name = "Full name is required.";
  const emailProblem = emailError(values.email);
  if (emailProblem) errors.email = emailProblem;
  if (!values.password) {
    errors.password = "Password is required.";
  } else if (!checkPassword(values.password, [values.name, values.email]).acceptable) {
    errors.password = "Your password doesn't meet all the requirements below.";
  }
  if (values.confirmPassword !== values.password) errors.confirmPassword = "Passwords do not match.";
  return errors;
}

export default function CustomerRegister() {
  const { register, isSubmitting, errorMessage } = useCustomerAuth();
  const { content } = useSiteContent();
  const navigate = useNavigate();
  const [values, setValues] = useState<FormValues>({ name: "", email: "", password: "", confirmPassword: "" });
  const [errors, setErrors] = useState<Partial<Record<keyof FormValues, string>>>({});
  const [remember, setRemember] = useState(false);
  // A friend's share link (/account/register?ref=CODE) links the new account to them for a reward.
  const [searchParams] = useSearchParams();
  const referralCode = (searchParams.get("ref") ?? "").slice(0, 20);

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

    if (await register(values.name, values.email, values.password, remember, referralCode || undefined)) {
      // Ask the browser to offer to save the new password (see utils/credentials.ts).
      void offerToSavePassword(values.email, values.password, values.name);
      navigate("/account", { replace: true });
    }
  }

  return (
    <>
      <Seo noindex title="Create Customer Account" description="Create a Lycie Investments customer account." />
      <section className="service-hero">
        <div className="container">
          <h1>{content.pageHeadings.register.heading}</h1>
          <p>{content.pageHeadings.register.body}</p>
        </div>
      </section>
      <section className="section container customer-auth">
        <form className="form-card customer-auth__form" onSubmit={handleSubmit} noValidate name="customer-register">
          <h2>Create account</h2>
          {referralCode && <p className="form-status form-status--info">A friend invited you — welcome! Your account will be linked to their invitation.</p>}

          {errorMessage && (
            <FormStatusBanner status="error" successMessage="" errorMessage={errorMessage} />
          )}

          <div className="form-grid">
            <FormField
              id="customer-name"
              name="name"
              label="Full Name"
              required
              value={values.name}
              onChange={handleChange("name")}
              error={errors.name}
              autoComplete="name"
            />
            <EmailField
              id="customer-email"
              name="email"
              value={values.email}
              onChange={(email) => setValues((prev) => ({ ...prev, email }))}
              error={errors.email}
              autoComplete="username"
            />
            <NewPasswordField
              id="customer-password"
              label="Password"
              value={values.password}
              onChange={(password) => setValues((prev) => ({ ...prev, password }))}
              // A suggested password fills the confirmation too, so it can be submitted straight away.
              onSuggest={(password) => setValues((prev) => ({ ...prev, password, confirmPassword: password }))}
              personalData={[values.name, values.email]}
              error={errors.password}
            />
            <FormField
              id="customer-confirm-password"
              name="confirm-password"
              label="Confirm Password"
              type="password"
              required
              value={values.confirmPassword}
              onChange={handleChange("confirmPassword")}
              error={errors.confirmPassword}
              autoComplete="new-password"
            />
            <RememberMe id="customer-remember" checked={remember} onChange={setRemember} />
          </div>

          <div className="form-actions">
            <button className="btn btn-primary" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating account…" : "Create Account"}
            </button>
          </div>

          <SocialSignIn remember={remember} mode="signup" />

          <p className="text-muted customer-auth__switch">
            Already registered? <Link to="/account/login">Sign in</Link>
          </p>
        </form>
      </section>
    </>
  );
}
