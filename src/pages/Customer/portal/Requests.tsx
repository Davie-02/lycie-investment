/**
 * My requests: everything the customer sent while signed in (vehicle
 * inquiries, hire bookings, imports, clearing, contact messages) with its
 * status, filterable by type. Pending hire bookings can be cancelled here.
 */
import { useState } from "react";
import Price from "@/components/common/Price";
import { cancelHireRequest, type CustomerRequestSummary } from "@/services/customer.service";
import { ApiError } from "@/services/http";
import { usePortal } from "./PortalContext";
import PortalHeading from "./PortalHeading";
import { REQUEST_TYPE_LABELS, statusTone } from "./shared";

type Filter = "all" | CustomerRequestSummary["type"];

export default function Requests() {
  const { requests, setRequests, isLoading } = usePortal();
  const [filter, setFilter] = useState<Filter>("all");
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (isLoading) return <p className="text-muted">Loading…</p>;
  const types = [...new Set(requests.map((r) => r.type))];
  const shown = filter === "all" ? requests : requests.filter((r) => r.type === filter);

  async function cancel(id: string) {
    setError(null);
    setCancellingId(id);
    try {
      await cancelHireRequest(id);
      setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status: "cancelled" } : r)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to cancel this request.");
    } finally {
      setCancellingId(null);
    }
  }

  return (
    <>
      <PortalHeading title="My requests" intro="Inquiries, bookings and requests you've sent us while signed in, and where each one stands." />
      {requests.length === 0 ? (
        <div className="portal-card">
          <p className="text-muted" style={{ margin: 0 }}>
            Nothing here yet. Vehicle inquiries, hire bookings, import and clearing requests and contact messages you send while signed in
            will show up here.
          </p>
        </div>
      ) : (
        <>
          {types.length > 1 && (
            <div className="portal-filters" role="group" aria-label="Show">
              {(["all", ...types] as Filter[]).map((key) => (
                <button key={key} type="button" className={filter === key ? "portal-filter portal-filter--on" : "portal-filter"} onClick={() => setFilter(key)}>
                  {key === "all" ? "All" : REQUEST_TYPE_LABELS[key]}
                </button>
              ))}
            </div>
          )}
          {error && <p className="form-status form-status--error" role="alert">{error}</p>}
          <div className="customer-account__table-wrap customer-account">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Details</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {shown.map((request) => (
                  <tr key={`${request.type}-${request.id}`}>
                    <td>{new Date(request.createdAt).toLocaleDateString()}</td>
                    <td>{REQUEST_TYPE_LABELS[request.type]}</td>
                    <td>
                      {request.summary}
                      {request.hireDetails && (
                        <span className="text-muted">
                          {" "}
                          ({new Date(request.hireDetails.pickupDate).toLocaleDateString()} → {new Date(request.hireDetails.returnDate).toLocaleDateString()},{" "}
                          {request.hireDetails.days} day{request.hireDetails.days === 1 ? "" : "s"},{" "}
                          <Price amount={request.hireDetails.totalCost} currency={request.hireDetails.currency} layout="inline" />)
                        </span>
                      )}
                    </td>
                    <td>
                      <span className={`portal-pill ${statusTone(request.status)}`}>{request.status.replace("_", " ")}</span>
                    </td>
                    <td>
                      {request.type === "hire" && request.status === "pending" && (
                        <button type="button" className="btn-ghost" onClick={() => void cancel(request.id)} disabled={cancellingId === request.id}>
                          {cancellingId === request.id ? "Cancelling…" : "Cancel"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
