/**
 * The Import page: intro and the request-an-imported-vehicle form. Intro comes from Site
 * Content → Import Page (Admin).
 */
import Seo from "@/components/common/Seo";
import JourneySection from "@/components/common/JourneySection";
import ImportRequestForm from "@/components/forms/ImportRequestForm";
import Reveal from "@/components/common/Reveal";
import { useSiteContent } from "@/context/SiteContentContext";

export default function Import() {
  const { content } = useSiteContent();
  const { heading, body } = content.importPage;

  return (
    <>
      <Seo
        title="Vehicle Importing"
        description="Request a vehicle import — tell us what you need and we'll source, import and arrange clearing."
      />

      <section className="service-hero">
        <div className="container">
          <h1>{heading}</h1>
          <p>{body}</p>
        </div>
      </section>

      <Reveal>
        <JourneySection />
      </Reveal>

      <Reveal>
        <section className="section container" id="request">
          <div className="section-heading">
            <span className="eyebrow">Get started</span>
            <h2>Request an Imported Vehicle</h2>
            <p>Share as much detail as you can — it helps us source the right match faster.</p>
          </div>
          <ImportRequestForm />
        </section>
      </Reveal>
    </>
  );
}
