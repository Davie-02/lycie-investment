/**
 * The 'clients we serve' section, from Site Content → Clients (Admin). Renders nothing
 * until at least one client is added.
 */
import { useSiteContent } from "@/context/SiteContentContext";
import Reveal from "@/components/common/Reveal";
import { GovernmentIcon, HospitalIcon, SchoolIcon } from "./icons";
import "./company.css";

function iconFor(title: string) {
  const t = title.toLowerCase();
  if (/school|educat|college|universit/.test(t)) return SchoolIcon;
  if (/health|hospital|clinic|medical/.test(t)) return HospitalIcon;
  return GovernmentIcon;
}

export default function ClientsSection() {
  const { content } = useSiteContent();
  const { eyebrow, heading, body, items } = content.clients;
  if (items.length === 0) return null;

  return (
    <section className="section container clients">
      <div className="section-heading">
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        {heading && <h2>{heading}</h2>}
        {body && <p>{body}</p>}
      </div>
      <ul className="clients__grid">
        {items.map((item, index) => {
          const Icon = iconFor(item.title);
          return (
            <li key={item.title}>
              <Reveal delayMs={Math.min(index, 4) * 80}>
                <article className="client-card">
                  <span className="client-card__icon">
                    <Icon />
                  </span>
                  <h3>{item.title}</h3>
                  <p className="text-muted">{item.detail}</p>
                </article>
              </Reveal>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
