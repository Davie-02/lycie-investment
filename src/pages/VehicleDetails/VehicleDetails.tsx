import { useParams, Link } from "react-router-dom";
import Seo from "@/components/common/Seo";
import VehicleGallery from "@/components/vehicles/VehicleGallery";
import VehicleSpecifications from "@/components/vehicles/VehicleSpecifications";
import InquiryForm from "@/components/forms/InquiryForm";
import { useAsyncData } from "@/hooks/useAsyncData";
import { getVehicleBySlug } from "@/services/vehicles.service";
import "./VehicleDetails.css";

export default function VehicleDetails() {
  const { slug } = useParams<{ slug: string }>();
  const { data: vehicle, isLoading, error } = useAsyncData(
    () => getVehicleBySlug(slug ?? ""),
    [slug]
  );

  if (isLoading) {
    return (
      <section className="section container">
        <p className="text-muted">Loading vehicle…</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="section container">
        <p className="text-muted" role="alert">
          Unable to load this vehicle. Please try again.
        </p>
      </section>
    );
  }

  if (!vehicle) {
    return (
      <section className="section container">
        <div className="section-heading">
          <h1>Vehicle not found</h1>
          <p>This vehicle may have been sold or the link may be incorrect.</p>
        </div>
        <Link to="/vehicles" className="btn btn-secondary">
          Browse Vehicles
        </Link>
      </section>
    );
  }

  const vehicleLabel = `${vehicle.make} ${vehicle.model} (${vehicle.year})`;

  return (
    <>
      <Seo
        title={vehicleLabel}
        description={`${vehicleLabel} — ${vehicle.transmission}, ${vehicle.fuelType}, ${vehicle.mileageKm.toLocaleString()} km. ${vehicle.description}`}
      />

      <section className="section container vehicle-details">
        <div>
          <VehicleGallery
            images={vehicle.images}
            altBase={`${vehicle.make} ${vehicle.model} ${vehicle.year}`}
          />

          <div className="vehicle-details__description">
            <h2>Description</h2>
            <p className="text-muted">{vehicle.description}</p>
          </div>

          <div className="vehicle-details__description">
            <h2>Features</h2>
            <ul className="vehicle-details__features">
              {vehicle.features.map((feature) => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>
          </div>

          <div className="vehicle-details__description">
            <h2>Specifications</h2>
            <VehicleSpecifications vehicle={vehicle} />
          </div>
        </div>

        <aside className="vehicle-details__sidebar">
          <div className="vehicle-details__inquiry-prompt">
            <h2>Interested in this vehicle?</h2>
            <p className="text-muted">Make an inquiry and we'll get back to you.</p>
          </div>
          <InquiryForm vehicleId={vehicle.id} vehicleLabel={vehicleLabel} />
        </aside>
      </section>
    </>
  );
}
