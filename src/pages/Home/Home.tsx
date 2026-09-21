/**
 * The homepage: hero, vehicle carousel, trust strip, services, how it works, featured
 * vehicles, why choose us, fleet, clients, testimonials, FAQ and the closing call-to-
 * action. Each section reads its own wording from Site Content.
 */
import Seo from "@/components/common/Seo";
import Hero from "@/components/common/Hero";
import VehicleCarousel from "@/components/common/VehicleCarousel";
import ServicesSection from "@/components/services/ServicesSection";
import JourneySection from "@/components/common/JourneySection";
import FeaturedVehicles from "@/components/vehicles/FeaturedVehicles";
import WhyChooseUs from "@/components/common/WhyChooseUs";
import TestimonialsSection from "@/components/common/TestimonialsSection";
import FaqSection from "@/components/common/FaqSection";
import CtaBand from "@/components/common/CtaBand";
import Reveal from "@/components/common/Reveal";
import TrustStrip from "@/components/company/TrustStrip";
import ClientsSection from "@/components/company/ClientsSection";
import FleetSection from "@/components/company/FleetSection";
import { useSiteContent } from "@/context/SiteContentContext";
import { organizationLd } from "@/utils/structuredData";

export default function Home() {
  const { content } = useSiteContent();
  return (
    <>
      <Seo
        title="Home"
        jsonLd={organizationLd(content, window.location.origin)}
        description="Lycie Investments and Transportation — vehicle imports and clearing, vehicle hire and safe, reliable transport in Malawi."
      />
      <Hero />
      <VehicleCarousel />
      <TrustStrip />
      <Reveal>
        <ServicesSection />
      </Reveal>
      <Reveal>
        <JourneySection />
      </Reveal>
      <Reveal>
        <FeaturedVehicles />
      </Reveal>
      <Reveal>
        <WhyChooseUs />
      </Reveal>
      <FleetSection />
      <ClientsSection />
      <Reveal>
        <TestimonialsSection />
      </Reveal>
      <Reveal>
        <FaqSection />
      </Reveal>
      <Reveal>
        <CtaBand
          heading={content.homeSections.cta.heading}
          body={content.homeSections.cta.body}
          primary={{ label: content.homeSections.cta.primaryLabel, to: "/vehicles" }}
          secondary={{ label: content.homeSections.cta.secondaryLabel, to: "/contact" }}
        />
      </Reveal>
    </>
  );
}
