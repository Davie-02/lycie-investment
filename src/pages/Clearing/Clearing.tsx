/**
 * The Clearing page: intro, areas of support, disclaimer and the clearing request form.
 * Wording comes from Site Content → Clearing Page (Admin).
 */
import Seo from "@/components/common/Seo";
import ClearingRequestForm from "@/components/forms/ClearingRequestForm";
import Reveal from "@/components/common/Reveal";
import { useSiteContent } from "@/context/SiteContentContext";

export default function Clearing() {
  const { content } = useSiteContent();
  const { heading, body, disclaimer, areas } = content.clearingPage;

  return (
    <>
      <Seo
        title="Vehicle Clearing"
        description="Get help clearing your vehicle — documentation, coordination and delivery arrangements."
      />

      <section className="service-hero">
        <div className="container">
          <h1>{heading}</h1>
          <p>{body}</p>
          <div className="service-note service-note--on-dark">{disclaimer}</div>
        </div>
      </section>

      <Reveal>
        <section className="section container">
          <div className="section-heading">
            <span className="eyebrow">What we help with</span>
            <h2>Areas of support</h2>
          </div>
          <ul className="clearing-areas">
            {areas.map((area) => (
              <li key={area}>{area}</li>
            ))}
          </ul>
        </section>
      </Reveal>

      <Reveal>
        <section className="section container">
          <div className="section-heading">
            <span className="eyebrow">Get started</span>
            <h2>Submit a Clearing Request</h2>
            <p>Share what you have — you can send remaining documents later if needed.</p>
          </div>
          <ClearingRequestForm />
        </section>
      </Reveal>
    </>
  );
}
