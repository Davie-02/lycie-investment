import Seo from "@/components/common/Seo";
import ContactForm from "@/components/forms/ContactForm";
import WhatsAppIcon from "@/components/common/WhatsAppIcon";
import Reveal from "@/components/common/Reveal";
import { useSiteContent } from "@/context/SiteContentContext";
import PhoneLinks from "@/components/company/PhoneLinks";
import MapEmbed from "@/components/company/MapEmbed";
import { mailtoLink, mapQueryFor, mapsSearchUrl } from "@/utils/contactLinks";

export default function Contact() {
  const { content } = useSiteContent();
  const { phone, email, address, businessHours, whatsappNumber } = content.contact;
  const { heading, body } = content.pageHeadings.contact;
  const emailHref = mailtoLink(email);
  // Blank = no map at all; otherwise the map setting, falling back to the street address.
  const mapQuery = mapQueryFor(content.contact.mapQuery, address);

  return (
    <>
      <Seo
        title="Contact Us"
        description="Get in touch with Lycie Investments — phone, email, location and business hours."
      />

      <section className="service-hero">
        <div className="container">
          <h1>{heading}</h1>
          <p>{body}</p>
        </div>
      </section>

      <section className="section container contact-layout">
        <Reveal>
          <div className="contact-details">
            <div className="contact-details__item">
              <h3>Phone</h3>
              <p className="text-muted mono">
              <PhoneLinks value={phone} separator=" / " />
            </p>
            </div>
            <div className="contact-details__item">
              <h3>Email</h3>
              <p className="text-muted mono">{emailHref ? <a href={emailHref}>{email}</a> : email}</p>
            </div>
            <div className="contact-details__item">
              <h3>Address</h3>
              <p className="text-muted">
                {mapQuery ? (
                  <a href={mapsSearchUrl(mapQuery)} target="_blank" rel="noopener noreferrer">
                    {address}
                  </a>
                ) : (
                  address
                )}
              </p>
            </div>
            <div className="contact-details__item">
              <h3>Business Hours</h3>
              <p className="text-muted">{businessHours}</p>
            </div>
            {whatsappNumber && whatsappNumber.trim() && (
              <a
                href={`https://wa.me/${whatsappNumber.replace(/[^\d]/g, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-whatsapp"
              >
                <WhatsAppIcon size={18} />
                Message on WhatsApp
              </a>
            )}
          </div>
        </Reveal>

        <Reveal delayMs={100}>
          <div>
            <ContactForm />
          </div>
        </Reveal>
      </section>

      {mapQuery && (
        <section className="section container contact-map">
          <Reveal>
            <MapEmbed query={mapQuery} />
          </Reveal>
        </section>
      )}
    </>
  );
}
