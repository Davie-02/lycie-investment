import { useMemo, useState } from "react";
import Seo from "@/components/common/Seo";
import VehicleCard from "@/components/vehicles/VehicleCard";
import VehicleFiltersPanel from "@/components/vehicles/VehicleFiltersPanel";
import Reveal from "@/components/common/Reveal";
import { useAsyncData } from "@/hooks/useAsyncData";
import { getVehicles } from "@/services/vehicles.service";
import { applyFilters, EMPTY_FILTERS, type VehicleFilters } from "@/utils/vehicleFilters";

// Caps the stagger at 6 cards' worth of delay so a long results grid
// doesn't make the last few cards wait an oddly long time to appear.
const STAGGER_STEP_MS = 60;
const STAGGER_CAP = 6;

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
        description="Browse vehicles available from Lycie Investments, with filters for make, price, fuel type and more."
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
            {filteredVehicles.map((vehicle, index) => (
              <Reveal key={vehicle.id} delayMs={Math.min(index, STAGGER_CAP) * STAGGER_STEP_MS}>
                <VehicleCard vehicle={vehicle} />
              </Reveal>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
