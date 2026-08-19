import { Link } from "react-router-dom";
import { companyName } from "@/config/siteConfig";
import { useSiteContent } from "@/context/SiteContentContext";
import WhatsAppIcon from "@/components/common/WhatsAppIcon";
import "./Footer.css";

const SOCIAL_LABELS: Record<string, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  twitter: "Twitter/X",
  linkedin: "LinkedIn",
};

export default function Footer() {
  const { content } = useSiteContent();
  const year = new Date().getFullYear();

  const socialLinks = Object.entries(content.social).filter(([, url]) => Boolean(url)) as [
    string,
    string,
  ][];
  const whatsappNumber = content.contact.whatsappNumber;

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
          {(socialLinks.length > 0 || whatsappNumber) && (
            <ul className="footer__social">
              {whatsappNumber && whatsappNumber.trim() && (
                <li>
                  <a
                    href={`https://wa.me/${whatsappNumber.replace(/[^\d]/g, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="footer__social-whatsapp"
                    aria-label="Message us on WhatsApp"
                  >
                    <WhatsAppIcon size={20} />
                    <span>WhatsApp</span>
                  </a>
                </li>
              )}
              {socialLinks.map(([key, url]) => (
                <li key={key}>
                  <a href={url} target="_blank" rel="noopener noreferrer">
                    {SOCIAL_LABELS[key] ?? key}
                  </a>
                </li>
              ))}
            </ul>
          )}
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
            <li>{content.contact.phone}</li>
            <li>{content.contact.email}</li>
            <li>{content.contact.address}</li>
          </ul>
        </div>
      </div>

      <div className="container footer__bottom">
        <p className="text-muted">&copy; {year} {companyName}. All rights reserved.</p>
      </div>
    </footer>
  );
}
