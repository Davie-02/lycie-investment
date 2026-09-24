/**
 * One vehicle's page: photo gallery (swipeable), price and specs, description, features,
 * reviews for that vehicle and the inquiry form. Loaded by slug from GET
 * /api/vehicles/:slug; shows 'Vehicle not found' for sold, archived or mistyped links.
 */
import { useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import Seo from "@/components/common/Seo";
import VehicleGallery from "@/components/vehicles/VehicleGallery";
import VehicleSpecifications from "@/components/vehicles/VehicleSpecifications";
import SaveVehicleButton from "@/components/vehicles/SaveVehicleButton";
import CompareButton from "@/components/vehicles/CompareButton";
import "@/pages/Compare/Compare.css";
import InquiryForm from "@/components/forms/InquiryForm";
import Reveal from "@/components/common/Reveal";
import ReviewsSection from "@/components/reviews/ReviewsSection";
import { recordVehicleView } from "@/services/reviews.service";
import { useAsyncData } from "@/hooks/useAsyncData";
import { getVehicleBySlug } from "@/services/vehicles.service";
import { formatMileage } from "@/utils/format";
import "./VehicleDetails.css";
import Price from "@/components/common/Price";
import ShareButtons from "@/components/common/ShareButtons";
import { useSiteContent } from "@/context/SiteContentContext";
import { usePricing } from "@/context/PricingContext";
import { vehicleLd } from "@/utils/structuredData";
import WhatsAppIcon from "@/components/common/WhatsAppIcon";
import { whatsappUrl } from "@/utils/contactLinks";

export default function VehicleDetails() {
  const { content } = useSiteContent();
  const { rate } = usePricing();
  const { slug } = useParams<{ slug: string }>();
  const { data: vehicle, isLoading, error } = useAsyncData(
    () => getVehicleBySlug(slug ?? ""),
    [slug],
    ["vehicles"]
  );

  const vehicleId = vehicle?.id;
  useEffect(() => {
    if (vehicleId) recordVehicleView(vehicleId);
  }, [vehicleId]);

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
  // Pre-writes the chat with the vehicle's name and page, so the customer only has to press send.
  const whatsappLink = content.contact.whatsappNumber ? whatsappUrl(content.contact.whatsappNumber, `Hello, I'm interested in the ${vehicleLabel}: ${window.location.href}`) : null;

  return (
    <>
      <Seo
        title={vehicleLabel}
        description={`${vehicleLabel} — ${vehicle.transmission}, ${vehicle.fuelType}, ${vehicle.mileageKm.toLocaleString()} km. ${vehicle.description}`}
        image={vehicle.images[0]}
        type="product"
        jsonLd={vehicleLd(vehicle, content, window.location.origin, rate)}
      />

      <section className="section container vehicle-details">
        <div>
          <div className="vehicle-details__heading">
            <div>
              <h1>{vehicleLabel}</h1>
              <p className="text-muted vehicle-details__heading-meta">
                {vehicle.transmission} · {vehicle.fuelType} · {formatMileage(vehicle.mileageKm)}
              </p>
              <p className="mono vehicle-details__heading-price">
                <Price amount={vehicle.price} currency={vehicle.currency} />
              </p>
            </div>
            <SaveVehicleButton vehicleId={vehicle.id} className="vehicle-details__save" />
          </div>

          <VehicleGallery
            images={vehicle.images}
            altBase={`${vehicle.make} ${vehicle.model} ${vehicle.year}`}
          />
          <ShareButtons text={`${vehicleLabel} — ${content.seo.siteName}`} />
          <CompareButton slug={vehicle.slug} />
          {whatsappLink && (
            <p style={{ marginTop: "var(--space-4)" }}>
              <a className="btn btn-whatsapp" href={whatsappLink} target="_blank" rel="noopener noreferrer">
                <WhatsAppIcon size={18} />
                Ask about this vehicle on WhatsApp
              </a>
            </p>
          )}

          <Reveal>
            <div className="vehicle-details__description">
              <h2>Description</h2>
              <p className="text-muted">{vehicle.description}</p>
            </div>
          </Reveal>

          <Reveal>
            <div className="vehicle-details__description">
              <h2>Features</h2>
              <ul className="vehicle-details__features">
                {vehicle.features.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
            </div>
          </Reveal>

          <Reveal>
            <div className="vehicle-details__description">
              <h2>Specifications</h2>
              <VehicleSpecifications vehicle={vehicle} />
            </div>
          </Reveal>

          <Reveal>
            <div className="vehicle-details__description">
              <ReviewsSection vehicleId={vehicle.id} heading="Reviews of this vehicle" />
            </div>
          </Reveal>
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
