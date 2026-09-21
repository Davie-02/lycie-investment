import { useState, type InputHTMLAttributes, type TextareaHTMLAttributes, type SelectHTMLAttributes, type ReactNode } from "react";
import "./FormField.css";

interface BaseFieldProps {
  id: string;
  label: string;
  error?: string;
  required?: boolean;
  wrapperClassName?: string;
  /** Optional content shown under the control (e.g. an AI-writing button). */
  footer?: ReactNode;
  /**
   * Password fields only. By default each field remembers for itself whether
   * its text is revealed; pass these to control it from outside (the "suggest a
   * strong password" button reveals the new password so it can be read/copied).
   */
  passwordVisible?: boolean;
  onPasswordVisibleChange?: (visible: boolean) => void;
}

type InputFieldProps = BaseFieldProps &
  InputHTMLAttributes<HTMLInputElement> & { as?: "input" };

type TextareaFieldProps = BaseFieldProps &
  TextareaHTMLAttributes<HTMLTextAreaElement> & { as: "textarea" };

type SelectFieldProps = BaseFieldProps &
  SelectHTMLAttributes<HTMLSelectElement> & { as: "select"; children: ReactNode };

type FormFieldProps = InputFieldProps | TextareaFieldProps | SelectFieldProps;

/** Eye icon (password hidden — click to show). Drawn inline so it takes its colour from the text. */
function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1.5 12S5.5 5 12 5s10.5 7 10.5 7-4 7-10.5 7S1.5 12 1.5 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

/** Crossed-out eye (password visible — click to hide). */
function EyeOffIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17.9 17.9A10.6 10.6 0 0 1 12 19C5.5 19 1.5 12 1.5 12a19 19 0 0 1 4.6-5.4M9.9 5.2A10 10 0 0 1 12 5c6.5 0 10.5 7 10.5 7a19 19 0 0 1-2.2 3.1" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
      <path d="m2 2 20 20" />
    </svg>
  );
}

/**
 * The one form-field component used across the whole site (inputs, textareas,
 * selects). Every `type="password"` input automatically gets a show/hide
 * button, so login, reset, change-password and admin forms all behave alike.
 */
export default function FormField(props: FormFieldProps) {
  const { id, label, error, required, wrapperClassName, footer, passwordVisible, onPasswordVisibleChange, as = "input", ...rest } = props;
  const describedBy = error ? `${id}-error` : undefined;

  // Whether a password's text is currently shown. Internal unless the parent controls it.
  const [ownVisible, setOwnVisible] = useState(false);
  const visible = passwordVisible ?? ownVisible;
  function setVisible(next: boolean) {
    setOwnVisible(next);
    onPasswordVisibleChange?.(next);
  }
  const isPassword = as === "input" && (rest as InputHTMLAttributes<HTMLInputElement>).type === "password";

  return (
    <div className={wrapperClassName ? `form-field ${wrapperClassName}` : "form-field"}>
      <label htmlFor={id}>
        {label}
        {required && <span className="form-field__required"> *</span>}
      </label>

      {as === "textarea" && (
        <textarea
          id={id}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          className={error ? "form-field__input form-field__input--error" : "form-field__input"}
          {...(rest as TextareaHTMLAttributes<HTMLTextAreaElement>)}
        />
      )}

      {as === "select" && (
        <select
          id={id}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          className={error ? "form-field__input form-field__input--error" : "form-field__input"}
          {...(rest as SelectHTMLAttributes<HTMLSelectElement>)}
        >
          {(props as SelectFieldProps).children}
        </select>
      )}

      {as === "input" && !isPassword && (
        <input
          id={id}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          className={error ? "form-field__input form-field__input--error" : "form-field__input"}
          {...(rest as InputHTMLAttributes<HTMLInputElement>)}
        />
      )}

      {isPassword && (
        <div className="form-field__password">
          <input
            id={id}
            aria-invalid={!!error}
            aria-describedby={describedBy}
            // Stop phones capitalising/"correcting" what is typed into a password box.
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            className={error ? "form-field__input form-field__input--error" : "form-field__input"}
            {...(rest as InputHTMLAttributes<HTMLInputElement>)}
            // Placed after the spread on purpose: the real type is swapped to reveal the text.
            type={visible ? "text" : "password"}
          />
          <button
            type="button"
            className="form-field__toggle"
            onClick={() => setVisible(!visible)}
            aria-label={visible ? "Hide password" : "Show password"}
            aria-pressed={visible}
            title={visible ? "Hide password" : "Show password"}
          >
            {visible ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        </div>
      )}

      {error && (
        <p id={`${id}-error`} className="form-field__error" role="alert">
          {error}
        </p>
      )}
      {footer}
    </div>
  );
}
