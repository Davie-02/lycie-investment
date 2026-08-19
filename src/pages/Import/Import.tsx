import Seo from "@/components/common/Seo";
import JourneySection from "@/components/common/JourneySection";
import ImportRequestForm from "@/components/forms/ImportRequestForm";

export default function Import() {
  return (
    <>
      <Seo
        title="Vehicle Importing"
        description="Request a vehicle import — tell us what you need and we'll source, import and arrange clearing."
      />

      <section className="service-hero">
        <div className="container">
          <h1>We source and import the vehicle you actually want</h1>
          <p>
            Tell us the make, model and budget you're working with. We handle sourcing,
            import arrangements, and coordinate clearing once it arrives.
          </p>
        </div>
      </section>

      <JourneySection />

      <section className="section container" id="request">
        <div className="section-heading">
          <span className="eyebrow">Get started</span>
          <h2>Request an Imported Vehicle</h2>
          <p>Share as much detail as you can — it helps us source the right match faster.</p>
        </div>
        <ImportRequestForm />
      </section>
    </>
  );
}
