/**
 * Admin → Hire Vehicles. Plugs the hire vehicle form and endpoints into the shared
 * ContentManager list.
 */
import ContentManager from "../components/ContentManager";
import HireVehicleForm from "../components/HireVehicleForm";
import { useAdminAuth } from "../context/AdminAuthContext";

import type { HireVehicle } from "@/types/vehicle";
import Price from "@/components/common/Price";

export default function AdminHireVehicles() {
  const { can } = useAdminAuth();
  const canEdit = can("hire", "edit");

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
        { header: "Daily Rate", render: (v) => <span className="mono"><Price amount={v.dailyRate} currency={v.currency} layout="inline" /></span> },
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
