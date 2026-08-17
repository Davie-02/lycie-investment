import { Link } from "react-router-dom";
import type { Vehicle } from "@/types/vehicle";
import { formatCurrency, formatMileage } from "@/utils/format";
import "./VehicleCard.css";

interface VehicleCardProps {
  vehicle: Vehicle;
}

const STATUS_LABEL: Record<Vehicle["status"], string> = {
  available: "Available",
  reserved: "Reserved",
  sold: "Sold",
};

export default function VehicleCard({ vehicle }: VehicleCardProps) {
  return (
    <article className="vehicle-card">
      <div className="vehicle-card__image-wrap">
        <img
          src={vehicle.images[0]}
          alt={`${vehicle.make} ${vehicle.model}, ${vehicle.year}`}
          loading="lazy"
          className="vehicle-card__image"
        />
        <span className={`vehicle-card__status vehicle-card__status--${vehicle.status}`}>
          {STATUS_LABEL[vehicle.status]}
        </span>
      </div>

      <div className="vehicle-card__body">
        <h3>
          {vehicle.make} {vehicle.model}
        </h3>
        <p className="text-muted mono vehicle-card__meta">
          {vehicle.year} · {vehicle.transmission} · {vehicle.fuelType}
        </p>
        <p className="mono vehicle-card__price">{formatCurrency(vehicle.price, vehicle.currency)}</p>
        <p className="text-muted vehicle-card__mileage">{formatMileage(vehicle.mileageKm)}</p>

        <Link to={`/vehicles/${vehicle.slug}`} className="btn btn-secondary vehicle-card__cta">
          View Vehicle
        </Link>
      </div>
    </article>
  );
}
