import ContentManager from "../components/ContentManager";
import HireVehicleForm from "../components/HireVehicleForm";
import { useAdminAuth } from "../context/AdminAuthContext";
import { formatCurrency } from "@/utils/format";
import type { HireVehicle } from "@/types/vehicle";

export default function AdminHireVehicles() {
  const { currentUser } = useAdminAuth();
  const canEdit = currentUser?.role === "OWNER" || currentUser?.role === "MANAGER";

  return (
    <ContentManager<HireVehicle>
      type="hire-vehicles"
      title="Hire Vehicles"
      noun="hire vehicle"
      canEdit={canEdit}
      describe={(v) => v.name}
      isLive={(v) => v.isPublished !== false && !v.archivedAt}
      isArchived={(v) => Boolean(v.archivedAt)}
      columns={[
        { header: "Vehicle", render: (v) => v.name },
        { header: "Daily Rate", render: (v) => <span className="mono">{formatCurrency(v.dailyRate, v.currency)}</span> },
        { header: "Seats", render: (v) => <span className="mono">{v.seats}</span> },
        {
          header: "Availability",
          render: (v) => (
            <span className={`admin-badge admin-badge--${v.available ? "available" : "booked"}`}>
              {v.available ? "Available" : "Booked"}
            </span>
          ),
        },
      ]}
      renderForm={(item, onDone, onCancel) => <HireVehicleForm vehicle={item} onSaved={onDone} onCancel={onCancel} />}
    />
  );
}
