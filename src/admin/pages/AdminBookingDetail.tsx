import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAsyncData } from "@/hooks/useAsyncData";
import { adminApi } from "../adminApi";
import { useAdminAuth } from "../context/AdminAuthContext";
import { useCountdown } from "../hooks/useCountdown";
import { formatCurrency } from "@/utils/format";
import { getBookingPhase, type Booking } from "@/types/booking";
import { ApiError } from "@/services/http";
import "../components/AdminLayout.css";

function CountdownDisplay({ target, label, countingUp }: { target: Date; label: string; countingUp?: boolean }) {
  const countdown = useCountdown(target);
  return (
    <div className={countingUp ? "booking-countdown booking-countdown--overdue" : "booking-countdown"}>
      <p className="booking-countdown__label">{label}</p>
      <div className="booking-countdown__digits">
        <CountdownUnit value={countdown.days} label="days" />
        <CountdownUnit value={countdown.hours} label="hrs" />
        <CountdownUnit value={countdown.minutes} label="min" />
        <CountdownUnit value={countdown.seconds} label="sec" />
      </div>
    </div>
  );
}

function CountdownUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="booking-countdown__unit">
      <span className="mono booking-countdown__value">{String(value).padStart(2, "0")}</span>
      <span className="booking-countdown__unit-label">{label}</span>
    </div>
  );
}

const STATUS_BADGE_CLASS: Record<string, string> = {
  pending: "admin-badge--reserved",
  confirmed: "admin-badge--available",
  cancelled: "admin-badge--sold",
  completed: "admin-badge--sold",
};

export default function AdminBookingDetail() {
  const { id } = useParams<{ id: string }>();
  const { currentUser } = useAdminAuth();
  const canManage = currentUser?.role === "OWNER" || currentUser?.role === "MANAGER";

  const [refreshKey, setRefreshKey] = useState(0);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const { data: booking, isLoading, error } = useAsyncData(
    () => adminApi.get<Booking>(`/hire-requests/${id}`),
    [id, refreshKey]
  );

  async function handleStatusChange(status: "confirmed" | "cancelled" | "pending" | "completed") {
    if (!booking) return;
    setActionError(null);
    setIsUpdating(true);
    try {
      await adminApi.patch(`/hire-requests/${booking.id}/status`, { status });
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to update booking status.");
    } finally {
      setIsUpdating(false);
    }
  }

  if (isLoading) return <p className="text-muted">Loading booking…</p>;
  if (error || !booking) {
    return (
      <div>
        <p className="text-muted" role="alert">Unable to load this booking.</p>
        <Link to="/admin/bookings" className="btn-ghost">← Back to Bookings</Link>
      </div>
    );
  }

  const phase = getBookingPhase(booking);
  const pickupDate = new Date(booking.pickupDate);
  const returnDate = new Date(booking.returnDate);

  return (
    <div>
      <Link to="/admin/bookings" className="btn-ghost booking-detail__back">← Back to Bookings</Link>

      <div className="admin-toolbar">
        <h1>{booking.vehicle.name}</h1>
        <span className={`admin-badge ${STATUS_BADGE_CLASS[booking.status]}`}>{booking.status}</span>
      </div>

      {actionError && <p className="admin-error-text" role="alert">{actionError}</p>}

      {phase === "upcoming" && <CountdownDisplay target={pickupDate} label="Time until pickup" />}
      {phase === "active" && <CountdownDisplay target={returnDate} label="Time remaining on hire" />}
      {phase === "overdue" && (
        <CountdownDisplay target={returnDate} label="Overdue by" countingUp />
      )}
      {phase === "completed" && (
        <div className="booking-countdown booking-countdown--completed">
          <p className="booking-countdown__label">This hire has been completed and the vehicle returned.</p>
        </div>
      )}
      {phase === "cancelled" && (
        <div className="booking-countdown booking-countdown--completed">
          <p className="booking-countdown__label">This booking was cancelled.</p>
        </div>
      )}

      <div className="booking-detail__grid">
        <div className="form-card">
          <h2>Customer</h2>
          <dl className="vehicle-specs">
            <div className="vehicle-specs__row"><dt>Name</dt><dd>{booking.fullName}</dd></div>
            <div className="vehicle-specs__row"><dt>Phone</dt><dd className="mono">{booking.phone}</dd></div>
            <div className="vehicle-specs__row"><dt>Email</dt><dd className="mono">{booking.email}</dd></div>
            <div className="vehicle-specs__row"><dt>Pickup Location</dt><dd>{booking.pickupLocation}</dd></div>
          </dl>
        </div>

        <div className="form-card">
          <h2>Booking</h2>
          <dl className="vehicle-specs">
            <div className="vehicle-specs__row"><dt>Pickup</dt><dd className="mono">{pickupDate.toLocaleString()}</dd></div>
            <div className="vehicle-specs__row"><dt>Return</dt><dd className="mono">{returnDate.toLocaleString()}</dd></div>
            <div className="vehicle-specs__row"><dt>Days</dt><dd className="mono">{booking.days}</dd></div>
            <div className="vehicle-specs__row"><dt>Total</dt><dd className="mono">{formatCurrency(booking.totalCost, booking.currency)}</dd></div>
          </dl>
          {booking.additionalRequirements && (
            <p className="text-muted booking-detail__notes">
              <strong>Notes:</strong> {booking.additionalRequirements}
            </p>
          )}
        </div>
      </div>

      {canManage && (
        <div className="form-card booking-detail__actions">
          <h2>Update Status</h2>
          <div className="admin-table__actions">
            {booking.status !== "confirmed" && (
              <button
                type="button"
                className="btn btn-primary"
                disabled={isUpdating}
                onClick={() => handleStatusChange("confirmed")}
              >
                Confirm Booking
              </button>
            )}
            {booking.status === "confirmed" && (phase === "active" || phase === "overdue") && (
              <button
                type="button"
                className="btn btn-primary"
                disabled={isUpdating}
                onClick={() => handleStatusChange("completed")}
              >
                Mark as Returned
              </button>
            )}
            {booking.status !== "cancelled" && (
              <button
                type="button"
                className="btn-ghost"
                disabled={isUpdating}
                onClick={() => handleStatusChange("cancelled")}
              >
                Cancel Booking
              </button>
            )}
            {booking.status !== "pending" && (
              <button
                type="button"
                className="btn-ghost"
                disabled={isUpdating}
                onClick={() => handleStatusChange("pending")}
              >
                Revert to Pending
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
