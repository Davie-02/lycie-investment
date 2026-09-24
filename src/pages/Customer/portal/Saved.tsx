/** Saved & alerts: the customer's shortlist (compare up to three) and "email me when it arrives" alerts. */
import { Link } from "react-router-dom";
import Price from "@/components/common/Price";
import SaveVehicleButton from "@/components/vehicles/SaveVehicleButton";
import VehicleAlerts from "@/components/customer/VehicleAlerts";
import { useSavedVehicles } from "@/context/SavedVehiclesContext";
import { useCustomerAuth } from "@/context/CustomerAuthContext";
import { formatMileage } from "@/utils/format";
import { resolveUploadUrl } from "@/utils/resolveUploadUrl";
import PortalHeading from "./PortalHeading";

export default function Saved() {
  const { savedVehicles } = useSavedVehicles();
  const { currentUser } = useCustomerAuth();

  return (
    <>
      <PortalHeading title="Saved & alerts" intro="Vehicles you've shortlisted — we'll email you if their price drops — and alerts for vehicles we don't have yet.">
        {savedVehicles.length >= 2 && (
          <Link className="btn btn-secondary" to={`/compare?v=${savedVehicles.slice(0, 3).map(({ vehicle }) => encodeURIComponent(vehicle.slug)).join(",")}`}>
            Compare {Math.min(savedVehicles.length, 3)} side by side
          </Link>
        )}
      </PortalHeading>

      {savedVehicles.length === 0 ? (
        <div className="portal-card">
          <p className="text-muted" style={{ margin: 0 }}>
            Nothing saved yet. Tap the heart on any vehicle to shortlist it here. <Link to="/vehicles">Browse vehicles</Link>
          </p>
        </div>
      ) : (
        <div className="customer-saved-vehicles">
          {savedVehicles.map(({ vehicle }) => (
            <article className="customer-saved-vehicle" key={vehicle.id}>
              <Link to={`/vehicles/${vehicle.slug}`} className="customer-saved-vehicle__image-link">
                <img src={resolveUploadUrl(vehicle.images[0])} alt={`${vehicle.make} ${vehicle.model}, ${vehicle.year}`} className="customer-saved-vehicle__image" loading="lazy" />
              </Link>
              <div className="customer-saved-vehicle__body">
                <Link to={`/vehicles/${vehicle.slug}`}>
                  <h3>
                    {vehicle.make} {vehicle.model}
                  </h3>
                </Link>
                <p className="text-muted mono">
                  {vehicle.year} · {formatMileage(vehicle.mileageKm)}
                </p>
                <p className="mono customer-saved-vehicle__price">
                  <Price amount={vehicle.price} currency={vehicle.currency} layout="inline" />
                </p>
              </div>
              <SaveVehicleButton vehicleId={vehicle.id} className="customer-saved-vehicle__save" />
            </article>
          ))}
        </div>
      )}

      <VehicleAlerts emailConfirmed={Boolean(currentUser?.emailVerifiedAt)} />
    </>
  );
}
