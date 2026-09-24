/**
 * System → Settings & status: website settings (language), the security rules
 * in force and the connected services. The descriptions come from the server
 * (only for people with System access) so they're never part of the
 * website's downloadable code.
 */
import { useAsyncData } from "@/hooks/useAsyncData";
import { adminApi } from "../adminApi";
import LanguageSettings from "../components/LanguageSettings";
import "../components/AdminLayout.css";
import "@/components/forms/FormField.css";

interface Row {
  label: string;
  ok: boolean;
  detail: string;
}

interface Status {
  securityNote: string;
  security: Row[];
  services: Row[];
}

function Table({ rows }: { rows: Row[] }) {
  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <td>{row.label}</td>
              <td>
                <span className={row.ok ? "ws-chip ws-chip--good" : "ws-chip ws-chip--warn"}>{row.ok ? "On" : "Off"}</span>
              </td>
              <td className="text-muted">{row.detail}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AdminSystemStatus() {
  const { data, isLoading, error } = useAsyncData(() => adminApi.get<Status>("/admin-tools/system-status"), []);
  return (
    <div>
      <div className="ws-hero">
        <div>
          <h1>Settings &amp; status</h1>
          <p>Website settings, the security rules in force, and connected services.</p>
        </div>
      </div>

      <section className="ws-section">
        <div className="ws-section__head">
          <h2>Site settings</h2>
        </div>
        <LanguageSettings />
      </section>

      {isLoading && <p className="text-muted">Loading…</p>}
      {error && <p className="text-muted" role="alert">{error}</p>}
      {data && (
        <>
          <section className="ws-section">
            <div className="ws-section__head">
              <h2>Security</h2>
            </div>
            <p className="text-muted">{data.securityNote}</p>
            <Table rows={data.security} />
          </section>
          <section className="ws-section">
            <div className="ws-section__head">
              <h2>Connected services</h2>
            </div>
            <Table rows={data.services} />
          </section>
        </>
      )}
    </div>
  );
}
