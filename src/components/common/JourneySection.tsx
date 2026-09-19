import { useSiteContent } from "@/context/SiteContentContext";

export default function JourneySection() {
  const { content } = useSiteContent();
  const { eyebrow, heading, body, steps } = content.journey;

  return (
    <section className="section container">
      <div className="section-heading">
        <span className="eyebrow">{eyebrow}</span>
        <h2>{heading}</h2>
        <p>{body}</p>
      </div>

      <div className="route-line">
        {steps.map((step) => (
          <div className="route-line__stop" key={step.title}>
            <span className="route-line__dot" />
            <h3 className="route-line__title">{step.title}</h3>
            <p className="text-muted route-line__detail">{step.detail}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
