import Seo from "@/components/common/Seo";
import CtaBand from "@/components/common/CtaBand";
import { useSiteContent } from "@/context/SiteContentContext";

export default function About() {
  const { content } = useSiteContent();
  const { intro, whatWeDo, howWeWork, whyChooseUs } = content.about;

  return (
    <>
      <Seo
        title="About"
        description="Learn about Lycie Investment — vehicle sourcing, importing, sales, hire and clearing."
      />

      <section className="service-hero">
        <div className="container">
          <h1>One company for the whole vehicle journey</h1>
          <p>{intro}</p>
        </div>
      </section>

      <section className="section container about-content">
        <div>
          <h2>What we do</h2>
          <p className="text-muted">{whatWeDo}</p>
        </div>

        <div>
          <h2>How we work with customers</h2>
          <p className="text-muted">{howWeWork}</p>
        </div>

        <div>
          <h2>Why work with us</h2>
          <p className="text-muted">{whyChooseUs}</p>
        </div>
      </section>

      <CtaBand
        heading="Have a question before you get started?"
        body="Reach out and we'll walk you through how the process works."
        primary={{ label: "Contact Us", to: "/contact" }}
        secondary={{ label: "Browse Vehicles", to: "/vehicles" }}
      />
    </>
  );
}
