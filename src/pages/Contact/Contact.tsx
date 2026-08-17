import Seo from "@/components/common/Seo";
import ContactForm from "@/components/forms/ContactForm";
import { siteConfig } from "@/config/siteConfig";

export default function Contact() {
  const { phone, email, address, businessHours, whatsappNumber } = siteConfig.contact;

  return (
    <>
      <Seo
        title="Contact Us"
        description="Get in touch with Lycie Investment — phone, email, location and business hours."
      />

      <section className="service-hero">
        <div className="container">
          <h1>Get in touch</h1>
          <p>Reach us directly, or send a message and we'll respond as soon as we can.</p>
        </div>
      </section>

      <section className="section container contact-layout">
        <div className="contact-details">
          <div className="contact-details__item">
            <h3>Phone</h3>
            <p className="text-muted mono">{phone}</p>
          </div>
          <div className="contact-details__item">
            <h3>Email</h3>
            <p className="text-muted mono">{email}</p>
          </div>
          <div className="contact-details__item">
            <h3>Address</h3>
            <p className="text-muted">{address}</p>
          </div>
          <div className="contact-details__item">
            <h3>Business Hours</h3>
            <p className="text-muted">{businessHours}</p>
          </div>
          {whatsappNumber && (
            <a
              href={`https://wa.me/${whatsappNumber.replace(/[^\d]/g, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary"
            >
              Message on WhatsApp
            </a>
          )}
        </div>

        <div>
          <ContactForm />
        </div>
      </section>
    </>
  );
}
