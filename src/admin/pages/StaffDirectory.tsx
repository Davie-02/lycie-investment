/** Team directory: every active colleague, their department and how to reach them. */
import { useMemo, useState } from "react";
import { useAsyncData } from "@/hooks/useAsyncData";
import { adminApi } from "../adminApi";
import "../components/AdminLayout.css";

interface Person {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  jobTitle: string | null;
  department: string | null;
  role: string;
}

const DEPARTMENT_LABEL: Record<string, string> = {
  management: "Management",
  sales: "Sales",
  hire: "Hire & Fleet",
  imports: "Imports & Clearing",
  finance: "Finance",
  customer_care: "Customer Care",
  marketing: "Marketing",
  hr: "Human Resources",
  general: "General staff",
};

export default function StaffDirectory() {
  const { data, isLoading } = useAsyncData(() => adminApi.get<Person[]>("/hr/directory"), []);
  const [query, setQuery] = useState("");
  const groups = useMemo(() => {
    const term = query.trim().toLowerCase();
    const map = new Map<string, Person[]>();
    for (const person of data ?? []) {
      if (term && !`${person.name} ${person.jobTitle ?? ""} ${person.email}`.toLowerCase().includes(term)) continue;
      const key = person.role === "OWNER" ? "Administration" : DEPARTMENT_LABEL[person.department ?? ""] ?? "Other";
      map.set(key, [...(map.get(key) ?? []), person]);
    }
    return [...map.entries()];
  }, [data, query]);

  return (
    <div>
      <div className="ws-hero">
        <div>
          <h1>Team directory</h1>
          <p>Who works where, and how to reach them.</p>
        </div>
      </div>
      <div className="ws-toolbar">
        <input type="search" placeholder="Search colleagues…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search colleagues" />
      </div>
      {isLoading && !data && <p className="text-muted">Loading…</p>}
      {groups.map(([group, people]) => (
        <section key={group} className="ws-section">
          <div className="ws-section__head">
            <h2>{group}</h2>
          </div>
          <div className="ws-cards">
            {people.map((person) => (
              <div key={person.id} className="ws-card">
                <h3>{person.name}</h3>
                {person.jobTitle && <p>{person.jobTitle}</p>}
                <p>
                  <a href={`mailto:${person.email}`}>{person.email}</a>
                  {person.phone && (
                    <>
                      <br />
                      <a href={`tel:${person.phone.replace(/[^\d+]/g, "")}`}>{person.phone}</a>
                    </>
                  )}
                </p>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
