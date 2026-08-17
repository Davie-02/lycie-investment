import { useMemo, useState } from "react";
import Seo from "@/components/common/Seo";
import VehicleCard from "@/components/vehicles/VehicleCard";
import VehicleFiltersPanel from "@/components/vehicles/VehicleFiltersPanel";
import { useAsyncData } from "@/hooks/useAsyncData";
import { getVehicles } from "@/services/vehicles.service";
import { applyFilters, EMPTY_FILTERS, type VehicleFilters } from "@/utils/vehicleFilters";

export default function Vehicles() {
  const { data: vehicles, isLoading, error } = useAsyncData(() => getVehicles(), []);
  const [filters, setFilters] = useState<VehicleFilters>(EMPTY_FILTERS);

  const filteredVehicles = useMemo(() => {
    if (!vehicles) return [];
    return applyFilters(vehicles, filters);
  }, [vehicles, filters]);

  return (
    <>
      <Seo
        title="Vehicles"
        description="Browse vehicles available from Lycie Investment, with filters for make, price, fuel type and more."
      />

      <section className="service-hero">
        <div className="container">
          <h1>Browse available vehicles</h1>
          <p>Filter by make, body type, fuel, transmission, status and price.</p>
        </div>
      </section>

      <section className="section container">
        {vehicles && (
          <VehicleFiltersPanel
            vehicles={vehicles}
            filters={filters}
            onChange={setFilters}
            onReset={() => setFilters(EMPTY_FILTERS)}
          />
        )}

        {isLoading && <p className="text-muted">Loading vehicles…</p>}

        {error && (
          <p className="text-muted" role="alert">
            Unable to load vehicles. Please try again.
          </p>
        )}

        {vehicles && filteredVehicles.length === 0 && (
          <p className="text-muted">No vehicles match your filters. Try adjusting them.</p>
        )}

        {filteredVehicles.length > 0 && (
          <div className="vehicle-grid">
            {filteredVehicles.map((vehicle) => (
              <VehicleCard key={vehicle.id} vehicle={vehicle} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
