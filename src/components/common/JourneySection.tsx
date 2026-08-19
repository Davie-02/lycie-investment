const STEPS = [
  { title: "Tell us what you need", detail: "Share make, model, budget and timeline." },
  { title: "We source the vehicle", detail: "We find a match against your requirements." },
  { title: "We arrange the import", detail: "Shipping and paperwork are coordinated for you." },
  { title: "Vehicle arrives", detail: "Your vehicle reaches the port or border." },
  { title: "Clearing & documentation", detail: "We assist with clearance and required documents." },
  { title: "Vehicle delivered", detail: "Your vehicle is delivered and ready to drive." },
];

export default function JourneySection() {
  return (
    <section className="section container">
      <div className="section-heading">
        <span className="eyebrow">How it works</span>
        <h2>From request to delivery</h2>
        <p>The same process runs behind every import — visible to you at each stage.</p>
      </div>

      <div className="route-line">
        {STEPS.map((step) => (
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
