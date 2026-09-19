import { useState } from "react";
import Seo from "@/components/common/Seo";
import HireVehicleCard from "@/components/vehicles/HireVehicleCard";
import HireRequestForm from "@/components/forms/HireRequestForm";
import Reveal from "@/components/common/Reveal";
import { useAsyncData } from "@/hooks/useAsyncData";
import { getHireVehicles } from "@/services/vehicles.service";
import { useSiteContent } from "@/context/SiteContentContext";
import type { HireVehicle } from "@/types/vehicle";

const STAGGER_STEP_MS = 70;
const STAGGER_CAP = 6;

export default function Hire() {
  const { content } = useSiteContent();
  const { data: vehicles, isLoading, error } = useAsyncData(() => getHireVehicles(), []);
  const [selectedVehicle, setSelectedVehicle] = useState<HireVehicle | null>(null);

  return (
    <>
      <Seo
        title="Vehicle Hire"
        description="Hire a vehicle for short-term or long-term use from Lycie Investments."
      />

      <section className="service-hero">
        <div className="container">
          <h1>{content.hirePage.heading}</h1>
          <p>{content.hirePage.body}</p>
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
              <p>Browse our available vehicles and choose the one that best suits your travel and transportation needs. Select your preferred vehicle to view pricing, features and availability.</p>
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
                {vehicles.map((vehicle, index) => (
                  <Reveal key={vehicle.id} delayMs={Math.min(index, STAGGER_CAP) * STAGGER_STEP_MS}>
                    <HireVehicleCard vehicle={vehicle} onRequestHire={setSelectedVehicle} />
                  </Reveal>
                ))}
              </div>
            )}
          </>
        )}
      </section>
    </>
  );
}
