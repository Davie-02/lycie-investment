import type { InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes, ReactNode } from "react";
import "./FormField.css";

interface BaseFieldProps {
  id: string;
  label: string;
  error?: string;
  required?: boolean;
  wrapperClassName?: string;
}

type InputFieldProps = BaseFieldProps &
  InputHTMLAttributes<HTMLInputElement> & { as?: "input" };

type TextareaFieldProps = BaseFieldProps &
  TextareaHTMLAttributes<HTMLTextAreaElement> & { as: "textarea" };

type SelectFieldProps = BaseFieldProps &
  SelectHTMLAttributes<HTMLSelectElement> & { as: "select"; children: ReactNode };

type FormFieldProps = InputFieldProps | TextareaFieldProps | SelectFieldProps;

export default function FormField(props: FormFieldProps) {
  const { id, label, error, required, wrapperClassName, as = "input", ...rest } = props;
  const describedBy = error ? `${id}-error` : undefined;

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

      {as === "input" && (
        <input
          id={id}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          className={error ? "form-field__input form-field__input--error" : "form-field__input"}
          {...(rest as InputHTMLAttributes<HTMLInputElement>)}
        />
      )}

      {error && (
        <p id={`${id}-error`} className="form-field__error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
