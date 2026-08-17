import Seo from "@/components/common/Seo";
import Hero from "@/components/common/Hero";
import ServicesSection from "@/components/services/ServicesSection";
import JourneySection from "@/components/common/JourneySection";
import FeaturedVehicles from "@/components/vehicles/FeaturedVehicles";
import WhyChooseUs from "@/components/common/WhyChooseUs";
import CtaBand from "@/components/common/CtaBand";

export default function Home() {
  return (
    <>
      <Seo
        title="Home"
        description="Lycie Investment sources, imports, sells, hires and clears vehicles for customers in Malawi."
      />
      <Hero />
      <ServicesSection />
      <JourneySection />
      <FeaturedVehicles />
      <WhyChooseUs />
      <CtaBand
        heading="Ready to get your next vehicle?"
        body="Browse what's available now, or tell us what you're looking for."
        primary={{ label: "Browse Vehicles", to: "/vehicles" }}
        secondary={{ label: "Contact Us", to: "/contact" }}
      />
    </>
  );
}
