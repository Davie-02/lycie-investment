import { useSiteContent } from "@/context/SiteContentContext";
import PhoneLinks from "./PhoneLinks";
import { MailIcon, PhoneIcon, PinIcon } from "./icons";
import "./company.css";

/** Big, tappable ways to reach the company — call, email, visit. */
export default function ContactCards() {
  const { content } = useSiteContent();
  const { phone, email, address } = content.contact;

  return (
    <section className="section container">
      <div className="section-heading">
        <span className="eyebrow">Get in touch</span>
        <h2>Talk to our team</h2>
        <p>Call, write or visit — we're happy to help with imports, hire, transport or clearing.</p>
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
          <p className="contact-card__value"><a href={`mailto:${email}`}>{email}</a></p>
        </li>
        <li className="contact-card">
          <span className="contact-card__icon"><PinIcon /></span>
          <h3>Find us</h3>
          <p className="contact-card__value">{address}</p>
        </li>
      </ul>
    </section>
  );
}
