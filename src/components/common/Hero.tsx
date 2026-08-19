import { Link } from "react-router-dom";
import "./Hero.css";

export default function Hero() {
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

        <div className="hero__panel" aria-hidden="true">
          <div className="hero__panel-row">
            <span className="hero__panel-label">Vehicle</span>
            <span className="hero__panel-value">Toyota Hilux, 2022</span>
          </div>
          <div className="hero__panel-row">
            <span className="hero__panel-label">Status</span>
            <span className="hero__panel-value">In transit — clearing</span>
          </div>
          <div className="hero__panel-row">
            <span className="hero__panel-label">Origin</span>
            <span className="hero__panel-value">Sourced abroad</span>
          </div>
          <div className="hero__panel-row">
            <span className="hero__panel-label">Destination</span>
            <span className="hero__panel-value">Lilongwe, MW</span>
          </div>
        </div>
      </div>
    </section>
  );
}
