import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import "./Hero.css";

const JOURNEY_HIGHLIGHTS = [
  {
    label: "Sourcing completed",
    title: "Toyota Hilux, 2022",
    detail: "Matched to a customer's work and travel requirements.",
    origin: "Japan",
    destination: "Lilongwe, Malawi",
  },
  {
    label: "Import coordinated",
    title: "Honda Fit, 2020",
    detail: "Sourcing, shipping documentation, and arrival coordination handled by one team.",
    origin: "Japan",
    destination: "Blantyre, Malawi",
  },
  {
    label: "Hire delivered",
    title: "Toyota Corolla",
    detail: "A dependable vehicle prepared and delivered for a business trip.",
    origin: "Lycie fleet",
    destination: "Lilongwe, Malawi",
  },
] as const;

export default function Hero() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const highlight = JOURNEY_HIGHLIGHTS[activeIndex];

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion || isPaused) return;

    const intervalId = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % JOURNEY_HIGHLIGHTS.length);
    }, 6000);

    return () => window.clearInterval(intervalId);
  }, [isPaused]);

  function showHighlight(index: number) {
    setActiveIndex((index + JOURNEY_HIGHLIGHTS.length) % JOURNEY_HIGHLIGHTS.length);
  }

  return (
    <section className="hero">
      <div className="container hero__grid">
        <div>
          <span className="hero__eyebrow">Source · Import · Clear · Deliver</span>
          <h1>From order to your driveway, one company handles the whole journey.</h1>
          <p>
            Lycie Investment sources, imports, sells, hires and clears vehicles for
            customers who want one point of contact from request to delivery — not
            four separate agents to chase.
          </p>
          <div className="hero__actions">
            <Link to="/vehicles" className="btn btn-primary">
              Browse Vehicles
            </Link>
            <Link to="/import" className="btn btn-secondary">
              Request a Vehicle
            </Link>
          </div>
        </div>

        <div
          className="hero__panel"
          aria-live="polite"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
          onFocus={() => setIsPaused(true)}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) setIsPaused(false);
          }}
        >
          <div className="hero__panel-heading">
            <span className="hero__panel-label">Customer journey highlights</span>
            <span className="hero__panel-count">{activeIndex + 1} / {JOURNEY_HIGHLIGHTS.length}</span>
          </div>
          <div className="hero__panel-row">
            <span className="hero__panel-label">Milestone</span>
            <span className="hero__panel-value">{highlight.label}</span>
          </div>
          <div className="hero__panel-row">
            <span className="hero__panel-label">Vehicle</span>
            <span className="hero__panel-value">{highlight.title}</span>
          </div>
          <div className="hero__panel-row">
            <span className="hero__panel-label">From</span>
            <span className="hero__panel-value">{highlight.origin}</span>
          </div>
          <div className="hero__panel-row">
            <span className="hero__panel-label">To</span>
            <span className="hero__panel-value">{highlight.destination}</span>
          </div>
          <p className="hero__panel-detail">{highlight.detail}</p>
          <div className="hero__panel-controls">
            <button type="button" className="hero__panel-arrow" onClick={() => showHighlight(activeIndex - 1)} aria-label="Previous highlight">
              Previous
            </button>
            <div className="hero__panel-dots" aria-label="Journey highlights">
              {JOURNEY_HIGHLIGHTS.map((item, index) => (
                <button
                  key={item.title}
                  type="button"
                  className={index === activeIndex ? "hero__panel-dot hero__panel-dot--active" : "hero__panel-dot"}
                  onClick={() => showHighlight(index)}
                  aria-label={`Show ${item.label.toLowerCase()}`}
                  aria-current={index === activeIndex ? "true" : undefined}
                />
              ))}
            </div>
            <button type="button" className="hero__panel-arrow" onClick={() => showHighlight(activeIndex + 1)} aria-label="Next highlight">
              Next
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
