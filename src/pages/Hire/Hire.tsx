import { useState } from "react";
import Seo from "@/components/common/Seo";
import HireVehicleCard from "@/components/vehicles/HireVehicleCard";
import HireRequestForm from "@/components/forms/HireRequestForm";
import { useAsyncData } from "@/hooks/useAsyncData";
import { getHireVehicles } from "@/services/vehicles.service";
import type { HireVehicle } from "@/types/vehicle";

export default function Hire() {
  const { data: vehicles, isLoading, error } = useAsyncData(() => getHireVehicles(), []);
  const [selectedVehicle, setSelectedVehicle] = useState<HireVehicle | null>(null);

  return (
    <>
      <Seo
        title="Vehicle Hire"
        description="Hire a vehicle for short-term or long-term use from Lycie Investment."
      />

      <section className="service-hero">
        <div className="container">
          <h1>Vehicles ready for hire</h1>
          <p>Short-term and long-term hire for individuals and businesses.</p>
        </div>
      </section>

      <section className="section container">
        {selectedVehicle ? (
          <>
            <div className="section-heading">
              <span className="eyebrow">Request hire</span>
              <h2>Confirm your hire details</h2>
            </div>
            <HireRequestForm vehicle={selectedVehicle} onCancel={() => setSelectedVehicle(null)} />
          </>
        ) : (
          <>
            <div className="section-heading">
              <span className="eyebrow">Available now</span>
              <h2>Choose a vehicle</h2>
              <p>Sample hire listings shown during development. Rates shown are placeholder rates.</p>
            </div>

            {isLoading && <p className="text-muted">Loading hire vehicles…</p>}
            {error && (
              <p className="text-muted" role="alert">
                Unable to load hire vehicles. Please try again.
              </p>
            )}
            {vehicles && vehicles.length === 0 && (
              <p className="text-muted">No vehicles are currently available for hire.</p>
            )}
            {vehicles && vehicles.length > 0 && (
              <div className="hire-grid">
                {vehicles.map((vehicle) => (
                  <HireVehicleCard
                    key={vehicle.id}
                    vehicle={vehicle}
                    onRequestHire={setSelectedVehicle}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </section>
    </>
  );
}
