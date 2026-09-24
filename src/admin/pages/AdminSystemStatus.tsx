/**
 * System → System status: the security rules in force for this workspace and
 * which outside services are connected, with what to set if something is off.
 */
import { useAsyncData } from "@/hooks/useAsyncData";
import { adminApi } from "../adminApi";
import LanguageSettings from "../components/LanguageSettings";
import "@/components/forms/FormField.css";
import "../components/AdminLayout.css";

interface Status {
  security: {
    adminTwoFactorRequired: boolean;
    adminIpAllowlist: boolean;
    admins: number;
    adminsWithout2fa: number;
    staffWithout2fa: number;
    sessionHours: string;
  };
  services: Record<string, boolean>;
}

const SERVICES: Array<{ key: string; label: string; off: string }> = [
  { key: "email", label: "Email delivery", off: "Set RESEND_API_KEY or BREVO_API_KEY — invitations, resets and alerts need it." },
  { key: "emailVerification", label: "Mailbox verification", off: "Optional: EMAIL_VERIFICATION_PROVIDER + EMAIL_VERIFICATION_API_KEY." },
  { key: "whatsapp", label: "WhatsApp notifications", off: "Optional: WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_ACCESS_TOKEN, WHATSAPP_TEMPLATE_NAME." },
  { key: "mobileMoney", label: "Mobile money (PayChangu)", off: "Optional: PAYCHANGU_SECRET_KEY." },
  { key: "mobileMoneyWebhook", label: "Mobile money webhook", off: "Optional: PAYCHANGU_WEBHOOK_SECRET (payments also confirm when customers return)." },
  { key: "ai", label: "Lycie AI", off: "Set GEMINI_API_KEY." },
  { key: "imageStorage", label: "Permanent image storage", off: "Set the S3_* storage settings, or photos are lost on restart." },
  { key: "googleSignIn", label: "Sign in with Google", off: "Optional: GOOGLE_CLIENT_ID." },
  { key: "facebookSignIn", label: "Sign in with Facebook", off: "Optional: FACEBOOK_APP_ID + FACEBOOK_APP_SECRET." },
];

function Row({ ok, label, detail }: { ok: boolean; label: string; detail?: string }) {
  return (
    <tr>
      <td>{label}</td>
      <td>
        <span className={ok ? "ws-chip ws-chip--good" : "ws-chip ws-chip--warn"}>{ok ? "On" : "Off"}</span>
      </td>
      <td className="text-muted">{detail}</td>
    </tr>
  );
}

export default function AdminSystemStatus() {
  const { data, isLoading, error } = useAsyncData(() => adminApi.get<Status>("/admin-tools/system-status"), []);
  return (
    <div>
      <div className="ws-hero">
        <div>
          <h1>Settings &amp; status</h1>
          <p>Site settings, the security rules in force, and connected services.</p>
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
            <p className="text-muted">These are set on the server (Render → Environment).</p>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <tbody>
                  <Row ok={data.security.adminTwoFactorRequired} label="Two-step verification required for administrators" detail="SYSTEM_ADMIN_REQUIRE_2FA (on unless set to false)" />
                  <Row ok={data.security.adminIpAllowlist} label="Administrators limited to listed networks" detail="Optional: SYSTEM_ADMIN_ALLOWED_IPS=41.70.1.2, …" />
                  <Row ok label="Administrators sign in only through the admin portal" detail="Other staff use the website sign-in" />
                  <Row ok label="Sensitive changes need 'confirm it's you'" detail="New administrators, access changes, deletions, 2FA resets" />
                  <Row ok label="Sign-in alert emails" detail="Every staff sign-in is emailed to the account owner" />
                  <Row ok={data.security.adminsWithout2fa === 0} label="Administrators with two-step on" detail={`${data.security.admins - data.security.adminsWithout2fa} of ${data.security.admins}`} />
                  <Row ok={data.security.staffWithout2fa === 0} label="Staff with two-step on" detail={data.security.staffWithout2fa ? `${data.security.staffWithout2fa} staff haven't turned it on (recommended)` : "Everyone"} />
                </tbody>
              </table>
            </div>
          </section>
          <section className="ws-section">
            <div className="ws-section__head">
              <h2>Connected services</h2>
            </div>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <tbody>
                  {SERVICES.map((service) => (
                    <Row key={service.key} ok={Boolean(data.services[service.key])} label={service.label} detail={data.services[service.key] ? "Connected" : service.off} />
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
