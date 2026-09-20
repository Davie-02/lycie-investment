import { useCustomerAuth } from "@/context/CustomerAuthContext";
import FormField from "./FormField";

export type PreferredContact = "whatsapp" | "call" | "email" | "message";

interface Props {
  value: PreferredContact | "";
  onChange: (value: PreferredContact | "") => void;
}

/**
 * Lets the customer say how they'd like us to reach them. "A message in my
 * Lycie profile" is only offered to signed-in customers, since only they have
 * a profile to receive it.
 */
export default function PreferredContactSelect({ value, onChange }: Props) {
  const { isAuthenticated } = useCustomerAuth();

  return (
    <FormField
      id="preferred-contact"
      as="select"
      label="How should we contact you? (optional)"
      value={value}
      onChange={(e) => onChange(e.target.value as PreferredContact | "")}
    >
      <option value="">No preference</option>
      <option value="whatsapp">WhatsApp</option>
      <option value="call">Phone call</option>
      <option value="email">Email</option>
      {isAuthenticated && <option value="message">A message in my Lycie profile</option>}
    </FormField>
  );
}
