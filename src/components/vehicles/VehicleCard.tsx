import { Link } from "react-router-dom";
import type { Vehicle } from "@/types/vehicle";
import { formatMileage } from "@/utils/format";
import ImageSlider from "@/components/common/ImageSlider";
import SaveVehicleButton from "./SaveVehicleButton";
import "./VehicleCard.css";
import Price from "@/components/common/Price";

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
        {/* Swipe / arrows / dots through every photo; a single photo shows as before. */}
        <ImageSlider
          images={vehicle.images}
          alt={`${vehicle.make} ${vehicle.model}, ${vehicle.year}`}
          sizes="(min-width: 1000px) 380px, (min-width: 640px) 45vw, 100vw"
        />
        <span className={`vehicle-card__status vehicle-card__status--${vehicle.status}`}>
          {STATUS_LABEL[vehicle.status]}
        </span>
        <SaveVehicleButton vehicleId={vehicle.id} className="vehicle-card__save" />
      </div>

      <div className="vehicle-card__body">
        <h3>
          {vehicle.make} {vehicle.model}
        </h3>
        <p className="text-muted mono vehicle-card__meta">
          {vehicle.year} · {vehicle.transmission} · {vehicle.fuelType}
        </p>
        <p className="mono vehicle-card__price"><Price amount={vehicle.price} currency={vehicle.currency} /></p>
        <p className="text-muted vehicle-card__mileage">{formatMileage(vehicle.mileageKm)}</p>

        <Link to={`/vehicles/${vehicle.slug}`} className="btn btn-secondary vehicle-card__cta">
          View Vehicle
        </Link>
      </div>
    </article>
  );
}
