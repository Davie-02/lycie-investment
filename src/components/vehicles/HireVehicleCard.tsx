import type { HireVehicle } from "@/types/vehicle";
import { formatCurrency } from "@/utils/format";
import { resolveUploadUrl } from "@/utils/resolveUploadUrl";
import "@/components/vehicles/VehicleCard.css";

interface HireVehicleCardProps {
  vehicle: HireVehicle;
  onRequestHire: (vehicle: HireVehicle) => void;
}

export default function HireVehicleCard({ vehicle, onRequestHire }: HireVehicleCardProps) {
  return (
    <article className="vehicle-card">
      <div className="vehicle-card__image-wrap">
        <img
          src={resolveUploadUrl(vehicle.image)}
          alt={vehicle.name}
          loading="lazy"
          className="vehicle-card__image"
        />
        <span
          className={
            vehicle.available
              ? "vehicle-card__status vehicle-card__status--available"
              : "vehicle-card__status vehicle-card__status--sold"
          }
        >
          {vehicle.available ? "Available" : "Booked"}
        </span>
      </div>

      <div className="vehicle-card__body">
        <h3>{vehicle.name}</h3>
        <p className="text-muted mono vehicle-card__meta">
          {vehicle.transmission} · {vehicle.seats} Seats · {vehicle.fuelType}
        </p>
        <p className="mono vehicle-card__price">
          From {formatCurrency(vehicle.dailyRate, vehicle.currency)} / day
        </p>
        {vehicle.weeklyRate && (
          <p className="text-muted vehicle-card__mileage">
            {formatCurrency(vehicle.weeklyRate, vehicle.currency)} / week
          </p>
        )}

        <button
          type="button"
          className="btn btn-secondary vehicle-card__cta"
          disabled={!vehicle.available}
          onClick={() => onRequestHire(vehicle)}
        >
          {vehicle.available ? "Request Hire" : "Currently Booked"}
        </button>
      </div>
    </article>
  );
}
