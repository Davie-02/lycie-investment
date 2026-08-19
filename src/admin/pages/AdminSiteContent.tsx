import { useState, type FormEvent } from "react";
import FormField from "@/components/forms/FormField";
import FormStatusBanner from "@/components/forms/FormStatusBanner";
import { adminApi } from "../adminApi";
import { useSiteContent } from "@/context/SiteContentContext";
import { ApiError } from "@/services/http";
import type { ContactContent, SocialContent, AboutContent } from "@/types/siteContent";
import "../components/AdminLayout.css";

export default function AdminSiteContent() {
  const { content, isLoading, refresh } = useSiteContent();

  return (
    <div>
      <h1>Site Content</h1>
      <p className="admin-page-intro">
        Edit the text shown on the public site's Contact, About, and Footer sections. Changes go
        live immediately — no redeploy needed.
      </p>

      {isLoading ? (
        <p className="text-muted">Loading current content…</p>
      ) : (
        <div className="site-content-sections">
          <ContactSection initial={content.contact} onSaved={refresh} />
          <SocialSection initial={content.social} onSaved={refresh} />
          <AboutSection initial={content.about} onSaved={refresh} />
        </div>
      )}
    </div>
  );
}

function ContactSection({ initial, onSaved }: { initial: ContactContent; onSaved: () => void }) {
  const [values, setValues] = useState<ContactContent>(initial);
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("saving");
    setError(null);
    try {
      await adminApi.patch("/site-content/contact", { value: values });
      setStatus("success");
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save contact info.");
      setStatus("error");
    }
  }

  return (
    <form className="form-card" onSubmit={handleSubmit} noValidate>
      <h2>Contact Info</h2>
      {status === "success" && (
        <FormStatusBanner status="success" successMessage="Contact info updated." errorMessage={null} />
      )}
      {status === "error" && <FormStatusBanner status="error" successMessage="" errorMessage={error} />}

      <div className="form-grid form-grid--2col">
        <FormField
          id="contact-phone"
          label="Phone"
          value={values.phone}
          onChange={(e) => setValues({ ...values, phone: e.target.value })}
        />
        <FormField
          id="contact-email"
          label="Email"
          type="email"
          value={values.email}
          onChange={(e) => setValues({ ...values, email: e.target.value })}
        />
        <FormField
          id="contact-address"
          label="Address"
          value={values.address}
          onChange={(e) => setValues({ ...values, address: e.target.value })}
        />
        <FormField
          id="contact-hours"
          label="Business Hours"
          value={values.businessHours}
          onChange={(e) => setValues({ ...values, businessHours: e.target.value })}
        />
        <FormField
          id="contact-whatsapp"
          label="WhatsApp Number (optional — shows a WhatsApp button on /contact if set)"
          value={values.whatsappNumber ?? ""}
          onChange={(e) => setValues({ ...values, whatsappNumber: e.target.value || null })}
          placeholder="+265..."
          wrapperClassName="form-grid__full"
        />
      </div>

      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={status === "saving"}>
          {status === "saving" ? "Saving…" : "Save Contact Info"}
        </button>
      </div>
    </form>
  );
}

function SocialSection({ initial, onSaved }: { initial: SocialContent; onSaved: () => void }) {
  const [values, setValues] = useState<SocialContent>(initial);
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("saving");
    setError(null);
    try {
      await adminApi.patch("/site-content/social", { value: values });
      setStatus("success");
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save social links.");
      setStatus("error");
    }
  }

  function update(key: keyof SocialContent, value: string) {
    setValues({ ...values, [key]: value || null });
  }

  return (
    <form className="form-card" onSubmit={handleSubmit} noValidate>
      <h2>Social Links</h2>
      <p className="text-muted">Leave blank to hide a link — only filled-in links show in the footer.</p>
      {status === "success" && (
        <FormStatusBanner status="success" successMessage="Social links updated." errorMessage={null} />
      )}
      {status === "error" && <FormStatusBanner status="error" successMessage="" errorMessage={error} />}

      <div className="form-grid form-grid--2col">
        <FormField
          id="social-facebook"
          label="Facebook URL"
          value={values.facebook ?? ""}
          onChange={(e) => update("facebook", e.target.value)}
        />
        <FormField
          id="social-instagram"
          label="Instagram URL"
          value={values.instagram ?? ""}
          onChange={(e) => update("instagram", e.target.value)}
        />
        <FormField
          id="social-twitter"
          label="Twitter/X URL"
          value={values.twitter ?? ""}
          onChange={(e) => update("twitter", e.target.value)}
        />
        <FormField
          id="social-linkedin"
          label="LinkedIn URL"
          value={values.linkedin ?? ""}
          onChange={(e) => update("linkedin", e.target.value)}
        />
      </div>

      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={status === "saving"}>
          {status === "saving" ? "Saving…" : "Save Social Links"}
        </button>
      </div>
    </form>
  );
}

function AboutSection({ initial, onSaved }: { initial: AboutContent; onSaved: () => void }) {
  const [values, setValues] = useState<AboutContent>(initial);
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("saving");
    setError(null);
    try {
      await adminApi.patch("/site-content/about", { value: values });
      setStatus("success");
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save About page copy.");
      setStatus("error");
    }
  }

  return (
    <form className="form-card" onSubmit={handleSubmit} noValidate>
      <h2>About Page</h2>
      {status === "success" && (
        <FormStatusBanner status="success" successMessage="About page updated." errorMessage={null} />
      )}
      {status === "error" && <FormStatusBanner status="error" successMessage="" errorMessage={error} />}

      <div className="form-grid">
        <FormField
          id="about-intro"
          label="Intro (shown in the About page hero)"
          as="textarea"
          value={values.intro}
          onChange={(e) => setValues({ ...values, intro: e.target.value })}
        />
        <FormField
          id="about-whatWeDo"
          label="What We Do"
          as="textarea"
          value={values.whatWeDo}
          onChange={(e) => setValues({ ...values, whatWeDo: e.target.value })}
        />
        <FormField
          id="about-howWeWork"
          label="How We Work With Customers"
          as="textarea"
          value={values.howWeWork}
          onChange={(e) => setValues({ ...values, howWeWork: e.target.value })}
        />
        <FormField
          id="about-whyChooseUs"
          label="Why Work With Us"
          as="textarea"
          value={values.whyChooseUs}
          onChange={(e) => setValues({ ...values, whyChooseUs: e.target.value })}
        />
      </div>

      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={status === "saving"}>
          {status === "saving" ? "Saving…" : "Save About Page"}
        </button>
      </div>
    </form>
  );
}
