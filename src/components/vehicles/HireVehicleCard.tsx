import type { HireVehicle } from "@/types/vehicle";

import ImageSlider from "@/components/common/ImageSlider";
import LikeButton from "@/components/common/LikeButton";
import "@/components/vehicles/VehicleCard.css";
import Price from "@/components/common/Price";

interface HireVehicleCardProps {
  vehicle: HireVehicle;
  onRequestHire: (vehicle: HireVehicle) => void;
}

export default function HireVehicleCard({ vehicle, onRequestHire }: HireVehicleCardProps) {
  return (
    <article className="vehicle-card">
      <div className="vehicle-card__image-wrap">
        {/* Whole gallery when there is one; older vehicles only have the single cover photo. */}
        <ImageSlider
          images={vehicle.images && vehicle.images.length > 0 ? vehicle.images : [vehicle.image]}
          alt={vehicle.name}
          sizes="(min-width: 1000px) 380px, (min-width: 640px) 45vw, 100vw"
        />
        <LikeButton kind="hire" targetId={vehicle.id} noun="vehicle" className="vehicle-card__save" />
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
          From <Price amount={vehicle.dailyRate} currency={vehicle.currency} layout="inline" /> / day
        </p>
        {vehicle.weeklyRate && (
          <p className="text-muted vehicle-card__mileage">
            <Price amount={vehicle.weeklyRate} currency={vehicle.currency} layout="inline" /> / week
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
