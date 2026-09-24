import { useCallback, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAsyncData } from "@/hooks/useAsyncData";
import { adminApi, downloadExport } from "../adminApi";
import { useAdminAuth } from "../context/AdminAuthContext";
import { ApiError } from "@/services/http";
import ContactCell from "../components/ContactCell";
import "../components/AdminLayout.css";
import type { ModuleKey } from "../access";
import Price from "@/components/common/Price";

export type TabKey = "inquiries" | "import" | "clearing" | "hire" | "contact";

/** The module that owns each kind of request (who may see and handle it). */
const TAB_MODULE: Record<TabKey, ModuleKey> = {
  inquiries: "sales",
  import: "imports",
  clearing: "imports",
  hire: "hire",
  contact: "customers",
};
type RequestStatus = "new" | "contacted" | "closed";

const STATUS_BADGE_CLASS: Record<RequestStatus, string> = {
  new: "admin-badge--reserved",
  contacted: "admin-badge--available",
  closed: "admin-badge--sold",
};

const STATUS_CYCLE: Record<RequestStatus, RequestStatus> = {
  new: "contacted",
  contacted: "closed",
  closed: "new",
};

const STATUS_CYCLE_LABEL: Record<RequestStatus, string> = {
  new: "Mark Contacted",
  contacted: "Mark Closed",
  closed: "Reopen",
};

interface Inquiry {
  id: string;
  customerId?: string | null;
  preferredContact?: string | null;
  fullName: string;
  phone: string;
  email: string;
  message: string | null;
  vehicle: { make: string; model: string; year: number } | null;
  status: RequestStatus;
  createdAt: string;
}

interface ImportRequestRecord {
  id: string;
  customerId?: string | null;
  preferredContact?: string | null;
  fullName: string;
  phone: string;
  email: string;
  preferredMake: string;
  preferredModel: string | null;
  budget: number | null;
  status: RequestStatus;
  createdAt: string;
}

interface ClearingRequestRecord {
  id: string;
  customerId?: string | null;
  preferredContact?: string | null;
  fullName: string;
  phone: string;
  email: string;
  vehicleMake: string;
  vin: string;
  currentLocation: string;
  status: RequestStatus;
  createdAt: string;
}

interface HireRequestRecord {
  id: string;
  customerId?: string | null;
  preferredContact?: string | null;
  fullName: string;
  phone: string;
  email: string;
  vehicle: { name: string } | null;
  pickupDate: string;
  returnDate: string;
  days: number;
  totalCost: number;
  currency: string;
  status: "pending" | "confirmed" | "cancelled" | "completed";
  createdAt: string;
}

interface ContactMessageRecord {
  id: string;
  customerId?: string | null;
  preferredContact?: string | null;
  fullName: string;
  email: string;
  phone?: string | null;
  subject: string;
  message: string;
  status: RequestStatus;
  createdAt: string;
}

const TABS: { key: TabKey; label: string }[] = [
  { key: "inquiries", label: "Vehicle Inquiries" },
  { key: "import", label: "Import Requests" },
  { key: "clearing", label: "Clearing Requests" },
  { key: "hire", label: "Hire Requests" },
  { key: "contact", label: "Contact Messages" },
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString();
}

/**
 * Status badge + (for Owner/Manager) a one-click button that cycles
 * new → contacted → closed → new. Shared across all four non-hire request
 * tables, which all use the identical three-state status model.
 */
function StatusCell({
  status,
  canManage,
  isUpdating,
  onCycle,
}: {
  status: RequestStatus;
  canManage: boolean;
  isUpdating: boolean;
  onCycle: () => void;
}) {
  return (
    <div className="request-status-cell">
      <span className={`admin-badge ${STATUS_BADGE_CLASS[status]}`}>{status}</span>
      {canManage && (
        <button type="button" className="btn-ghost" disabled={isUpdating} onClick={onCycle}>
          {STATUS_CYCLE_LABEL[status]}
        </button>
      )}
    </div>
  );
}

const EXPORT_FOR_TAB: Record<TabKey, string> = {
  inquiries: "inquiries",
  import: "import-requests",
  clearing: "clearing-requests",
  hire: "hire-requests",
  contact: "contact-messages",
};

/** Downloads everything in the current list as a spreadsheet-ready CSV file. */
function ExportButton({ type, module }: { type: string; module: ModuleKey }) {
  const { can } = useAdminAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Personal data leaves the system here, so it needs "manage" on the module.
  if (!can(module, "manage")) return null;

  return (
    <div className="requests-export">
      <button
        type="button"
        className="btn btn-secondary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            await downloadExport(type);
          } catch (err) {
            setError(err instanceof ApiError ? err.message : "Export failed.");
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Preparing…" : "Export to spreadsheet (CSV)"}
      </button>
      {error && <span className="admin-error-text" role="alert">{error}</span>}
    </div>
  );
}

interface AdminRequestsProps {
  /** Show only these request types (each department page shows its own). */
  only?: TabKey[];
  title?: string;
}

export default function AdminRequests({ only, title = "Submitted requests" }: AdminRequestsProps = {}) {
  const { can } = useAdminAuth();
  const [searchParams] = useSearchParams();
  const tabs = TABS.filter((tab) => (!only || only.includes(tab.key)) && can(TAB_MODULE[tab.key]));
  const requested = searchParams.get("tab");
  const [chosenTab, setActiveTab] = useState<TabKey | null>(tabs.some((t) => t.key === requested) ? (requested as TabKey) : null);
  const activeTab = chosenTab && tabs.some((t) => t.key === chosenTab) ? chosenTab : tabs[0]?.key;

  if (!activeTab) {
    return (
      <div>
        <h1>{title}</h1>
        <div className="admin-empty-state">You don't have access to any request types. Ask your system administrator.</div>
      </div>
    );
  }

  return (
    <div>
      <h1>{title}</h1>
      <p className="admin-page-intro">
        Mark a submission Contacted once you've followed up, and Closed once it's resolved.
      </p>

      <ExportButton type={EXPORT_FOR_TAB[activeTab]} module={TAB_MODULE[activeTab]} />

      {tabs.length > 1 && (
      <div className="admin-nav admin-tabs" role="tablist" aria-label="Request type">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.key}
            className={
              activeTab === tab.key ? "admin-nav__link admin-nav__link--active" : "admin-nav__link"
            }
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      )}

      {activeTab === "inquiries" && <InquiriesTable />}
      {activeTab === "import" && <ImportRequestsTable />}
      {activeTab === "clearing" && <ClearingRequestsTable />}
      {activeTab === "hire" && <HireRequestsTable />}
      {activeTab === "contact" && <ContactMessagesTable />}
    </div>
  );
}

function InquiriesTable() {
  const { can } = useAdminAuth();
  const canManage = can("sales", "edit");
  const [refreshKey, setRefreshKey] = useState(0);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data, isLoading, error } = useAsyncData(
    () => adminApi.get<Inquiry[]>("/inquiries"),
    [refreshKey]
  );

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  async function handleCycle(row: Inquiry) {
    setActionError(null);
    setUpdatingId(row.id);
    try {
      await adminApi.patch(`/inquiries/${row.id}/status`, { status: STATUS_CYCLE[row.status] });
      refresh();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to update status.");
    } finally {
      setUpdatingId(null);
    }
  }

  if (isLoading) return <p className="text-muted">Loading…</p>;
  if (error) return <p className="text-muted" role="alert">Unable to load inquiries.</p>;
  if (!data || data.length === 0) return <div className="admin-empty-state">No inquiries yet.</div>;

  return (
    <div>
      {actionError && <p className="admin-error-text" role="alert">{actionError}</p>}
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Name</th>
              <th>Contact</th>
              <th>Vehicle</th>
              <th>Message</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.id}>
                <td>{formatDate(row.createdAt)}</td>
                <td>{row.fullName}</td>
                <td>
                  <ContactCell kind="inquiry" row={row} topic={row.vehicle ? `the ${row.vehicle.make} ${row.vehicle.model} (${row.vehicle.year})` : "your vehicle inquiry"} onContacted={refresh} />
                </td>
                <td>{row.vehicle ? `${row.vehicle.make} ${row.vehicle.model} (${row.vehicle.year})` : "—"}</td>
                <td>{row.message || "—"}</td>
                <td>
                  <StatusCell
                    status={row.status}
                    canManage={canManage}
                    isUpdating={updatingId === row.id}
                    onCycle={() => handleCycle(row)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ImportRequestsTable() {
  const { can } = useAdminAuth();
  const canManage = can("imports", "edit");
  const [refreshKey, setRefreshKey] = useState(0);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data, isLoading, error } = useAsyncData(
    () => adminApi.get<ImportRequestRecord[]>("/import-requests"),
    [refreshKey]
  );

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  async function handleCycle(row: ImportRequestRecord) {
    setActionError(null);
    setUpdatingId(row.id);
    try {
      await adminApi.patch(`/import-requests/${row.id}/status`, { status: STATUS_CYCLE[row.status] });
      refresh();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to update status.");
    } finally {
      setUpdatingId(null);
    }
  }

  if (isLoading) return <p className="text-muted">Loading…</p>;
  if (error) return <p className="text-muted" role="alert">Unable to load import requests.</p>;
  if (!data || data.length === 0) return <div className="admin-empty-state">No import requests yet.</div>;

  return (
    <div>
      {actionError && <p className="admin-error-text" role="alert">{actionError}</p>}
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Name</th>
              <th>Contact</th>
              <th>Preferred Vehicle</th>
              <th>Budget</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.id}>
                <td>{formatDate(row.createdAt)}</td>
                <td>{row.fullName}</td>
                <td>
                  <ContactCell kind="import" row={row} topic={`a ${row.preferredMake} ${row.preferredModel ?? ""}`.trim()} onContacted={refresh} />
                </td>
                <td>{row.preferredMake} {row.preferredModel ?? ""}</td>
                <td className="mono">{row.budget ? row.budget.toLocaleString() : "—"}</td>
                <td>
                  <StatusCell
                    status={row.status}
                    canManage={canManage}
                    isUpdating={updatingId === row.id}
                    onCycle={() => handleCycle(row)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ClearingRequestsTable() {
  const { can } = useAdminAuth();
  const canManage = can("imports", "edit");
  const [refreshKey, setRefreshKey] = useState(0);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data, isLoading, error } = useAsyncData(
    () => adminApi.get<ClearingRequestRecord[]>("/clearing-requests"),
    [refreshKey]
  );

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  async function handleCycle(row: ClearingRequestRecord) {
    setActionError(null);
    setUpdatingId(row.id);
    try {
      await adminApi.patch(`/clearing-requests/${row.id}/status`, { status: STATUS_CYCLE[row.status] });
      refresh();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to update status.");
    } finally {
      setUpdatingId(null);
    }
  }

  if (isLoading) return <p className="text-muted">Loading…</p>;
  if (error) return <p className="text-muted" role="alert">Unable to load clearing requests.</p>;
  if (!data || data.length === 0) return <div className="admin-empty-state">No clearing requests yet.</div>;

  return (
    <div>
      {actionError && <p className="admin-error-text" role="alert">{actionError}</p>}
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Name</th>
              <th>Contact</th>
              <th>Vehicle</th>
              <th>VIN</th>
              <th>Location</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.id}>
                <td>{formatDate(row.createdAt)}</td>
                <td>{row.fullName}</td>
                <td>
                  <ContactCell kind="clearing" row={row} topic={`your ${row.vehicleMake} (VIN ${row.vin})`} onContacted={refresh} />
                </td>
                <td>{row.vehicleMake}</td>
                <td className="mono">{row.vin}</td>
                <td>{row.currentLocation}</td>
                <td>
                  <StatusCell
                    status={row.status}
                    canManage={canManage}
                    isUpdating={updatingId === row.id}
                    onCycle={() => handleCycle(row)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function HireRequestsTable() {
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);
  const { data, isLoading, error } = useAsyncData(
    () => adminApi.get<HireRequestRecord[]>("/hire-requests"),
    [refreshKey]
  );
  if (isLoading) return <p className="text-muted">Loading…</p>;
  if (error) return <p className="text-muted" role="alert">Unable to load hire requests.</p>;
  if (!data || data.length === 0) return <div className="admin-empty-state">No hire requests yet.</div>;

  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Name</th>
            <th>Contact</th>
            <th>Vehicle</th>
            <th>Pickup</th>
            <th>Return</th>
            <th>Days</th>
            <th>Total</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.id}>
              <td>{formatDate(row.createdAt)}</td>
              <td>{row.fullName}</td>
              <td>
                  <ContactCell kind="hire" row={row} topic={row.vehicle ? `the ${row.vehicle.name}` : "your hire request"} onContacted={refresh} />
                </td>
              <td>{row.vehicle?.name ?? "—"}</td>
              <td>{new Date(row.pickupDate).toLocaleDateString()}</td>
              <td>{new Date(row.returnDate).toLocaleDateString()}</td>
              <td className="mono">{row.days}</td>
              <td className="mono"><Price amount={row.totalCost} currency={row.currency} layout="inline" /></td>
              <td>
                <span
                  className={`admin-badge ${
                    row.status === "confirmed"
                      ? "admin-badge--available"
                      : row.status === "cancelled" || row.status === "completed"
                        ? "admin-badge--sold"
                        : "admin-badge--reserved"
                  }`}
                >
                  {row.status}
                </span>
              </td>
              <td>
                <Link to={`/admin/bookings/${row.id}`} className="btn-ghost">
                  View / Manage
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ContactMessagesTable() {
  const { can } = useAdminAuth();
  const canManage = can("customers", "edit");
  const [refreshKey, setRefreshKey] = useState(0);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data, isLoading, error } = useAsyncData(
    () => adminApi.get<ContactMessageRecord[]>("/contact-messages"),
    [refreshKey]
  );

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  async function handleCycle(row: ContactMessageRecord) {
    setActionError(null);
    setUpdatingId(row.id);
    try {
      await adminApi.patch(`/contact-messages/${row.id}/status`, { status: STATUS_CYCLE[row.status] });
      refresh();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to update status.");
    } finally {
      setUpdatingId(null);
    }
  }

  if (isLoading) return <p className="text-muted">Loading…</p>;
  if (error) return <p className="text-muted" role="alert">Unable to load messages.</p>;
  if (!data || data.length === 0) return <div className="admin-empty-state">No messages yet.</div>;

  return (
    <div>
      {actionError && <p className="admin-error-text" role="alert">{actionError}</p>}
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Name</th>
              <th>Email</th>
              <th>Subject</th>
              <th>Message</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.id}>
                <td>{formatDate(row.createdAt)}</td>
                <td>{row.fullName}</td>
                <td>
                  <ContactCell kind="contact" row={row} topic={row.subject} onContacted={refresh} />
                </td>
                <td>{row.subject}</td>
                <td>{row.message}</td>
                <td>
                  <StatusCell
                    status={row.status}
                    canManage={canManage}
                    isUpdating={updatingId === row.id}
                    onCycle={() => handleCycle(row)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
