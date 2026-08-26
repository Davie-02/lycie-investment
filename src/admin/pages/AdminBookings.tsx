import { Link } from "react-router-dom";
import { useAsyncData } from "@/hooks/useAsyncData";
import { adminApi } from "../adminApi";
import { formatCurrency } from "@/utils/format";
import { resolveUploadUrl } from "@/utils/resolveUploadUrl";
import { getBookingPhase, type Booking } from "@/types/booking";
import "../components/AdminLayout.css";

const PHASE_LABELS: Record<string, string> = {
  upcoming: "Upcoming",
  active: "Active — vehicle out",
  overdue: "Overdue — follow up",
  completed: "Completed",
  cancelled: "Cancelled",
};

const PHASE_BADGE_CLASS: Record<string, string> = {
  upcoming: "admin-badge--reserved",
  active: "admin-badge--available",
  overdue: "admin-badge--overdue",
  completed: "admin-badge--sold",
  cancelled: "admin-badge--sold",
};

export default function AdminBookings() {
  const { data: bookings, isLoading, error } = useAsyncData(
    () => adminApi.get<Booking[]>("/hire-requests/bookings"),
    []
  );

  return (
    <div>
      <h1>Bookings</h1>
      <p className="admin-page-intro">
        Confirmed hire bookings that haven't finished yet. To confirm a new request, find it
        under Submitted Requests → Hire Requests first.
      </p>

      {isLoading && <p className="text-muted">Loading bookings…</p>}
      {error && <p className="text-muted" role="alert">Unable to load bookings.</p>}

      {bookings && bookings.length === 0 && (
        <div className="admin-empty-state">
          No active or upcoming bookings right now. Confirmed hire requests will show up here.
        </div>
      )}

      {bookings && bookings.length > 0 && (
        <div className="booking-grid">
          {bookings.map((booking) => {
            const phase = getBookingPhase(booking);
            return (
              <Link to={`/admin/bookings/${booking.id}`} className="booking-card" key={booking.id}>
                <img
                  src={resolveUploadUrl(booking.vehicle.image)}
                  alt={booking.vehicle.name}
                  className="booking-card__image"
                />
                <div className="booking-card__body">
                  <div className="booking-card__top">
                    <h3>{booking.vehicle.name}</h3>
                    <span className={`admin-badge ${PHASE_BADGE_CLASS[phase]}`}>
                      {PHASE_LABELS[phase]}
                    </span>
                  </div>
                  <p className="text-muted mono">
                    {new Date(booking.pickupDate).toLocaleDateString()} →{" "}
                    {new Date(booking.returnDate).toLocaleDateString()}
                  </p>
                  <p className="text-muted">{booking.fullName}</p>
                  <p className="mono booking-card__total">
                    {formatCurrency(booking.totalCost, booking.currency)}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
