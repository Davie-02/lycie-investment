/**
 * Imports & Clearing → Shipments: every vehicle on its way to a customer.
 * Open a shipment (it gets a tracking code), then post progress through the
 * stages with a message and photos. Each update is emailed to the customer
 * (and sent by WhatsApp when set up); they follow it on their account page or
 * at /track with the code.
 */
import { useEffect, useState, type FormEvent } from "react";
import { useAsyncData } from "@/hooks/useAsyncData";
import FormField from "@/components/forms/FormField";
import ShipmentTimeline from "@/components/common/ShipmentTimeline";
import { SHIPMENT_STAGES, stageIndex, stageLabel } from "@/utils/shipmentStages";
import { adminApi } from "../adminApi";
import { useAdminAuth } from "../context/AdminAuthContext";
import ImageUploader from "../components/ImageUploader";
import "../components/AdminLayout.css";
import "@/components/forms/FormField.css";

interface Shipment {
  id: string;
  title: string;
  kind: string;
  stage: string | null;
  status: string;
  trackingCode: string | null;
  eta: string | null;
  details: string | null;
  updatedAt: string;
  customer: { id: string; name: string; email: string; phone: string | null };
  updates: Array<{ id: string; stage: string | null; message: string; photos: string[]; createdAt: string }>;
}

export default function AdminShipments() {
  const { can } = useAdminAuth();
  const canEdit = can("imports", "edit");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const { data, isLoading } = useAsyncData(() => adminApi.get<Shipment[]>(`/shipments${search ? `?q=${encodeURIComponent(search)}` : ""}`), [search, refresh]);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const open = data?.find((s) => s.id === openId);

  return (
    <div>
      <div className="ws-hero">
        <div>
          <h1>Shipments</h1>
          <p>Track each vehicle from purchase to delivery. Customers are notified of every update.</p>
        </div>
        {canEdit && (
          <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
            + New shipment
          </button>
        )}
      </div>

      {creating && (
        <NewShipment
          onDone={(id) => {
            setCreating(false);
            setRefresh((n) => n + 1);
            if (id) setOpenId(id);
          }}
        />
      )}

      <div className="ws-toolbar">
        <input type="search" placeholder="Search customer, vehicle or tracking code…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search shipments" />
      </div>

      {isLoading && !data && <p className="text-muted">Loading…</p>}
      {data && data.length === 0 && <div className="admin-empty-state">No shipments yet.</div>}
      {data && data.length > 0 && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Vehicle</th>
                <th>Customer</th>
                <th>Stage</th>
                <th>Expected</th>
                <th>Tracking</th>
              </tr>
            </thead>
            <tbody>
              {data.map((shipment) => (
                <tr key={shipment.id} onClick={() => setOpenId(shipment.id === openId ? null : shipment.id)} style={{ cursor: "pointer" }}>
                  <td>
                    <strong>{shipment.title}</strong>
                    <div className="text-muted">{shipment.kind === "clearing" ? "Clearing" : "Import"}</div>
                  </td>
                  <td>
                    {shipment.customer.name}
                    <div className="text-muted">{shipment.customer.email}</div>
                  </td>
                  <td>
                    <span className={shipment.stage === "delivered" ? "ws-chip ws-chip--good" : "ws-chip"}>{stageLabel(shipment.stage)}</span>
                    <div className="text-muted">
                      step {stageIndex(shipment.stage) + 1} of {SHIPMENT_STAGES.length}
                    </div>
                  </td>
                  <td>{shipment.eta ? new Date(shipment.eta).toLocaleDateString() : "—"}</td>
                  <td className="mono">{shipment.trackingCode}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open && (
        <section className="form-card" style={{ marginTop: "1.5rem" }}>
          <div className="ws-section__head">
            <h2>
              {open.title} <span className="text-muted">· {open.trackingCode}</span>
            </h2>
            <button type="button" className="btn-ghost" onClick={() => setOpenId(null)}>
              Close
            </button>
          </div>
          <ShipmentTimeline stage={open.stage} eta={open.eta} updates={open.updates.slice().reverse()} />
          {canEdit && <PostProgress shipment={open} onPosted={() => setRefresh((n) => n + 1)} />}
        </section>
      )}
    </div>
  );
}

function NewShipment({ onDone }: { onDone: (id?: string) => void }) {
  const [lookup, setLookup] = useState("");
  const [matches, setMatches] = useState<Array<{ id: string; name: string; email: string }>>([]);
  const [customer, setCustomer] = useState<{ id: string; name: string; email: string } | null>(null);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState("import");
  const [eta, setEta] = useState("");
  const [details, setDetails] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (customer || lookup.trim().length < 2) {
      setMatches([]);
      return;
    }
    const timer = setTimeout(() => {
      adminApi
        .get<Array<{ id: string; name: string; email: string }>>(`/customer-lookup?q=${encodeURIComponent(lookup.trim())}`)
        .then(setMatches)
        .catch(() => setMatches([]));
    }, 250);
    return () => clearTimeout(timer);
  }, [lookup, customer]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!customer) {
      setError("Choose the customer (they need an account on the website).");
      return;
    }
    try {
      const created = await adminApi.post<{ id: string }>("/shipments", { customerId: customer.id, title, kind, eta: eta || undefined, details: details || undefined });
      onDone(created.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create.");
    }
  }

  return (
    <form className="form-card" onSubmit={submit} style={{ marginBottom: "1.5rem" }}>
      <h2 style={{ marginTop: 0 }}>New shipment</h2>
      {error && <p className="form-status form-status--error" role="alert">{error}</p>}
      <div className="form-grid form-grid--2col">
        <div>
          {customer ? (
            <p>
              Customer: <strong>{customer.name}</strong> ({customer.email}){" "}
              <button type="button" className="link-button" onClick={() => setCustomer(null)}>
                change
              </button>
            </p>
          ) : (
            <>
              <FormField id="ship-customer" label="Customer (name or email)" value={lookup} onChange={(e) => setLookup(e.target.value)} autoComplete="off" />
              {matches.length > 0 && (
                <ul className="admin-search__results" style={{ position: "static" }}>
                  {matches.map((match) => (
                    <li key={match.id}>
                      <button type="button" className="link-button" onClick={() => setCustomer(match)}>
                        {match.name} — {match.email}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
        <FormField id="ship-title" label="Vehicle" placeholder="e.g. 2019 Toyota Hilux, white" required value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} />
        <FormField as="select" id="ship-kind" label="Type" value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="import">Import</option>
          <option value="clearing">Clearing</option>
        </FormField>
        <FormField id="ship-eta" label="Expected arrival" type="date" value={eta} onChange={(e) => setEta(e.target.value)} />
        <FormField as="textarea" id="ship-details" label="Notes (seen by the customer)" wrapperClassName="form-grid__full" value={details} onChange={(e) => setDetails(e.target.value)} maxLength={3000} />
      </div>
      <div className="form-actions">
        <button className="btn btn-primary" type="submit">
          Create and get tracking code
        </button>
        <button className="btn-ghost" type="button" onClick={() => onDone()}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function PostProgress({ shipment, onPosted }: { shipment: Shipment; onPosted: () => void }) {
  const next = SHIPMENT_STAGES[Math.min(stageIndex(shipment.stage) + 1, SHIPMENT_STAGES.length - 1)].key;
  const [stage, setStage] = useState<string>(next);
  const [message, setMessage] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [status, setStatus] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      await adminApi.post(`/shipments/${shipment.id}/progress`, { stage, message, photos });
      setStatus(`Update posted — ${shipment.customer.name} has been notified.`);
      setMessage("");
      setPhotos([]);
      onPosted();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Couldn't post.");
    }
  }

  return (
    <form onSubmit={submit} style={{ marginTop: "1.5rem" }}>
      <h3>Post an update</h3>
      {status && <p className="form-status form-status--info" role="status">{status}</p>}
      <div className="form-grid form-grid--2col">
        <FormField as="select" id="progress-stage" label="Stage reached" value={stage} onChange={(e) => setStage(e.target.value)}>
          {SHIPMENT_STAGES.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </FormField>
        <div />
        <FormField as="textarea" id="progress-message" label="Message to the customer" required wrapperClassName="form-grid__full" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={2000} placeholder="e.g. The vehicle arrived at Dar es Salaam port this morning." />
      </div>
      <p className="text-muted">Photos (optional, up to 8)</p>
      <ImageUploader images={photos} onChange={(next) => setPhotos(next.slice(0, 8))} />
      <div className="form-actions">
        <button className="btn btn-primary" type="submit" disabled={message.trim().length < 2}>
          Post update & notify customer
        </button>
      </div>
    </form>
  );
}
