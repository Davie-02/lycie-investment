import Seo from "@/components/common/Seo";
import ClearingRequestForm from "@/components/forms/ClearingRequestForm";

const AREAS = [
  "Customs clearance coordination",
  "Import documentation",
  "Vehicle processing",
  "Port/border clearance coordination",
  "Customs-related documentation",
  "Payment/document coordination",
  "Vehicle release coordination",
  "Delivery arrangements",
];

export default function Clearing() {
  return (
    <>
      <Seo
        title="Vehicle Clearing"
        description="Get help clearing your vehicle — documentation, coordination and delivery arrangements."
      />

      <section className="service-hero">
        <div className="container">
          <h1>Clearing support once your vehicle arrives</h1>
          <p>
            We assist with vehicle clearing, documentation, and coordination through the
            clearance and delivery process.
          </p>
          <div className="service-note service-note--on-dark">
            Clearance timelines, duty rates and outcomes are determined by customs authorities,
            not by Lycie Investment. We coordinate and support the process — we can't guarantee
            government processing times or costs.
          </div>
        </div>
      </section>

      <section className="section container">
        <div className="section-heading">
          <span className="eyebrow">What we help with</span>
          <h2>Areas of support</h2>
        </div>
        <ul className="clearing-areas">
          {AREAS.map((area) => (
            <li key={area}>{area}</li>
          ))}
        </ul>
      </section>

      <section className="section container">
        <div className="section-heading">
          <span className="eyebrow">Get started</span>
          <h2>Submit a Clearing Request</h2>
          <p>Share what you have — you can send remaining documents later if needed.</p>
        </div>
        <ClearingRequestForm />
      </section>
    </>
  );
}
