import { useCallback, useState } from "react";
import "../components/AdminLayout.css";
import { useAsyncData } from "@/hooks/useAsyncData";
import { adminApi } from "../adminApi";
import { getVehicles } from "@/services/vehicles.service";
import { formatCurrency, formatMileage } from "@/utils/format";
import VehicleForm from "../components/VehicleForm";
import type { Vehicle } from "@/types/vehicle";
import { ApiError } from "@/services/http";
import { useAdminAuth } from "../context/AdminAuthContext";

type View = { mode: "list" } | { mode: "create" } | { mode: "edit"; vehicle: Vehicle };

export default function AdminVehicles() {
  const { currentUser } = useAdminAuth();
  const canEdit = currentUser?.role === "OWNER" || currentUser?.role === "MANAGER";
  const [view, setView] = useState<View>({ mode: "list" });
  const [refreshKey, setRefreshKey] = useState(0);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const { data: vehicles, isLoading, error } = useAsyncData(
    () => getVehicles(),
    [refreshKey]
  );

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  async function handleDelete(vehicle: Vehicle) {
    if (!window.confirm(`Delete ${vehicle.make} ${vehicle.model} (${vehicle.year})? This cannot be undone.`)) {
      return;
    }
    setDeleteError(null);
    try {
      await adminApi.delete(`/vehicles/${vehicle.id}`);
      refresh();
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : "Failed to delete vehicle.");
    }
  }

  if (view.mode === "create") {
    return (
      <VehicleForm
        vehicle={null}
        onSaved={() => {
          setView({ mode: "list" });
          refresh();
        }}
        onCancel={() => setView({ mode: "list" })}
      />
    );
  }

  if (view.mode === "edit") {
    return (
      <VehicleForm
        vehicle={view.vehicle}
        onSaved={() => {
          setView({ mode: "list" });
          refresh();
        }}
        onCancel={() => setView({ mode: "list" })}
      />
    );
  }

  return (
    <div>
      <div className="admin-toolbar">
        <h1>Vehicles</h1>
        {canEdit && (
          <button type="button" className="btn btn-primary" onClick={() => setView({ mode: "create" })}>
            Add Vehicle
          </button>
        )}
      </div>

      {deleteError && <p className="admin-error-text" role="alert">{deleteError}</p>}
      {isLoading && <p className="text-muted">Loading vehicles…</p>}
      {error && <p className="text-muted" role="alert">Unable to load vehicles.</p>}

      {vehicles && vehicles.length === 0 && (
        <div className="admin-empty-state">No vehicles yet. Add the first one to get started.</div>
      )}

      {vehicles && vehicles.length > 0 && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Vehicle</th>
                <th>Price</th>
                <th>Mileage</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.map((vehicle) => (
                <tr key={vehicle.id}>
                  <td>
                    {vehicle.make} {vehicle.model} ({vehicle.year})
                  </td>
                  <td className="mono">{formatCurrency(vehicle.price, vehicle.currency)}</td>
                  <td className="mono">{formatMileage(vehicle.mileageKm)}</td>
                  <td>
                    <span className={`admin-badge admin-badge--${vehicle.status}`}>{vehicle.status}</span>
                  </td>
                  <td>
                    {canEdit ? (
                      <div className="admin-table__actions">
                        <button type="button" className="btn-ghost" onClick={() => setView({ mode: "edit", vehicle })}>
                          Edit
                        </button>
                        <button type="button" className="btn-ghost" onClick={() => handleDelete(vehicle)}>
                          Delete
                        </button>
                      </div>
                    ) : (
                      <span className="text-muted">View only</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
