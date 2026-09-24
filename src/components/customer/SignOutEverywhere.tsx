/**
 * "Sign out everywhere" on the customer account page: ends the session on
 * every other phone, tablet and computer (lost device, shared computer),
 * keeping this one signed in.
 */
import { useState } from "react";
import FormStatusBanner from "@/components/forms/FormStatusBanner";
import { signOutEverywhere } from "@/services/customer.service";

export default function SignOutEverywhere() {
  const [status, setStatus] = useState<"idle" | "working" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function run() {
    setStatus("working");
    try {
      await signOutEverywhere();
      setStatus("done");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Something went wrong. Please try again.");
      setStatus("error");
    }
  }

  return (
    <div className="customer-account__history customer-account__settings">
      <h2>Signed-in devices</h2>
      <p className="text-muted">Signed in on a shared computer, or lost a phone? Sign out everywhere else — you'll stay signed in here.</p>
      {status === "done" && <FormStatusBanner status="success" successMessage="All your other devices have been signed out." errorMessage={null} />}
      {status === "error" && <FormStatusBanner status="error" successMessage="" errorMessage={message} />}
      <button type="button" className="btn btn-secondary" onClick={() => void run()} disabled={status === "working"}>
        {status === "working" ? "Signing out…" : "Sign out everywhere else"}
      </button>
    </div>
  );
}
