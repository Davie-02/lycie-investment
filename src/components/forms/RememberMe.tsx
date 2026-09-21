interface RememberMeProps {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Wording after the checkbox. */
  label?: string;
}

/**
 * "Keep me signed in" checkbox. Ticked = the server issues a 30-day
 * persistent session; unticked = a short one that ends when the browser closes.
 * Only meant for private devices, which the helper text says.
 */
export default function RememberMe({ id, checked, onChange, label = "Keep me signed in on this device" }: RememberMeProps) {
  return (
    <label className="form-check" htmlFor={id}>
      <input id={id} name="remember" type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  );
}
