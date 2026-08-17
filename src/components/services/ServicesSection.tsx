import ServiceCard from "./ServiceCard";
import "./ServicesSection.css";

const ICONS = {
  import: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 3v12m0 0-4-4m4 4 4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  dealership: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 12l1.5-5A2 2 0 0 1 6.4 5.5h11.2a2 2 0 0 1 1.9 1.5L21 12M5 12h14a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-1v1a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-1H8v1a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-1H4a1 1 0 0 1-1-1v-5a1 1 0 0 1 1-1Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  hire: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 8v4l2.5 2.5M21 12a9 9 0 1 1-9-9 9 9 0 0 1 9 9Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  clearing: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M9 12.5 11 14.5 15.5 10M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

const SERVICES = [
  {
    icon: ICONS.import,
    title: "Vehicle Importing",
    description: "We source and import vehicles from abroad to match what you need.",
    href: "/import",
  },
  {
    icon: ICONS.dealership,
    title: "Vehicle Dealership",
    description: "Browse quality vehicles ready for sale, inspected and listed with real specifications.",
    href: "/vehicles",
  },
  {
    icon: ICONS.hire,
    title: "Vehicle Hire",
    description: "Short-term and long-term hire for individuals and businesses.",
    href: "/hire",
  },
  {
    icon: ICONS.clearing,
    title: "Vehicle Clearing",
    description: "Support with clearing, documentation and logistics once your vehicle arrives.",
    href: "/clearing",
  },
];

export default function ServicesSection() {
  return (
    <section className="section container">
      <div className="section-heading">
        <span className="eyebrow">What we do</span>
        <h2>Four services, one company to deal with</h2>
        <p>Handle sourcing, importing, clearing and hire without coordinating separate providers.</p>
      </div>
      <div className="services-grid">
        {SERVICES.map((service) => (
          <ServiceCard key={service.title} {...service} />
        ))}
      </div>
    </section>
  );
}
