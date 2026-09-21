import { useSiteContent } from "@/context/SiteContentContext";
import PhoneLinks from "./PhoneLinks";
import { MailIcon, PhoneIcon, PinIcon } from "./icons";
import { mailtoLink, mapQueryFor, mapsSearchUrl } from "@/utils/contactLinks";
import "./company.css";

/** Big, tappable ways to reach the company — call, email, visit. */
export default function ContactCards() {
  const { content } = useSiteContent();
  const { phone, email, address } = content.contact;
  const intro = content.homeSections.contactCards;
  const emailHref = mailtoLink(email);
  const mapQuery = mapQueryFor(content.contact.mapQuery, address);

  return (
    <section className="section container">
      <div className="section-heading">
        <span className="eyebrow">{intro.eyebrow}</span>
        <h2>{intro.heading}</h2>
        <p>{intro.body}</p>
      </div>
      <ul className="contact-cards">
        <li className="contact-card">
          <span className="contact-card__icon"><PhoneIcon /></span>
          <h3>Call us</h3>
          <p className="contact-card__value"><PhoneLinks value={phone} stacked /></p>
        </li>
        <li className="contact-card">
          <span className="contact-card__icon"><MailIcon /></span>
          <h3>Email us</h3>
          <p className="contact-card__value">{emailHref ? <a href={emailHref}>{email}</a> : email}</p>
        </li>
        <li className="contact-card">
          <span className="contact-card__icon"><PinIcon /></span>
          <h3>Find us</h3>
          <p className="contact-card__value">
            {mapQuery ? (
              <a href={mapsSearchUrl(mapQuery)} target="_blank" rel="noopener noreferrer">
                {address}
              </a>
            ) : (
              address
            )}
          </p>
        </li>
      </ul>
    </section>
  );
}
