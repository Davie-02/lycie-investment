import Seo from "@/components/common/Seo";
import ContactForm from "@/components/forms/ContactForm";
import WhatsAppIcon from "@/components/common/WhatsAppIcon";
import { useSiteContent } from "@/context/SiteContentContext";

export default function Contact() {
  const { content } = useSiteContent();
  const { phone, email, address, businessHours, whatsappNumber } = content.contact;

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

        <div>
          <ContactForm />
        </div>
      </section>
    </>
  );
}
