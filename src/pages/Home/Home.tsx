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

export default function Home() {
  return (
    <>
      <Seo
        title="Home"
        description="Lycie Investments sources, imports, sells, hires and clears vehicles for customers in Malawi."
      />
      <Hero />
      <VehicleCarousel />
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
