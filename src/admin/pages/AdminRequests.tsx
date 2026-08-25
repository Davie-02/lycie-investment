import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { useAsyncData } from "@/hooks/useAsyncData";
import { adminApi } from "../adminApi";
import { useAdminAuth } from "../context/AdminAuthContext";
import { ApiError } from "@/services/http";
import "../components/AdminLayout.css";

type TabKey = "inquiries" | "import" | "clearing" | "hire" | "contact";
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
  fullName: string;
  email: string;
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

export default function AdminRequests() {
  const [activeTab, setActiveTab] = useState<TabKey>("inquiries");

  return (
    <div>
      <h1>Submitted Requests</h1>
      <p className="admin-page-intro">
        Mark a submission Contacted once you've followed up, and Closed once it's resolved.
      </p>

      <div className="admin-nav admin-tabs" role="tablist" aria-label="Request type">
        {TABS.map((tab) => (
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

      {activeTab === "inquiries" && <InquiriesTable />}
      {activeTab === "import" && <ImportRequestsTable />}
      {activeTab === "clearing" && <ClearingRequestsTable />}
      {activeTab === "hire" && <HireRequestsTable />}
      {activeTab === "contact" && <ContactMessagesTable />}
    </div>
  );
}

function InquiriesTable() {
  const { currentUser } = useAdminAuth();
  const canManage = currentUser?.role === "OWNER" || currentUser?.role === "MANAGER";
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
                <td>{row.phone} · {row.email}</td>
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
  const { currentUser } = useAdminAuth();
  const canManage = currentUser?.role === "OWNER" || currentUser?.role === "MANAGER";
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
                <td>{row.phone} · {row.email}</td>
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
  const { currentUser } = useAdminAuth();
  const canManage = currentUser?.role === "OWNER" || currentUser?.role === "MANAGER";
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
                <td>{row.phone} · {row.email}</td>
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
  const { data, isLoading, error } = useAsyncData(
    () => adminApi.get<HireRequestRecord[]>("/hire-requests"),
    []
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
              <td>{row.phone} · {row.email}</td>
              <td>{row.vehicle?.name ?? "—"}</td>
              <td>{new Date(row.pickupDate).toLocaleDateString()}</td>
              <td>{new Date(row.returnDate).toLocaleDateString()}</td>
              <td className="mono">{row.days}</td>
              <td className="mono">{row.currency} {row.totalCost.toLocaleString()}</td>
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
  const { currentUser } = useAdminAuth();
  const canManage = currentUser?.role === "OWNER" || currentUser?.role === "MANAGER";
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
                <td>{row.email}</td>
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
