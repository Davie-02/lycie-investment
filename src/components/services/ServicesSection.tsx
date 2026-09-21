/**
 * The 'What we do' section on the homepage. Titles and descriptions come from Site
 * Content → Services (Admin); the four slots' icons and links (Import, Vehicles, Hire,
 * Clearing) are fixed here.
 */
import ServiceCard from "./ServiceCard";
import { useSiteContent } from "@/context/SiteContentContext";
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
// Icon and link target for each of the fixed service slots — these
// don't change, so they stay in code. Only the title/description text
// (content.services.items, same order) is CMS-edited.
  transport: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M2 6.5h11v9H2zM13 9.5h4.2l3.3 3.3v2.7H13" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="6.5" cy="17.5" r="1.8" />
      <circle cx="16.5" cy="17.5" r="1.8" />
    </svg>
  ),
};

const SERVICE_SLOTS = [
  { icon: ICONS.import, href: "/import" },
  { icon: ICONS.dealership, href: "/vehicles" },
  { icon: ICONS.hire, href: "/hire" },
  { icon: ICONS.clearing, href: "/clearing" },
  { icon: ICONS.transport, href: "/contact" },
];

export default function ServicesSection() {
  const { content } = useSiteContent();
  const { eyebrow, heading, body, items } = content.services;

  return (
    <section className="section container">
      <div className="section-heading">
        <span className="eyebrow">{eyebrow}</span>
        <h2>{heading}</h2>
        <p>{body}</p>
      </div>
      <div className="services-grid">
        {SERVICE_SLOTS.map((slot, index) => {
          const item = items[index];
          if (!item) return null;
          return <ServiceCard key={item.title} {...slot} title={item.title} description={item.description} />;
        })}
      </div>
    </section>
  );
}
