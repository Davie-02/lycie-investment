import Seo from "@/components/common/Seo";
import CtaBand from "@/components/common/CtaBand";
import Reveal from "@/components/common/Reveal";
import { useSiteContent } from "@/context/SiteContentContext";
import TrustStrip from "@/components/company/TrustStrip";
import VisionMission from "@/components/company/VisionMission";
import TeamSection from "@/components/company/TeamSection";
import ClientsSection from "@/components/company/ClientsSection";
import FleetSection from "@/components/company/FleetSection";
import ContactCards from "@/components/company/ContactCards";
import ServicesSection from "@/components/services/ServicesSection";
import "@/components/company/company.css";

export default function About() {
  const { content } = useSiteContent();
  const { intro, whatWeDo, howWeWork, whyChooseUs } = content.about;
  const { name, established, tagline, story } = content.company;

  return (
    <>
      <Seo
        title="About"
        description={`Learn about ${name || "Lycie Investments"} — vehicle imports and clearing, vehicle hire and transport services.`}
      />

      <section className="service-hero">
        <div className="container">
          {established && <span className="about-since">Since {established}</span>}
          <h1>{tagline || "One company for the whole vehicle journey"}</h1>
          <p>{intro}</p>
        </div>
      </section>

      <TrustStrip />

      {story.length > 0 && (
        <section className="section container about-story">
          <Reveal>
            <div>
              <span className="eyebrow">Our story</span>
              <h2>{name || "Who we are"}</h2>
            </div>
          </Reveal>
          <Reveal delayMs={80}>
            <div className="about-story__text">
              {story.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </Reveal>
        </section>
      )}

      <VisionMission />

      <ServicesSection />

      <section className="section container about-content">
        <Reveal>
          <div>
            <h2>What we do</h2>
            <p className="text-muted">{whatWeDo}</p>
          </div>
        </Reveal>

        <Reveal delayMs={80}>
          <div>
            <h2>How we work with customers</h2>
            <p className="text-muted">{howWeWork}</p>
          </div>
        </Reveal>

        <Reveal delayMs={160}>
          <div>
            <h2>Why work with us</h2>
            <p className="text-muted">{whyChooseUs}</p>
          </div>
        </Reveal>
      </section>

      <FleetSection />
      <TeamSection />
      <ClientsSection />
      <ContactCards />

      <Reveal>
        <CtaBand
          heading="Have a question before you get started?"
          body="Reach out and we'll walk you through how the process works."
          primary={{ label: "Contact Us", to: "/contact" }}
          secondary={{ label: "Browse Vehicles", to: "/vehicles" }}
        />
      </Reveal>
    </>
  );
}
