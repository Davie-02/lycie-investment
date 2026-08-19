import { useState } from "react";
import { useAsyncData } from "@/hooks/useAsyncData";
import { adminApi } from "../adminApi";
import "../components/AdminLayout.css";

type TabKey = "inquiries" | "import" | "clearing" | "hire" | "contact";

interface Inquiry {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  message: string | null;
  vehicle: { make: string; model: string; year: number } | null;
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
  createdAt: string;
}

interface ContactMessageRecord {
  id: string;
  fullName: string;
  email: string;
  subject: string;
  message: string;
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

export default function AdminRequests() {
  const [activeTab, setActiveTab] = useState<TabKey>("inquiries");

  return (
    <div>
      <h1>Submitted Requests</h1>
      <p className="admin-page-intro">
        Read-only. To follow up, use the contact details shown for each submission.
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
  const { data, isLoading, error } = useAsyncData(() => adminApi.get<Inquiry[]>("/inquiries"), []);
  if (isLoading) return <p className="text-muted">Loading…</p>;
  if (error) return <p className="text-muted" role="alert">Unable to load inquiries.</p>;
  if (!data || data.length === 0) return <div className="admin-empty-state">No inquiries yet.</div>;

  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Name</th>
            <th>Contact</th>
            <th>Vehicle</th>
            <th>Message</th>
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ImportRequestsTable() {
  const { data, isLoading, error } = useAsyncData(
    () => adminApi.get<ImportRequestRecord[]>("/import-requests"),
    []
  );
  if (isLoading) return <p className="text-muted">Loading…</p>;
  if (error) return <p className="text-muted" role="alert">Unable to load import requests.</p>;
  if (!data || data.length === 0) return <div className="admin-empty-state">No import requests yet.</div>;

  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Name</th>
            <th>Contact</th>
            <th>Preferred Vehicle</th>
            <th>Budget</th>
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ClearingRequestsTable() {
  const { data, isLoading, error } = useAsyncData(
    () => adminApi.get<ClearingRequestRecord[]>("/clearing-requests"),
    []
  );
  if (isLoading) return <p className="text-muted">Loading…</p>;
  if (error) return <p className="text-muted" role="alert">Unable to load clearing requests.</p>;
  if (!data || data.length === 0) return <div className="admin-empty-state">No clearing requests yet.</div>;

  return (
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
            </tr>
          ))}
        </tbody>
      </table>
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ContactMessagesTable() {
  const { data, isLoading, error } = useAsyncData(
    () => adminApi.get<ContactMessageRecord[]>("/contact-messages"),
    []
  );
  if (isLoading) return <p className="text-muted">Loading…</p>;
  if (error) return <p className="text-muted" role="alert">Unable to load messages.</p>;
  if (!data || data.length === 0) return <div className="admin-empty-state">No messages yet.</div>;

  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Name</th>
            <th>Email</th>
            <th>Subject</th>
            <th>Message</th>
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
