/**
 * The 'Featured vehicles' grid on the homepage: the first few available vehicles from
 * GET /api/vehicles, drawn with VehicleCard.
 */
import { Link } from "react-router-dom";
import { useAsyncData } from "@/hooks/useAsyncData";
import { getFeaturedVehicles } from "@/services/vehicles.service";
import VehicleCard from "./VehicleCard";
import Reveal from "@/components/common/Reveal";
import "./FeaturedVehicles.css";

const STAGGER_STEP_MS = 80;

export default function FeaturedVehicles() {
  const { data: vehicles, isLoading, error } = useAsyncData(() => getFeaturedVehicles(3), [], ["vehicles"]);

  return (
    <section className="section container">
      <div className="section-heading featured-vehicles__heading">
        <div>
          <span className="eyebrow">In stock now</span>
          <h2>Featured vehicles</h2>
          <p>Explore a selection of vehicles currently available through Lycie Investments.</p>
        </div>
        <Link to="/vehicles" className="btn btn-secondary">
          View all vehicles
        </Link>
      </div>

      {isLoading && <p className="text-muted">Loading vehicles…</p>}

      {error && (
        <p className="text-muted" role="alert">
          Unable to load vehicles. Please try again.
        </p>
      )}

      {vehicles && vehicles.length === 0 && (
        <p className="text-muted">No vehicles are currently available.</p>
      )}

      {vehicles && vehicles.length > 0 && (
        <div className="vehicle-grid">
          {vehicles.map((vehicle, index) => (
            <Reveal key={vehicle.id} delayMs={index * STAGGER_STEP_MS}>
              <VehicleCard vehicle={vehicle} />
            </Reveal>
          ))}
        </div>
      )}
    </section>
  );
}
