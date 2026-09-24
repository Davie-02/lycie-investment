/** Finds a customer by name or email (they need an account on the website). */
import { useEffect, useState } from "react";
import FormField from "@/components/forms/FormField";
import { adminApi } from "../../adminApi";

export interface CustomerChoice {
  id: string;
  name: string;
  email: string;
}

export default function CustomerPicker({ value, onChange }: { value: CustomerChoice | null; onChange: (customer: CustomerChoice | null) => void }) {
  const [lookup, setLookup] = useState("");
  const [matches, setMatches] = useState<CustomerChoice[]>([]);

  useEffect(() => {
    if (value || lookup.trim().length < 2) {
      setMatches([]);
      return;
    }
    const timer = setTimeout(() => {
      adminApi
        .get<CustomerChoice[]>(`/customer-lookup?q=${encodeURIComponent(lookup.trim())}`)
        .then(setMatches)
        .catch(() => setMatches([]));
    }, 250);
    return () => clearTimeout(timer);
  }, [lookup, value]);

  if (value) {
    return (
      <p style={{ margin: 0 }}>
        Customer: <strong>{value.name}</strong> ({value.email}){" "}
        <button type="button" className="link-button" onClick={() => onChange(null)}>
          change
        </button>
      </p>
    );
  }
  return (
    <div>
      <FormField id="purchase-customer" label="Customer (name or email)" value={lookup} onChange={(e) => setLookup(e.target.value)} autoComplete="off" required />
      {matches.length > 0 && (
        <ul className="admin-search__results" style={{ position: "static" }}>
          {matches.map((match) => (
            <li key={match.id}>
              <button type="button" className="link-button" onClick={() => onChange(match)}>
                {match.name} — {match.email}
              </button>
            </li>
          ))}
        </ul>
      )}
      {lookup.trim().length >= 2 && matches.length === 0 && <p className="text-muted">No customer found. They need to create an account on the website first.</p>}
    </div>
  );
}
