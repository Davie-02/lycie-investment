/**
 * The 'Why choose us' grid on the homepage, from Site Content → Why Choose Us (Admin).
 */
import { useSiteContent } from "@/context/SiteContentContext";

export default function WhyChooseUs() {
  const { content } = useSiteContent();
  const { eyebrow, heading, items } = content.whyChooseUs;

  return (
    <section className="section container why-choose-us">
      <div className="section-heading">
        <span className="eyebrow">{eyebrow}</span>
        <h2>{heading}</h2>
      </div>
      <div className="why-choose-us__grid">
        {items.map((point) => (
          <div className="why-choose-us__item" key={point.title}>
            <h3>{point.title}</h3>
            <p className="text-muted">{point.detail}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
