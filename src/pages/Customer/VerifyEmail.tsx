import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Seo from "@/components/common/Seo";
import FormStatusBanner from "@/components/forms/FormStatusBanner";
import { useCustomerAuth } from "@/context/CustomerAuthContext";
import { verifyCustomerEmail } from "@/services/customer.service";
import { ApiError } from "@/services/http";
import "./customer.css";

/**
 * Landing page for the link in the "Confirm your email" message
 * (/account/verify-email?token=…). Uses the token once, then tells the
 * person whether it worked.
 */
export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const { currentUser, updateCurrentUser } = useCustomerAuth();
  const [state, setState] = useState<"working" | "done" | "error">(token ? "working" : "error");
  const [message, setMessage] = useState<string | null>(token ? null : "This confirmation link is missing its token.");

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    verifyCustomerEmail(token)
      .then(() => {
        if (cancelled) return;
        setState("done");
        // If they're signed in on this device, clear the "please confirm" banner straight away.
        if (currentUser) updateCurrentUser({ ...currentUser, emailVerifiedAt: new Date().toISOString() });
      })
      .catch((error) => {
        if (cancelled) return;
        setState("error");
        setMessage(error instanceof ApiError ? error.message : "Something went wrong. Please try again.");
      });
    return () => {
      cancelled = true;
    };
    // Runs once per token; the auth values are only read, not reacted to.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <>
      <Seo title="Confirm Email" description="Confirm your email address for your Lycie Investments account." />
      <section className="service-hero">
        <div className="container">
          <h1>Confirm your email</h1>
        </div>
      </section>
      <section className="section container customer-auth">
        <div className="form-card customer-auth__form">
          {state === "working" && <p className="text-muted">Confirming your email…</p>}
          {state === "done" && (
            <>
              <FormStatusBanner status="success" successMessage="Thanks — your email address is confirmed." errorMessage={null} />
              <p className="text-muted customer-auth__switch">
                <Link to="/account">Go to my account</Link>
              </p>
            </>
          )}
          {state === "error" && (
            <>
              <FormStatusBanner status="error" successMessage="" errorMessage={message} />
              <p className="text-muted customer-auth__switch">
                <Link to="/account">Sign in to send a new link</Link>
              </p>
            </>
          )}
        </div>
      </section>
    </>
  );
}
