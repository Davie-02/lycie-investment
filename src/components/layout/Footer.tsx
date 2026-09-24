/**
 * The site footer on every public page. Everything in it comes from Site Content
 * (Admin): tagline, phone numbers (tap to call), email (tap to write), address (tap to
 * open Google Maps), WhatsApp and social links, and the copyright line. Page links are
 * fixed here.
 */
import { Link } from "react-router-dom";
import { companyName } from "@/config/siteConfig";
import { mailtoLink, mapQueryFor, mapsSearchUrl, safeHttpUrl } from "@/utils/contactLinks";
import { useSiteContent } from "@/context/SiteContentContext";
import WhatsAppIcon from "@/components/common/WhatsAppIcon";
import PhoneLinks from "@/components/company/PhoneLinks";
import "./Footer.css";
import { useT } from "@/i18n/LanguageContext";

const SOCIAL_LABELS: Record<string, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  twitter: "Twitter/X",
  linkedin: "LinkedIn",
};

export default function Footer() {
  const t = useT();
  const { content } = useSiteContent();
  const year = new Date().getFullYear();

  // Only real web addresses become links (a "javascript:" address saved in the admin would run code when clicked).
  const socialLinks = Object.entries(content.social)
    .map(([key, url]) => [key, safeHttpUrl(typeof url === "string" ? url : null)] as const)
    .filter((entry): entry is readonly [string, string] => Boolean(entry[1]));
  const whatsappNumber = content.contact.whatsappNumber;
  // Email and address become tappable: mail app / Google Maps. Placeholder text
  // that isn't a real email or address stays plain text.
  const emailHref = mailtoLink(content.contact.email);
  const mapQuery = mapQueryFor(content.contact.mapQuery, content.contact.address);

  return (
    <footer className="footer">
      <div className="container footer__grid">
        <div className="footer__about">
          <p className="footer__brand">
            Lycie <span>Investments</span>
          </p>
          <p className="text-muted">{content.footer.tagline}</p>
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
          <h3 className="footer__heading">{t("footer.company")}</h3>
          <ul className="footer__list">
            <li><Link to="/about">{t("footer.about")}</Link></li>
            <li><Link to="/vehicles">{t("footer.vehicles")}</Link></li>
            <li><Link to="/blog">{t("footer.blog")}</Link></li>
            <li><Link to="/faq">{t("footer.faq")}</Link></li>
            <li><Link to="/reviews">{t("footer.reviews")}</Link></li>
            <li><Link to="/contact">{t("nav.contact")}</Link></li>
          </ul>
        </div>

        <div>
          <h3 className="footer__heading">{t("footer.services")}</h3>
          <ul className="footer__list">
            <li><Link to="/import">{t("footer.importing")}</Link></li>
            <li><Link to="/vehicles">{t("footer.sales")}</Link></li>
            <li><Link to="/hire">{t("footer.hire")}</Link></li>
            <li><Link to="/clearing">{t("footer.clearing")}</Link></li>
            <li><Link to="/track">{t("footer.track")}</Link></li>
          </ul>
        </div>

        <div>
          <h3 className="footer__heading">{t("footer.contact")}</h3>
          <ul className="footer__list text-muted">
            <li>
              <PhoneLinks value={content.contact.phone} separator=" · " />
            </li>
            <li>{emailHref ? <a href={emailHref}>{content.contact.email}</a> : content.contact.email}</li>
            <li>
              {mapQuery ? (
                <a href={mapsSearchUrl(mapQuery)} target="_blank" rel="noopener noreferrer">
                  {content.contact.address}
                </a>
              ) : (
                content.contact.address
              )}
            </li>
          </ul>
        </div>
      </div>

      <div className="container footer__bottom">
        <p className="text-muted footer__copyright">
          &copy; {year} {companyName}. {content.footer.rightsText}
        </p>
      </div>
    </footer>
  );
}
