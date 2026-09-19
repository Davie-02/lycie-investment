import { useState, type FormEvent } from "react";
import FormField from "@/components/forms/FormField";
import FormStatusBanner from "@/components/forms/FormStatusBanner";
import { submitVisitorMessage } from "@/services/lycie.service";
import "./AskUsForm.css";

const MAX_CHARS = 500;

/**
 * "Didn't find your answer?" — anonymous on purpose (no name/contact fields):
 * these messages help us improve the FAQ, they aren't enquiries. Anyone who
 * wants a reply is pointed to the contact page instead.
 */
export default function AskUsForm() {
  const [kind, setKind] = useState<"question" | "comment">("question");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (message.trim().length < 5) {
      setStatus("error");
      setError("Please write a little more so we can understand.");
      return;
    }
    setStatus("sending");
    setError(null);
    try {
      await submitVisitorMessage(kind, message.trim());
      setStatus("success");
      setMessage("");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : null);
    }
  }

  return (
    <form className="form-card ask-us" onSubmit={handleSubmit} noValidate>
      <h2>Didn't find your answer?</h2>
      <p className="text-muted">
        Tell us what you'd like to know, or leave a comment. The questions we hear most often become new FAQ answers.
      </p>

      <fieldset className="ask-us__kind">
        <legend className="ask-us__legend">This is a</legend>
        {(["question", "comment"] as const).map((value) => (
          <label key={value} className={kind === value ? "ask-us__chip ask-us__chip--active" : "ask-us__chip"}>
            <input
              type="radio"
              name="ask-kind"
              value={value}
              checked={kind === value}
              onChange={() => setKind(value)}
            />
            {value === "question" ? "Question" : "Comment"}
          </label>
        ))}
      </fieldset>

      {status === "success" && (
        <FormStatusBanner status="success" successMessage="Thank you — we've received it." errorMessage={null} />
      )}
      {status === "error" && <FormStatusBanner status="error" successMessage="" errorMessage={error} />}

      <FormField
        id="ask-message"
        as="textarea"
        label={`Your ${kind} (${message.length}/${MAX_CHARS})`}
        rows={4}
        maxLength={MAX_CHARS}
        value={message}
        onChange={(e) => {
          setMessage(e.target.value);
          if (status !== "sending") setStatus("idle");
        }}
        placeholder={kind === "question" ? "e.g. Can I pay my hire deposit with mobile money?" : "Tell us what we could do better"}
      />
      <p className="ask-us__note text-muted">
        This form is anonymous, so we can't reply. For a personal answer please use our contact page or WhatsApp — and
        don't include personal details here.
      </p>

      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={status === "sending"}>
          {status === "sending" ? "Sending…" : "Send"}
        </button>
      </div>
    </form>
  );
}
