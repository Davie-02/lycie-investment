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

export default function Home() {
  return (
    <>
      <Seo
        title="Home"
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
          heading="Ready to get your next vehicle?"
          body="Browse what's available now, or tell us what you're looking for."
          primary={{ label: "Browse Vehicles", to: "/vehicles" }}
          secondary={{ label: "Contact Us", to: "/contact" }}
        />
      </Reveal>
    </>
  );
}
