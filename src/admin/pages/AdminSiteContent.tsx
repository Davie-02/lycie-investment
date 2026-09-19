import { useEffect, useState, type FormEvent } from "react";
import FormField from "@/components/forms/FormField";
import FormStatusBanner from "@/components/forms/FormStatusBanner";
import { adminApi } from "../adminApi";
import { useSiteContent } from "@/context/SiteContentContext";
import { ApiError } from "@/services/http";
import type {
  ContactContent,
  SocialContent,
  AboutContent,
  SeoContent,
  HeroContent,
  ServicesContent,
  JourneyContent,
  WhyChooseUsContent,
} from "@/types/siteContent";
import "../components/AdminLayout.css";

export default function AdminSiteContent() {
  const { content, isLoading, refresh } = useSiteContent();
  // Each section below keeps its own local form state (so typing in one
  // doesn't affect the rest, and a save shows the just-saved value
  // immediately rather than waiting on a refetch). If the page re-showed
  // the loading gate on every save's background refresh() — not just the
  // very first load — every section would unmount and remount, wiping
  // whatever the admin had typed anywhere else on the page. Once the
  // first load completes, the gate never comes back.
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  useEffect(() => {
    if (!isLoading) setHasLoadedOnce(true);
  }, [isLoading]);

  return (
    <div>
      <h1>Site Content</h1>
      <p className="admin-page-intro">
        Edit the text shown on the public site's homepage, Contact, About, and Footer sections.
        Changes go live immediately — no redeploy needed.
      </p>

      {isLoading && !hasLoadedOnce ? (
        <p className="text-muted">Loading current content…</p>
      ) : (
        <div className="site-content-sections">
          <HeroSection initial={content.hero} onSaved={refresh} />
          <ServicesSection initial={content.services} onSaved={refresh} />
          <JourneySection initial={content.journey} onSaved={refresh} />
          <WhyChooseUsSection initial={content.whyChooseUs} onSaved={refresh} />
          <ContactSection initial={content.contact} onSaved={refresh} />
          <SocialSection initial={content.social} onSaved={refresh} />
          <AboutSection initial={content.about} onSaved={refresh} />
          <SeoSection initial={content.seo} onSaved={refresh} />
        </div>
      )}
    </div>
  );
}

function HeroSection({ initial, onSaved }: { initial: HeroContent; onSaved: () => void }) {
  const [values, setValues] = useState<HeroContent>(initial);
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("saving");
    setError(null);
    try {
      await adminApi.patch("/site-content/hero", { value: values });
      setStatus("success");
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save the homepage hero.");
      setStatus("error");
    }
  }

  function updateHighlight(index: number, field: keyof HeroContent["highlights"][number], value: string) {
    const highlights = values.highlights.map((h, i) => (i === index ? { ...h, [field]: value } : h));
    setValues({ ...values, highlights });
  }

  return (
    <form className="form-card" onSubmit={handleSubmit} noValidate>
      <h2>Homepage Hero</h2>
      <p className="text-muted">The first thing a visitor sees — headline, intro text, and buttons.</p>
      {status === "success" && (
        <FormStatusBanner status="success" successMessage="Homepage hero updated." errorMessage={null} />
      )}
      {status === "error" && <FormStatusBanner status="error" successMessage="" errorMessage={error} />}

      <div className="form-grid">
        <FormField
          id="hero-eyebrow"
          label="Eyebrow (small label above the headline)"
          value={values.eyebrow}
          onChange={(e) => setValues({ ...values, eyebrow: e.target.value })}
        />
        <FormField
          id="hero-heading"
          label="Headline"
          as="textarea"
          value={values.heading}
          onChange={(e) => setValues({ ...values, heading: e.target.value })}
        />
        <FormField
          id="hero-body"
          label="Intro text"
          as="textarea"
          value={values.body}
          onChange={(e) => setValues({ ...values, body: e.target.value })}
        />
        <div className="form-grid form-grid--2col form-grid__full">
          <FormField
            id="hero-primaryCta"
            label="Primary button label (links to /vehicles)"
            value={values.primaryCtaLabel}
            onChange={(e) => setValues({ ...values, primaryCtaLabel: e.target.value })}
          />
          <FormField
            id="hero-secondaryCta"
            label="Secondary button label (links to /import)"
            value={values.secondaryCtaLabel}
            onChange={(e) => setValues({ ...values, secondaryCtaLabel: e.target.value })}
          />
        </div>
      </div>

      <h3 className="site-content-subheading">Journey highlights carousel</h3>
      <p className="text-muted">The rotating panel next to the headline — usually 3 example stories.</p>
      {values.highlights.map((highlight, index) => (
        <fieldset className="site-content-fieldset" key={index}>
          <legend>Highlight {index + 1}</legend>
          <div className="form-grid form-grid--2col">
            <FormField
              id={`hero-highlight-${index}-label`}
              label="Milestone"
              value={highlight.label}
              onChange={(e) => updateHighlight(index, "label", e.target.value)}
            />
            <FormField
              id={`hero-highlight-${index}-title`}
              label="Vehicle"
              value={highlight.title}
              onChange={(e) => updateHighlight(index, "title", e.target.value)}
            />
            <FormField
              id={`hero-highlight-${index}-origin`}
              label="From"
              value={highlight.origin}
              onChange={(e) => updateHighlight(index, "origin", e.target.value)}
            />
            <FormField
              id={`hero-highlight-${index}-destination`}
              label="To"
              value={highlight.destination}
              onChange={(e) => updateHighlight(index, "destination", e.target.value)}
            />
            <FormField
              id={`hero-highlight-${index}-detail`}
              label="Detail"
              as="textarea"
              value={highlight.detail}
              onChange={(e) => updateHighlight(index, "detail", e.target.value)}
              wrapperClassName="form-grid__full"
            />
          </div>
        </fieldset>
      ))}

      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={status === "saving"}>
          {status === "saving" ? "Saving…" : "Save Homepage Hero"}
        </button>
      </div>
    </form>
  );
}

function ServicesSection({ initial, onSaved }: { initial: ServicesContent; onSaved: () => void }) {
  const [values, setValues] = useState<ServicesContent>(initial);
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("saving");
    setError(null);
    try {
      await adminApi.patch("/site-content/services", { value: values });
      setStatus("success");
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save the services section.");
      setStatus("error");
    }
  }

  function updateItem(index: number, field: "title" | "description", value: string) {
    const items = values.items.map((item, i) => (i === index ? { ...item, [field]: value } : item));
    setValues({ ...values, items });
  }

  const SLOT_LABELS = ["Vehicle Importing", "Vehicle Dealership", "Vehicle Hire", "Vehicle Clearing"];

  return (
    <form className="form-card" onSubmit={handleSubmit} noValidate>
      <h2>"What We Do" Section</h2>
      <p className="text-muted">The four service cards shown on the homepage.</p>
      {status === "success" && (
        <FormStatusBanner status="success" successMessage="Services section updated." errorMessage={null} />
      )}
      {status === "error" && <FormStatusBanner status="error" successMessage="" errorMessage={error} />}

      <div className="form-grid">
        <FormField
          id="services-eyebrow"
          label="Eyebrow"
          value={values.eyebrow}
          onChange={(e) => setValues({ ...values, eyebrow: e.target.value })}
        />
        <FormField
          id="services-heading"
          label="Heading"
          value={values.heading}
          onChange={(e) => setValues({ ...values, heading: e.target.value })}
        />
        <FormField
          id="services-body"
          label="Subtext"
          as="textarea"
          value={values.body}
          onChange={(e) => setValues({ ...values, body: e.target.value })}
        />
      </div>

      {values.items.map((item, index) => (
        <fieldset className="site-content-fieldset" key={index}>
          <legend>{SLOT_LABELS[index] ?? `Service ${index + 1}`}</legend>
          <div className="form-grid form-grid--2col">
            <FormField
              id={`services-item-${index}-title`}
              label="Title"
              value={item.title}
              onChange={(e) => updateItem(index, "title", e.target.value)}
            />
            <FormField
              id={`services-item-${index}-description`}
              label="Description"
              value={item.description}
              onChange={(e) => updateItem(index, "description", e.target.value)}
            />
          </div>
        </fieldset>
      ))}

      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={status === "saving"}>
          {status === "saving" ? "Saving…" : "Save Services Section"}
        </button>
      </div>
    </form>
  );
}

function JourneySection({ initial, onSaved }: { initial: JourneyContent; onSaved: () => void }) {
  const [values, setValues] = useState<JourneyContent>(initial);
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("saving");
    setError(null);
    try {
      await adminApi.patch("/site-content/journey", { value: values });
      setStatus("success");
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save the journey section.");
      setStatus("error");
    }
  }

  function updateStep(index: number, field: "title" | "detail", value: string) {
    const steps = values.steps.map((step, i) => (i === index ? { ...step, [field]: value } : step));
    setValues({ ...values, steps });
  }

  return (
    <form className="form-card" onSubmit={handleSubmit} noValidate>
      <h2>"How It Works" Section</h2>
      <p className="text-muted">The step-by-step process shown on the homepage and Import page.</p>
      {status === "success" && (
        <FormStatusBanner status="success" successMessage="Journey section updated." errorMessage={null} />
      )}
      {status === "error" && <FormStatusBanner status="error" successMessage="" errorMessage={error} />}

      <div className="form-grid">
        <FormField
          id="journey-eyebrow"
          label="Eyebrow"
          value={values.eyebrow}
          onChange={(e) => setValues({ ...values, eyebrow: e.target.value })}
        />
        <FormField
          id="journey-heading"
          label="Heading"
          value={values.heading}
          onChange={(e) => setValues({ ...values, heading: e.target.value })}
        />
        <FormField
          id="journey-body"
          label="Subtext"
          as="textarea"
          value={values.body}
          onChange={(e) => setValues({ ...values, body: e.target.value })}
        />
      </div>

      {values.steps.map((step, index) => (
        <fieldset className="site-content-fieldset" key={index}>
          <legend>Step {index + 1}</legend>
          <div className="form-grid form-grid--2col">
            <FormField
              id={`journey-step-${index}-title`}
              label="Title"
              value={step.title}
              onChange={(e) => updateStep(index, "title", e.target.value)}
            />
            <FormField
              id={`journey-step-${index}-detail`}
              label="Detail"
              value={step.detail}
              onChange={(e) => updateStep(index, "detail", e.target.value)}
            />
          </div>
        </fieldset>
      ))}

      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={status === "saving"}>
          {status === "saving" ? "Saving…" : "Save Journey Section"}
        </button>
      </div>
    </form>
  );
}

function WhyChooseUsSection({ initial, onSaved }: { initial: WhyChooseUsContent; onSaved: () => void }) {
  const [values, setValues] = useState<WhyChooseUsContent>(initial);
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("saving");
    setError(null);
    try {
      await adminApi.patch("/site-content/whyChooseUs", { value: values });
      setStatus("success");
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save the \"why choose us\" section.");
      setStatus("error");
    }
  }

  function updateItem(index: number, field: "title" | "detail", value: string) {
    const items = values.items.map((item, i) => (i === index ? { ...item, [field]: value } : item));
    setValues({ ...values, items });
  }

  return (
    <form className="form-card" onSubmit={handleSubmit} noValidate>
      <h2>"Why Choose Us" Section</h2>
      <p className="text-muted">The value-proposition grid shown on the homepage.</p>
      {status === "success" && (
        <FormStatusBanner status="success" successMessage="Section updated." errorMessage={null} />
      )}
      {status === "error" && <FormStatusBanner status="error" successMessage="" errorMessage={error} />}

      <div className="form-grid form-grid--2col">
        <FormField
          id="whyChooseUs-eyebrow"
          label="Eyebrow"
          value={values.eyebrow}
          onChange={(e) => setValues({ ...values, eyebrow: e.target.value })}
        />
        <FormField
          id="whyChooseUs-heading"
          label="Heading"
          value={values.heading}
          onChange={(e) => setValues({ ...values, heading: e.target.value })}
        />
      </div>

      {values.items.map((item, index) => (
        <fieldset className="site-content-fieldset" key={index}>
          <legend>Item {index + 1}</legend>
          <div className="form-grid form-grid--2col">
            <FormField
              id={`whyChooseUs-item-${index}-title`}
              label="Title"
              value={item.title}
              onChange={(e) => updateItem(index, "title", e.target.value)}
            />
            <FormField
              id={`whyChooseUs-item-${index}-detail`}
              label="Detail"
              value={item.detail}
              onChange={(e) => updateItem(index, "detail", e.target.value)}
            />
          </div>
        </fieldset>
      ))}

      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={status === "saving"}>
          {status === "saving" ? "Saving…" : "Save Section"}
        </button>
      </div>
    </form>
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

function SeoSection({ initial, onSaved }: { initial: SeoContent; onSaved: () => void }) {
  const [values, setValues] = useState<SeoContent>(initial);
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("saving");
    setError(null);
    try {
      await adminApi.patch("/site-content/seo", { value: values });
      setStatus("success");
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save SEO settings.");
      setStatus("error");
    }
  }

  return (
    <form className="form-card" onSubmit={handleSubmit} noValidate>
      <h2>SEO</h2>
      <p className="text-muted">Site-wide defaults used when a page doesn't set its own.</p>
      {status === "success" && (
        <FormStatusBanner status="success" successMessage="SEO settings updated." errorMessage={null} />
      )}
      {status === "error" && <FormStatusBanner status="error" successMessage="" errorMessage={error} />}

      <div className="form-grid form-grid--2col">
        <FormField
          id="seo-siteName"
          label={'Site Name (shown after the page title, e.g. "Home | Site Name")'}
          value={values.siteName}
          onChange={(e) => setValues({ ...values, siteName: e.target.value })}
        />
        <FormField
          id="seo-facebookAppId"
          label="Facebook App ID (optional)"
          value={values.facebookAppId ?? ""}
          onChange={(e) => setValues({ ...values, facebookAppId: e.target.value || null })}
        />
        <FormField
          id="seo-defaultDescription"
          label="Default Meta Description"
          as="textarea"
          value={values.defaultDescription}
          onChange={(e) => setValues({ ...values, defaultDescription: e.target.value })}
          wrapperClassName="form-grid__full"
        />
      </div>

      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={status === "saving"}>
          {status === "saving" ? "Saving…" : "Save SEO Settings"}
        </button>
      </div>
    </form>
  );
}
