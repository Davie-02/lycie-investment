import ContentManager from "../components/ContentManager";
import VehicleForm from "../components/VehicleForm";
import { adminApi } from "../adminApi";
import { useAdminAuth } from "../context/AdminAuthContext";
import { formatCurrency, formatMileage } from "@/utils/format";
import type { Vehicle } from "@/types/vehicle";

export default function AdminVehicles() {
  const { currentUser } = useAdminAuth();
  const canEdit = currentUser?.role === "OWNER" || currentUser?.role === "MANAGER";

  return (
    <ContentManager<Vehicle>
      type="vehicles"
      title="Vehicles"
      noun="vehicle"
      intro="Unpublish or archive a vehicle instead of deleting it — when new stock of the same kind arrives, Duplicate it as a fresh draft and update the details."
      canEdit={canEdit}
      describe={(v) => `${v.make} ${v.model} (${v.year})`}
      isLive={(v) => v.isPublished !== false && !v.archivedAt}
      isArchived={(v) => Boolean(v.archivedAt)}
      columns={[
        {
          header: "Vehicle",
          render: (v) => (
            <>
              {v.isFeatured && <span title="Pinned first on the site" aria-label="Pinned">📌 </span>}
              {v.make} {v.model} ({v.year})
            </>
          ),
        },
        { header: "Price", render: (v) => <span className="mono">{formatCurrency(v.price, v.currency)}</span> },
        { header: "Mileage", render: (v) => <span className="mono">{formatMileage(v.mileageKm)}</span> },
        { header: "Stock", render: (v) => <span className={`admin-badge admin-badge--${v.status}`}>{v.status}</span> },
      ]}
      extraActions={(v, refresh) =>
        v.archivedAt ? null : (
          <>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => adminApi.patch(`/vehicles/${v.id}`, { status: v.status === "sold" ? "available" : "sold" }).then(refresh)}
            >
              {v.status === "sold" ? "Mark available" : "Mark sold"}
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => adminApi.patch(`/vehicles/${v.id}`, { isFeatured: !v.isFeatured }).then(refresh)}
              title="Pinned vehicles appear first in the carousel and lists"
            >
              {v.isFeatured ? "Unpin" : "Pin"}
            </button>
          </>
        )
      }
      renderForm={(item, onDone, onCancel) => <VehicleForm vehicle={item} onSaved={onDone} onCancel={onCancel} />}
    />
  );
}
