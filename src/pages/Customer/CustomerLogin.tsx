/**
 * The website's sign-in page — one form for customers AND staff (it says
 * nothing about staff; the server works out which account the email and
 * password open):
 *  - customers go to their account page;
 *  - staff go to the workspace (/admin), after choosing their own password on
 *    their first sign-in (invitation) and entering their authenticator code if
 *    two-step is on.
 * Also what /account shows to visitors who aren't signed in.
 */
import { useState, type FormEvent, type ChangeEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
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
import { useT } from "@/i18n/LanguageContext";
import * as staffApi from "@/admin/adminApi";
import "./customer.css";

type FormValues = { email: string; password: string };
type StaffStep = { kind: "two-factor"; challenge: string } | { kind: "password-change"; challenge: string; name: string } | null;

/** Field-level checks run before anything is sent to the server. */
function validate(values: FormValues) {
  const errors: Partial<Record<keyof FormValues, string>> = {};
  const emailProblem = emailError(values.email);
  if (emailProblem) errors.email = emailProblem;
  if (!values.password) errors.password = "Password is required.";
  return errors;
}

export default function CustomerLogin() {
  const t = useT();
  const { signIn, isSubmitting, errorMessage } = useCustomerAuth();
  const { content } = useSiteContent();
  const navigate = useNavigate();
  const location = useLocation();
  const [values, setValues] = useState<FormValues>({ email: "", password: "" });
  const [errors, setErrors] = useState<Partial<Record<keyof FormValues, string>>>({});
  // "Keep me signed in": a 30-day session instead of one that ends with the browser.
  const [remember, setRemember] = useState(false);
  const [step, setStep] = useState<StaffStep>(null);
  const [stepError, setStepError] = useState<string | null>(null);
  const [stepBusy, setStepBusy] = useState(false);
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const reason = (location.state as { reason?: string } | null)?.reason;

  function handleChange(field: keyof FormValues) {
    return (e: ChangeEvent<HTMLInputElement>) => {
      setValues((prev) => ({ ...prev, [field]: e.target.value }));
    };
  }

  function goToWorkspace() {
    navigate("/admin", { replace: true });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const validationErrors = validate(values);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    const outcome = await signIn(values.email, values.password, remember);
    if (!outcome) return;
    // Ask the browser to offer to save the password (see utils/credentials.ts).
    if (outcome.kind === "customer" || outcome.kind === "staff") void offerToSavePassword(values.email, values.password);
    if (outcome.kind === "customer") {
      // Shown in place of an /account/... section when signed out: go on to that same section.
      const inPortal = location.pathname === "/account" || /^\/account\/(track|requests|payments|saved|messages|invite|settings)/.test(location.pathname);
      const destination = (location.state as { from?: string } | null)?.from ?? (inPortal ? `${location.pathname}${location.hash}` : "/account");
      navigate(destination, { replace: true });
    } else if (outcome.kind === "staff") {
      goToWorkspace();
    } else {
      setStep(outcome);
    }
  }

  /** Runs one staff step with the workspace's own sign-in code. */
  async function runStaffStep(work: (admin: typeof staffApi) => Promise<void>) {
    setStepBusy(true);
    setStepError(null);
    try {
      await work(staffApi);
    } catch (error) {
      setStepError(error instanceof Error ? error.message : "Something went wrong. Please try again.");
    } finally {
      setStepBusy(false);
    }
  }

  function submitCode(event: FormEvent) {
    event.preventDefault();
    if (step?.kind !== "two-factor") return;
    void runStaffStep(async (admin) => {
      const { user } = await admin.adminLoginTwoFactor(step.challenge, code, remember);
      admin.setStoredUser(user);
      goToWorkspace();
    });
  }

  function submitNewPassword(event: FormEvent) {
    event.preventDefault();
    if (step?.kind !== "password-change") return;
    if (!checkPassword(newPassword, [step.name, values.email]).acceptable) {
      setStepError("Your new password doesn't meet all the requirements listed under it.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setStepError("The two passwords don't match.");
      return;
    }
    void runStaffStep(async (admin) => {
      const result = await admin.adminFirstPassword(step.challenge, newPassword, remember);
      if ("requiresTwoFactor" in result) {
        setStep({ kind: "two-factor", challenge: result.challenge });
        return;
      }
      if ("requiresPasswordChange" in result) return;
      admin.setStoredUser(result.user);
      void offerToSavePassword(values.email, newPassword);
      goToWorkspace();
    });
  }

  return (
    <>
      <Seo noindex title="Sign in" description="Sign in to your Lycie Investments account." />
      <section className="service-hero">
        <div className="container">
          <h1>{content.pageHeadings.login.heading}</h1>
          <p>{content.pageHeadings.login.body}</p>
        </div>
      </section>
      <section className="section container customer-auth">
        {step?.kind === "password-change" && (
          <form className="form-card customer-auth__form" onSubmit={submitNewPassword} noValidate name="first-password">
            <h2>Welcome, {step.name.split(" ")[0]}</h2>
            <p className="text-muted">For your security, choose your own password now. The one-time password from your invitation stops working.</p>
            {stepError && <FormStatusBanner status="error" successMessage="" errorMessage={stepError} />}
            <input type="text" name="username" autoComplete="username" value={values.email} readOnly hidden />
            <div className="form-grid">
              <NewPasswordField
                id="first-password"
                label="New password"
                value={newPassword}
                onChange={setNewPassword}
                onSuggest={(suggested) => {
                  setNewPassword(suggested);
                  setConfirmPassword(suggested);
                }}
                personalData={[step.name, values.email]}
              />
              <FormField id="first-password-confirm" label="Confirm new password" type="password" autoComplete="new-password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            </div>
            <div className="form-actions">
              <button className="btn btn-primary" type="submit" disabled={stepBusy}>
                {stepBusy ? "Saving…" : "Set password and continue"}
              </button>
            </div>
          </form>
        )}

        {step?.kind === "two-factor" && (
          <form className="form-card customer-auth__form" onSubmit={submitCode} noValidate name="staff-2fa">
            <h2>Two-step verification</h2>
            <p className="text-muted">Enter the 6-digit code from your authenticator app, or one of your recovery codes.</p>
            {stepError && <FormStatusBanner status="error" successMessage="" errorMessage={stepError} />}
            <div className="form-grid">
              <FormField id="staff-code" label="Code" inputMode="numeric" autoComplete="one-time-code" required value={code} onChange={(e) => setCode(e.target.value)} autoFocus />
            </div>
            <div className="form-actions">
              <button className="btn btn-primary" type="submit" disabled={stepBusy || !code.trim()}>
                {stepBusy ? "Checking…" : "Verify"}
              </button>
              <button className="btn-ghost" type="button" onClick={() => setStep(null)}>
                Back
              </button>
            </div>
          </form>
        )}

        {!step && (
          <form className="form-card customer-auth__form" onSubmit={handleSubmit} noValidate name="customer-login">
            <h2>{t("auth.signIn")}</h2>
            {reason === "inactivity" && <p className="form-status form-status--info">You were signed out after a period of inactivity.</p>}
            {reason === "expired" && <p className="form-status form-status--info">Your session ended. Please sign in again.</p>}

            {errorMessage && <FormStatusBanner status="error" successMessage="" errorMessage={errorMessage} />}

            <div className="form-grid">
              <EmailField
                id="customer-email"
                name="email"
                label={t("auth.email")}
                verify={false}
                value={values.email}
                onChange={(email) => setValues((prev) => ({ ...prev, email }))}
                error={errors.email}
                autoComplete="username"
              />
              <FormField
                id="customer-password"
                name="password"
                label={t("auth.password")}
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
                {isSubmitting ? t("auth.signingIn") : t("auth.signIn")}
              </button>
            </div>

            <SocialSignIn remember={remember} mode="signin" />

            <p className="text-muted customer-auth__switch">
              <Link to="/account/forgot-password">{t("auth.forgot")}</Link>
            </p>
            <p className="text-muted customer-auth__switch">
              {t("auth.newCustomer")} <Link to="/account/register">{t("auth.createAccount")}</Link>
            </p>
          </form>
        )}
      </section>
    </>
  );
}
