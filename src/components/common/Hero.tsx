import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useSiteContent } from "@/context/SiteContentContext";
import "./Hero.css";

export default function Hero() {
  const { content } = useSiteContent();
  const { eyebrow, heading, body, primaryCtaLabel, secondaryCtaLabel, highlights } = content.hero;
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  // Guards against a moment where the CMS has been saved with zero
  // highlights — falls back to an empty-safe placeholder rather than
  // crashing on highlights[0] being undefined.
  const highlight = highlights[activeIndex] ?? highlights[0];

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion || isPaused || highlights.length <= 1) return;

    const intervalId = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % highlights.length);
    }, 6000);

    return () => window.clearInterval(intervalId);
  }, [isPaused, highlights.length]);

  function showHighlight(index: number) {
    setActiveIndex((index + highlights.length) % highlights.length);
  }

  return (
    <section className="hero">
      <div className="container hero__grid">
        <div>
          <span className="hero__eyebrow">{eyebrow}</span>
          <h1>{heading}</h1>
          <p>{body}</p>
          <div className="hero__actions">
            <Link to="/vehicles" className="btn btn-primary">
              {primaryCtaLabel}
            </Link>
            <Link to="/import" className="btn btn-secondary">
              {secondaryCtaLabel}
            </Link>
          </div>
        </div>

        {highlight && (
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
            <span className="hero__panel-count">{activeIndex + 1} / {highlights.length}</span>
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
              {highlights.map((item, index) => (
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
        )}
      </div>
    </section>
  );
}
