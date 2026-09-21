import { useState } from "react";
import FormField from "./FormField";
import { checkPassword, generateStrongPassword } from "@/utils/password";

interface NewPasswordFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  /** Details the password must not contain, e.g. [name, email]. */
  personalData?: Array<string | undefined>;
  /** Called with a suggested password so the page can also fill its "confirm password" field. */
  onSuggest?: (password: string) => void;
  name?: string;
  autoFocus?: boolean;
  /** False when leaving it blank is fine (e.g. "keep the current password" on an edit form). */
  required?: boolean;
}

/**
 * The field to use wherever someone CHOOSES a password (sign-up, reset,
 * change password, creating an admin account). On top of the usual show/hide
 * toggle it adds:
 *  - a live strength meter and a checklist of the rules (mirrors the server's),
 *  - a "Suggest a strong password" button that fills in a random one,
 *  - `autocomplete="new-password"` + Safari's `passwordrules`, so the browser's
 *    own password manager also offers to generate and save one.
 */
export default function NewPasswordField({ id, label, value, onChange, error, personalData, onSuggest, name = "new-password", autoFocus, required = true }: NewPasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const [suggested, setSuggested] = useState(false);
  const [copied, setCopied] = useState(false);
  const check = checkPassword(value, personalData);

  function suggest() {
    const password = generateStrongPassword();
    onChange(password);
    onSuggest?.(password);
    // Show it, otherwise the person is asked to accept a password they can't read.
    setVisible(true);
    setSuggested(true);
    setCopied(false);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      // Clipboard blocked (older browsers / insecure context): the password is visible, so it can be copied by hand.
    }
  }

  return (
    <FormField
      id={id}
      name={name}
      label={label}
      type="password"
      required={required}
      value={value}
      onChange={(event) => {
        setSuggested(false);
        onChange(event.target.value);
      }}
      error={error}
      autoComplete="new-password"
      autoFocus={autoFocus}
      passwordVisible={visible}
      onPasswordVisibleChange={setVisible}
      // Safari's password manager reads this to generate a password that satisfies our rules.
      {...({ passwordrules: "minlength: 10; maxlength: 72; required: lower; required: upper; required: digit; allowed: [-!@#$%^&*_=+?];" } as object)}
      footer={
        <div className="password-help">
          <div className={`password-meter password-meter--${check.score}`} aria-hidden="true">
            <span className="password-meter__segment" />
            <span className="password-meter__segment" />
            <span className="password-meter__segment" />
            <span className="password-meter__segment" />
          </div>
          <p className="password-help__strength" aria-live="polite">
            {value ? `Password strength: ${check.label}` : "Choose a strong password."}
          </p>
          <ul className="password-rules">
            {check.rules.map((rule) => (
              <li key={rule.id} className={rule.met ? "password-rules__item password-rules__item--met" : "password-rules__item"}>
                {rule.label}
              </li>
            ))}
          </ul>
          <div className="password-help__actions">
            <button type="button" className="link-button" onClick={suggest}>
              Suggest a strong password
            </button>
            {suggested && (
              <button type="button" className="link-button" onClick={copy}>
                {copied ? "Copied" : "Copy"}
              </button>
            )}
          </div>
        </div>
      }
    />
  );
}
