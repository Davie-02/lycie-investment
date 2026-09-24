import { useEffect, useRef, useState, type ChangeEvent, type InputHTMLAttributes } from "react";
import FormField from "./FormField";
import { isValidEmailFormat, suggestEmailFix } from "@/utils/email";
import { apiPost } from "@/services/http";

interface EmailFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> {
  id: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
  /** Ask the server whether the address can receive mail when the person leaves the field (default on). */
  verify?: boolean;
}

interface EmailVerdict {
  ok: boolean;
  reason?: string;
  suggestion?: string;
}

/** Answers already fetched in this visit, so going back and forth between fields doesn't re-ask. */
const verdictCache = new Map<string, EmailVerdict>();

/**
 * Email input with the right keyboard on phones, no auto-capitalisation, and
 * two kinds of help once the person leaves the field (never while typing):
 *  - instantly, a "Did you mean gmail.com?" hint for typos of common providers;
 *  - from the server (POST /auth/check-email), whether the address can really
 *    receive mail: the domain exists and has mail servers, isn't a throwaway
 *    inbox, and isn't a look-alike typo domain. The server repeats these
 *    checks on submit, so this is guidance, not the gate.
 */
export default function EmailField({ id, label = "Email", value, onChange, error, required = true, verify = true, ...rest }: EmailFieldProps) {
  const [checked, setChecked] = useState(false);
  const [verdict, setVerdict] = useState<EmailVerdict | null>(null);
  const latest = useRef(value);
  latest.current = value;

  const localSuggestion = checked ? suggestEmailFix(value) : null;
  const suggestion = verdict?.suggestion ?? localSuggestion;

  useEffect(() => {
    if (!checked || !verify) return;
    const email = value.trim().toLowerCase();
    if (!isValidEmailFormat(email)) return;
    const cached = verdictCache.get(email);
    if (cached) {
      setVerdict(cached);
      return;
    }
    apiPost<EmailVerdict>("/auth/check-email", { email })
      .then((result) => {
        verdictCache.set(email, result);
        // Ignore a late answer for an address the person has since changed.
        if (latest.current.trim().toLowerCase() === email) setVerdict(result);
      })
      .catch(() => undefined); // offline or rate-limited: the submit-time check still applies
  }, [checked, value, verify]);

  function applySuggestion(next: string) {
    onChange(next);
    setVerdict(null);
    setChecked(false);
  }

  const serverProblem = verdict && !verdict.ok ? verdict.reason : undefined;

  return (
    <FormField
      id={id}
      label={label}
      type="email"
      inputMode="email"
      autoCapitalize="off"
      autoCorrect="off"
      spellCheck={false}
      required={required}
      value={value}
      onChange={(event: ChangeEvent<HTMLInputElement>) => {
        setChecked(false);
        setVerdict(null);
        onChange(event.target.value);
      }}
      onBlur={() => setChecked(true)}
      error={error ?? (suggestion ? undefined : serverProblem)}
      {...rest}
      footer={
        suggestion ? (
          <p className="form-field__hint">
            Did you mean{" "}
            <button type="button" className="link-button" onClick={() => applySuggestion(suggestion)}>
              {suggestion}
            </button>
            ?
          </p>
        ) : undefined
      }
    />
  );
}
