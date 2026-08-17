const POINTS = [
  { title: "One point of contact", detail: "Sourcing, import, clearing and delivery under one company." },
  { title: "Clear communication", detail: "Updates at each stage, not silence between order and delivery." },
  { title: "Flexible vehicle hire", detail: "Short-term and long-term hire alongside dealership sales." },
  { title: "Documentation support", detail: "Help preparing and coordinating the paperwork your vehicle needs." },
];

export default function WhyChooseUs() {
  return (
    <section className="section container why-choose-us">
      <div className="section-heading">
        <span className="eyebrow">Why Lycie Investment</span>
        <h2>What working with us looks like</h2>
      </div>
      <div className="why-choose-us__grid">
        {POINTS.map((point) => (
          <div className="why-choose-us__item" key={point.title}>
            <h3>{point.title}</h3>
            <p className="text-muted">{point.detail}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
