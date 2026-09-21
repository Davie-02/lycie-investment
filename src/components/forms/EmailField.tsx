import { useState, type ChangeEvent, type InputHTMLAttributes } from "react";
import FormField from "./FormField";
import { suggestEmailFix } from "@/utils/email";

interface EmailFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> {
  id: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
}

/**
 * Email input with the right keyboard on phones, no auto-capitalisation, and a
 * "Did you mean …?" hint when the address looks like a typo of a common
 * provider (gmial.com → gmail.com). The hint appears once the person leaves the
 * field, so it never interrupts typing.
 */
export default function EmailField({ id, label = "Email", value, onChange, error, required = true, ...rest }: EmailFieldProps) {
  const [checked, setChecked] = useState(false);
  const suggestion = checked ? suggestEmailFix(value) : null;

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
        onChange(event.target.value);
      }}
      onBlur={() => setChecked(true)}
      error={error}
      {...rest}
      footer={
        suggestion ? (
          <p className="form-field__hint">
            Did you mean{" "}
            <button
              type="button"
              className="link-button"
              onClick={() => {
                onChange(suggestion);
                setChecked(false);
              }}
            >
              {suggestion}
            </button>
            ?
          </p>
        ) : undefined
      }
    />
  );
}
