import { Link } from "react-router-dom";
import { siteConfig } from "@/config/siteConfig";
import "./Footer.css";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="container footer__grid">
        <div className="footer__about">
          <p className="footer__brand">
            Lycie <span>Investment</span>
          </p>
          <p className="text-muted">
            Vehicle sourcing, importing, dealership, hire and clearing services.
          </p>
        </div>

        <div>
          <h3 className="footer__heading">Company</h3>
          <ul className="footer__list">
            <li><Link to="/about">About</Link></li>
            <li><Link to="/vehicles">Vehicles</Link></li>
            <li><Link to="/contact">Contact</Link></li>
          </ul>
        </div>

        <div>
          <h3 className="footer__heading">Services</h3>
          <ul className="footer__list">
            <li><Link to="/import">Vehicle Importing</Link></li>
            <li><Link to="/vehicles">Vehicle Sales</Link></li>
            <li><Link to="/hire">Vehicle Hire</Link></li>
            <li><Link to="/clearing">Vehicle Clearing</Link></li>
          </ul>
        </div>

        <div>
          <h3 className="footer__heading">Contact</h3>
          <ul className="footer__list text-muted">
            <li>{siteConfig.contact.phone}</li>
            <li>{siteConfig.contact.email}</li>
            <li>{siteConfig.contact.address}</li>
          </ul>
        </div>
      </div>

      <div className="container footer__bottom">
        <p className="text-muted">&copy; {year} Lycie Investment. All rights reserved.</p>
      </div>
    </footer>
  );
}
