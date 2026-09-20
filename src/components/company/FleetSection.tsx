import { useSiteContent } from "@/context/SiteContentContext";
import Reveal from "@/components/common/Reveal";
import Img from "@/components/common/Img";
import { TruckIcon } from "./icons";
import "./company.css";

/** The working fleet. Each vehicle shows its photo once one is uploaded in the admin, and a clean placeholder until then. */
export default function FleetSection() {
  const { content } = useSiteContent();
  const { eyebrow, heading, body, items } = content.fleet;
  if (items.length === 0) return null;

  return (
    <section className="section container fleet">
      <div className="section-heading">
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        {heading && <h2>{heading}</h2>}
        {body && <p>{body}</p>}
      </div>
      <ul className="fleet__grid">
        {items.map((item, index) => (
          <li key={`${item.title}-${index}`}>
            <Reveal delayMs={Math.min(index % 3, 3) * 80}>
              <figure className="fleet-card">
                <div className="fleet-card__frame">
                  {item.image ? (
                    <>
                      <Img src={item.image} alt="" sizes="(min-width: 900px) 380px, 100vw" className="fleet-card__backdrop" />
                      <Img src={item.image} alt={item.title} sizes="(min-width: 900px) 380px, 100vw" className="fleet-card__photo" />
                    </>
                  ) : (
                    <span className="fleet-card__placeholder">
                      <TruckIcon />
                    </span>
                  )}
                </div>
                <figcaption>
                  <strong>{item.title}</strong>
                  {item.caption && <span className="text-muted">{item.caption}</span>}
                </figcaption>
              </figure>
            </Reveal>
          </li>
        ))}
      </ul>
    </section>
  );
}
