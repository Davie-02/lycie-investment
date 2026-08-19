import { useCallback, useState } from "react";
import "../components/AdminLayout.css";
import { useAsyncData } from "@/hooks/useAsyncData";
import { adminApi } from "../adminApi";
import { getHireVehicles } from "@/services/vehicles.service";
import { formatCurrency } from "@/utils/format";
import HireVehicleForm from "../components/HireVehicleForm";
import type { HireVehicle } from "@/types/vehicle";
import { ApiError } from "@/services/http";
import { useAdminAuth } from "../context/AdminAuthContext";

type View = { mode: "list" } | { mode: "create" } | { mode: "edit"; vehicle: HireVehicle };

export default function AdminHireVehicles() {
  const { currentUser } = useAdminAuth();
  const canEdit = currentUser?.role === "OWNER" || currentUser?.role === "MANAGER";
  const [view, setView] = useState<View>({ mode: "list" });
  const [refreshKey, setRefreshKey] = useState(0);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const { data: vehicles, isLoading, error } = useAsyncData(
    () => getHireVehicles(),
    [refreshKey]
  );

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  async function handleDelete(vehicle: HireVehicle) {
    if (!window.confirm(`Delete ${vehicle.name}? This cannot be undone.`)) {
      return;
    }
    setDeleteError(null);
    try {
      await adminApi.delete(`/hire-vehicles/${vehicle.id}`);
      refresh();
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : "Failed to delete hire vehicle.");
    }
  }

  if (view.mode === "create") {
    return (
      <HireVehicleForm
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
      <HireVehicleForm
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
        <h1>Hire Vehicles</h1>
        {canEdit && (
          <button type="button" className="btn btn-primary" onClick={() => setView({ mode: "create" })}>
            Add Hire Vehicle
          </button>
        )}
      </div>

      {deleteError && <p className="admin-error-text" role="alert">{deleteError}</p>}
      {isLoading && <p className="text-muted">Loading hire vehicles…</p>}
      {error && <p className="text-muted" role="alert">Unable to load hire vehicles.</p>}

      {vehicles && vehicles.length === 0 && (
        <div className="admin-empty-state">No hire vehicles yet. Add the first one to get started.</div>
      )}

      {vehicles && vehicles.length > 0 && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Vehicle</th>
                <th>Daily Rate</th>
                <th>Seats</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.map((vehicle) => (
                <tr key={vehicle.id}>
                  <td>{vehicle.name}</td>
                  <td className="mono">{formatCurrency(vehicle.dailyRate, vehicle.currency)}</td>
                  <td className="mono">{vehicle.seats}</td>
                  <td>
                    <span className={`admin-badge admin-badge--${vehicle.available ? "available" : "booked"}`}>
                      {vehicle.available ? "available" : "booked"}
                    </span>
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
