import { useEffect, useState, type FormEvent } from "react";
import FormField from "@/components/forms/FormField";
import FormStatusBanner from "@/components/forms/FormStatusBanner";
import { adminApi } from "../adminApi";
import { useSiteContent } from "@/context/SiteContentContext";
import { ApiError } from "@/services/http";
import type {
  ContactContent,
  FooterContent,
  PageHeadingsContent,
  HomeSectionsContent,
  SocialContent,
  AboutContent,
  SeoContent,
  HeroContent,
  ServicesContent,
  JourneyContent,
  WhyChooseUsContent,
  ServicePageContent,
  ClearingPageContent,
} from "@/types/siteContent";
import "../components/AdminLayout.css";
import AiWriteButton from "../components/AiWriteButton";
import PricingSettings from "../components/PricingSettings";
import ThemeSettings from "../components/ThemeSettings";
import ImportCalculatorSettings from "../components/ImportCalculatorSettings";
import ImageUploader from "../components/ImageUploader";
import { ClientsSectionEditor, CompanySection, FleetSectionEditor, LoadProfileButton, TeamSectionEditor } from "../components/CompanySections";

const SECTION_LINKS = [
  { id: "site-content-hero", label: "Hero" },
  { id: "site-content-services", label: "Services" },
  { id: "site-content-journey", label: "How It Works" },
  { id: "site-content-whyChooseUs", label: "Why Choose Us" },
  { id: "site-content-importPage", label: "Import Page" },
  { id: "site-content-clearingPage", label: "Clearing Page" },
  { id: "site-content-hirePage", label: "Hire Page" },
  { id: "site-content-pricing", label: "Currency & Prices" },
  { id: "site-content-theme", label: "Theme" },
  { id: "site-content-importCalculator", label: "Import Estimator" },
  { id: "site-content-contact", label: "Contact Info" },
  { id: "site-content-footer", label: "Footer" },
  { id: "site-content-pageHeadings", label: "Page Headings" },
  { id: "site-content-homeSections", label: "Homepage Sections" },
  { id: "site-content-social", label: "Social Links" },
  { id: "site-content-about", label: "About Page" },
  { id: "site-content-company", label: "Company Story" },
  { id: "site-content-team", label: "Team" },
  { id: "site-content-clients", label: "Clients" },
  { id: "site-content-fleet", label: "Fleet" },
  { id: "site-content-seo", label: "SEO" },
];

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
  // After "Load company profile" the section forms must restart from the new content
  // (they keep their own local state), so they are remounted once it has been refetched.
  const [formsVersion, setFormsVersion] = useState(0);
  const [reloadPending, setReloadPending] = useState(false);
  useEffect(() => {
    if (reloadPending) {
      setFormsVersion((v) => v + 1);
      setReloadPending(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content]);
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
        <>
          <LoadProfileButton
            onDone={() => {
              setReloadPending(true);
              refresh();
            }}
          />
          <nav className="site-content-jumpnav" aria-label="Jump to section">
            {SECTION_LINKS.map((link) => (
              <a key={link.id} href={`#${link.id}`}>
                {link.label}
              </a>
            ))}
          </nav>
          <div className="site-content-sections" key={formsVersion}>
            <HeroSection initial={content.hero} onSaved={refresh} />
            <ServicesSection initial={content.services} onSaved={refresh} />
            <JourneySection initial={content.journey} onSaved={refresh} />
            <WhyChooseUsSection initial={content.whyChooseUs} onSaved={refresh} />
            <ImportPageSection initial={content.importPage} onSaved={refresh} />
            <ClearingPageSection initial={content.clearingPage} onSaved={refresh} />
            <HirePageSection initial={content.hirePage} onSaved={refresh} />
            <PricingSettings />
            <ThemeSettings initial={content.theme} onSaved={refresh} />
            <ImportCalculatorSettings initial={content.importCalculator} onSaved={refresh} />
            <ContactSection initial={content.contact} onSaved={refresh} />
            <FooterSection initial={content.footer} onSaved={refresh} />
            <PageHeadingsSection initial={content.pageHeadings} onSaved={refresh} />
            <HomeSectionsSection initial={content.homeSections} onSaved={refresh} />
            <SocialSection initial={content.social} onSaved={refresh} />
            <AboutSection initial={content.about} onSaved={refresh} />
            <CompanySection initial={content.company} onSaved={refresh} />
            <TeamSectionEditor initial={content.team} onSaved={refresh} />
            <ClientsSectionEditor initial={content.clients} onSaved={refresh} />
            <FleetSectionEditor initial={content.fleet} onSaved={refresh} />
            <SeoSection initial={content.seo} onSaved={refresh} />
          </div>
        </>
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
    <form id="site-content-hero" className="form-card" onSubmit={handleSubmit} noValidate>
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
          footer={
            <AiWriteButton
              kind="site-text"
              hint="Homepage introduction paragraph"
              defaultTone="professional"
              current={values.body}
              onApply={(text) => setValues({ ...values, body: text })}
            />
          }
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
    <form id="site-content-services" className="form-card" onSubmit={handleSubmit} noValidate>
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
    <form id="site-content-journey" className="form-card" onSubmit={handleSubmit} noValidate>
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
    <form id="site-content-whyChooseUs" className="form-card" onSubmit={handleSubmit} noValidate>
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
    <form id="site-content-contact" className="form-card" onSubmit={handleSubmit} noValidate>
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
        <FormField
          id="contact-map"
          label="Map location (optional — leave blank to use the address above; clear the address too to hide the map)"
          value={values.mapQuery ?? ""}
          onChange={(e) => setValues({ ...values, mapQuery: e.target.value || null })}
          placeholder="e.g. Lilongwe City Mall, Lilongwe   or   -13.9626, 33.7741"
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
    <form id="site-content-social" className="form-card" onSubmit={handleSubmit} noValidate>
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
    <form id="site-content-about" className="form-card" onSubmit={handleSubmit} noValidate>
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
          footer={
            <AiWriteButton
              kind="site-text"
              hint="Short introduction for the About page"
              defaultTone="professional"
              current={values.intro}
              onApply={(text) => setValues({ ...values, intro: text })}
            />
          }
        />
        <FormField
          id="about-whatWeDo"
          label="What We Do"
          as="textarea"
          value={values.whatWeDo}
          onChange={(e) => setValues({ ...values, whatWeDo: e.target.value })}
          footer={
            <AiWriteButton
              kind="site-text"
              hint="What Lycie Investments does, across sourcing, importing, sales, hire and clearing"
              defaultTone="professional"
              current={values.whatWeDo}
              onApply={(text) => setValues({ ...values, whatWeDo: text })}
            />
          }
        />
        <FormField
          id="about-howWeWork"
          label="How We Work With Customers"
          as="textarea"
          value={values.howWeWork}
          onChange={(e) => setValues({ ...values, howWeWork: e.target.value })}
          footer={
            <AiWriteButton
              kind="site-text"
              hint="How we work with customers from first request to delivery"
              defaultTone="professional"
              current={values.howWeWork}
              onApply={(text) => setValues({ ...values, howWeWork: text })}
            />
          }
        />
        <FormField
          id="about-whyChooseUs"
          label="Why Work With Us"
          as="textarea"
          value={values.whyChooseUs}
          onChange={(e) => setValues({ ...values, whyChooseUs: e.target.value })}
          footer={
            <AiWriteButton
              kind="site-text"
              hint="Why customers should choose Lycie Investments"
              defaultTone="professional"
              current={values.whyChooseUs}
              onApply={(text) => setValues({ ...values, whyChooseUs: text })}
            />
          }
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
    <form id="site-content-seo" className="form-card" onSubmit={handleSubmit} noValidate>
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
          id="seo-twitterHandle"
          label="X (Twitter) handle — e.g. @lycieinvestments"
          value={values.twitterHandle ?? ""}
          onChange={(e) => setValues({ ...values, twitterHandle: e.target.value || null })}
        />
        <FormField
          id="seo-google"
          label="Google Search Console verification code"
          value={values.googleVerification ?? ""}
          onChange={(e) => setValues({ ...values, googleVerification: e.target.value || null })}
          placeholder="the content=… value of the google-site-verification tag"
        />
        <FormField
          id="seo-bing"
          label="Bing Webmaster Tools verification code"
          value={values.bingVerification ?? ""}
          onChange={(e) => setValues({ ...values, bingVerification: e.target.value || null })}
        />
        <div className="form-field form-grid__full">
          <label>Sharing picture (shown when a page is shared on Facebook, WhatsApp, X…)</label>
          <ImageUploader images={values.ogImage ? [values.ogImage] : []} onChange={(images) => setValues({ ...values, ogImage: images[0] ?? null })} multiple={false} />
          <p className="form-field__hint">Use a landscape picture about 1200 × 630. Pages with their own photo (vehicles, blog posts) use that instead.</p>
        </div>
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

function ImportPageSection({ initial, onSaved }: { initial: ServicePageContent; onSaved: () => void }) {
  const [values, setValues] = useState<ServicePageContent>(initial);
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("saving");
    setError(null);
    try {
      await adminApi.patch("/site-content/importPage", { value: values });
      setStatus("success");
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save the Import page.");
      setStatus("error");
    }
  }

  return (
    <form id="site-content-importPage" className="form-card" onSubmit={handleSubmit} noValidate>
      <h2>Import Page</h2>
      <p className="text-muted">The headline and intro text at the top of /import.</p>
      {status === "success" && (
        <FormStatusBanner status="success" successMessage="Import page updated." errorMessage={null} />
      )}
      {status === "error" && <FormStatusBanner status="error" successMessage="" errorMessage={error} />}

      <div className="form-grid">
        <FormField
          id="importPage-heading"
          label="Headline"
          as="textarea"
          value={values.heading}
          onChange={(e) => setValues({ ...values, heading: e.target.value })}
        />
        <FormField
          id="importPage-body"
          label="Intro text"
          as="textarea"
          value={values.body}
          onChange={(e) => setValues({ ...values, body: e.target.value })}
        />
      </div>

      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={status === "saving"}>
          {status === "saving" ? "Saving…" : "Save Import Page"}
        </button>
      </div>
    </form>
  );
}

function ClearingPageSection({ initial, onSaved }: { initial: ClearingPageContent; onSaved: () => void }) {
  const [values, setValues] = useState<ClearingPageContent>(initial);
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("saving");
    setError(null);
    try {
      await adminApi.patch("/site-content/clearingPage", { value: values });
      setStatus("success");
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save the Clearing page.");
      setStatus("error");
    }
  }

  function updateArea(index: number, value: string) {
    const areas = values.areas.map((area, i) => (i === index ? value : area));
    setValues({ ...values, areas });
  }

  return (
    <form id="site-content-clearingPage" className="form-card" onSubmit={handleSubmit} noValidate>
      <h2>Clearing Page</h2>
      <p className="text-muted">The headline, disclaimer, and areas-of-support list on /clearing.</p>
      {status === "success" && (
        <FormStatusBanner status="success" successMessage="Clearing page updated." errorMessage={null} />
      )}
      {status === "error" && <FormStatusBanner status="error" successMessage="" errorMessage={error} />}

      <div className="form-grid">
        <FormField
          id="clearingPage-heading"
          label="Headline"
          as="textarea"
          value={values.heading}
          onChange={(e) => setValues({ ...values, heading: e.target.value })}
        />
        <FormField
          id="clearingPage-body"
          label="Intro text"
          as="textarea"
          value={values.body}
          onChange={(e) => setValues({ ...values, body: e.target.value })}
        />
        <FormField
          id="clearingPage-disclaimer"
          label="Disclaimer (shown on the dark hero background)"
          as="textarea"
          value={values.disclaimer}
          onChange={(e) => setValues({ ...values, disclaimer: e.target.value })}
        />
      </div>

      <fieldset className="site-content-fieldset">
        <legend>Areas of support</legend>
        <div className="form-grid form-grid--2col">
          {values.areas.map((area, index) => (
            <FormField
              key={index}
              id={`clearingPage-area-${index}`}
              label={`Area ${index + 1}`}
              value={area}
              onChange={(e) => updateArea(index, e.target.value)}
            />
          ))}
        </div>
      </fieldset>

      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={status === "saving"}>
          {status === "saving" ? "Saving…" : "Save Clearing Page"}
        </button>
      </div>
    </form>
  );
}

function HirePageSection({ initial, onSaved }: { initial: ServicePageContent; onSaved: () => void }) {
  const [values, setValues] = useState<ServicePageContent>(initial);
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("saving");
    setError(null);
    try {
      await adminApi.patch("/site-content/hirePage", { value: values });
      setStatus("success");
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save the Hire page.");
      setStatus("error");
    }
  }

  return (
    <form id="site-content-hirePage" className="form-card" onSubmit={handleSubmit} noValidate>
      <h2>Hire Page</h2>
      <p className="text-muted">The headline and intro text at the top of /hire.</p>
      {status === "success" && (
        <FormStatusBanner status="success" successMessage="Hire page updated." errorMessage={null} />
      )}
      {status === "error" && <FormStatusBanner status="error" successMessage="" errorMessage={error} />}

      <div className="form-grid">
        <FormField
          id="hirePage-heading"
          label="Headline"
          as="textarea"
          value={values.heading}
          onChange={(e) => setValues({ ...values, heading: e.target.value })}
        />
        <FormField
          id="hirePage-body"
          label="Intro text"
          as="textarea"
          value={values.body}
          onChange={(e) => setValues({ ...values, body: e.target.value })}
        />
      </div>

      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={status === "saving"}>
          {status === "saving" ? "Saving…" : "Save Hire Page"}
        </button>
      </div>
    </form>
  );
}


/** Small helper: every section editor below saves the same way (PATCH /site-content/<key>) and shows the same banners. */
function useSectionSave<T>(sectionKey: string, values: T, onSaved: () => void, failureText: string) {
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function save(e: FormEvent) {
    e.preventDefault();
    setStatus("saving");
    setError(null);
    try {
      await adminApi.patch(`/site-content/${sectionKey}`, { value: values });
      setStatus("success");
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : failureText);
      setStatus("error");
    }
  }
  return { status, error, save };
}

/** Footer: the line under the logo and the wording after the © year. */
function FooterSection({ initial, onSaved }: { initial: FooterContent; onSaved: () => void }) {
  const [values, setValues] = useState<FooterContent>(initial);
  const { status, error, save } = useSectionSave("footer", values, onSaved, "Failed to save the footer.");

  return (
    <form id="site-content-footer" className="form-card" onSubmit={save} noValidate>
      <h2>Footer</h2>
      <p className="text-muted">The copyright line always reads "© (this year) Lycie Investments." followed by the text below.</p>
      {status === "success" && <FormStatusBanner status="success" successMessage="Footer updated." errorMessage={null} />}
      {status === "error" && <FormStatusBanner status="error" successMessage="" errorMessage={error} />}
      <div className="form-grid form-grid--2col">
        <FormField id="footer-tagline" label="Tagline under the logo" value={values.tagline} onChange={(e) => setValues({ ...values, tagline: e.target.value })} />
        <FormField id="footer-rights" label="Text after the copyright" value={values.rightsText} onChange={(e) => setValues({ ...values, rightsText: e.target.value })} />
      </div>
      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={status === "saving"}>
          {status === "saving" ? "Saving…" : "Save Footer"}
        </button>
      </div>
    </form>
  );
}

const PAGE_HEADING_LABELS: Record<keyof PageHeadingsContent, string> = {
  vehicles: "Vehicles page",
  contact: "Contact page",
  faq: "FAQ page",
  blog: "Blog page",
  reviews: "Reviews page",
  login: "Customer sign-in page",
  register: "Customer sign-up page",
};

/** The big title + intro line at the top of pages that don't have an editor of their own. */
function PageHeadingsSection({ initial, onSaved }: { initial: PageHeadingsContent; onSaved: () => void }) {
  const [values, setValues] = useState<PageHeadingsContent>(initial);
  const { status, error, save } = useSectionSave("pageHeadings", values, onSaved, "Failed to save the page headings.");

  return (
    <form id="site-content-pageHeadings" className="form-card" onSubmit={save} noValidate>
      <h2>Page Headings</h2>
      <p className="text-muted">The title and intro line shown in the blue banner at the top of each page.</p>
      {status === "success" && <FormStatusBanner status="success" successMessage="Page headings updated." errorMessage={null} />}
      {status === "error" && <FormStatusBanner status="error" successMessage="" errorMessage={error} />}
      {(Object.keys(PAGE_HEADING_LABELS) as Array<keyof PageHeadingsContent>).map((key) => (
        <fieldset className="site-content-fieldset" key={key}>
          <legend>{PAGE_HEADING_LABELS[key]}</legend>
          <div className="form-grid form-grid--2col">
            <FormField
              id={`pageHeadings-${key}-heading`}
              label="Heading"
              value={values[key].heading}
              onChange={(e) => setValues({ ...values, [key]: { ...values[key], heading: e.target.value } })}
            />
            <FormField
              id={`pageHeadings-${key}-body`}
              label="Intro line"
              value={values[key].body}
              onChange={(e) => setValues({ ...values, [key]: { ...values[key], body: e.target.value } })}
            />
          </div>
        </fieldset>
      ))}
      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={status === "saving"}>
          {status === "saving" ? "Saving…" : "Save Page Headings"}
        </button>
      </div>
    </form>
  );
}

/** Headings of homepage sections whose content lives elsewhere (FAQ list, testimonials) plus the closing call-to-action. */
function HomeSectionsSection({ initial, onSaved }: { initial: HomeSectionsContent; onSaved: () => void }) {
  const [values, setValues] = useState<HomeSectionsContent>(initial);
  const { status, error, save } = useSectionSave("homeSections", values, onSaved, "Failed to save the homepage sections.");

  return (
    <form id="site-content-homeSections" className="form-card" onSubmit={save} noValidate>
      <h2>Homepage Sections</h2>
      <p className="text-muted">Headings above the FAQ, testimonials and contact cards, and the closing call-to-action banner.</p>
      {status === "success" && <FormStatusBanner status="success" successMessage="Homepage sections updated." errorMessage={null} />}
      {status === "error" && <FormStatusBanner status="error" successMessage="" errorMessage={error} />}

      <fieldset className="site-content-fieldset">
        <legend>FAQ</legend>
        <div className="form-grid form-grid--2col">
          <FormField id="home-faq-eyebrow" label="Eyebrow" value={values.faq.eyebrow} onChange={(e) => setValues({ ...values, faq: { ...values.faq, eyebrow: e.target.value } })} />
          <FormField id="home-faq-heading" label="Heading" value={values.faq.heading} onChange={(e) => setValues({ ...values, faq: { ...values.faq, heading: e.target.value } })} />
        </div>
      </fieldset>

      <fieldset className="site-content-fieldset">
        <legend>Testimonials</legend>
        <div className="form-grid form-grid--2col">
          <FormField id="home-testimonials-eyebrow" label="Eyebrow" value={values.testimonials.eyebrow} onChange={(e) => setValues({ ...values, testimonials: { ...values.testimonials, eyebrow: e.target.value } })} />
          <FormField id="home-testimonials-heading" label="Heading" value={values.testimonials.heading} onChange={(e) => setValues({ ...values, testimonials: { ...values.testimonials, heading: e.target.value } })} />
        </div>
      </fieldset>

      <fieldset className="site-content-fieldset">
        <legend>Contact cards (call / email / visit)</legend>
        <div className="form-grid form-grid--2col">
          <FormField id="home-cards-eyebrow" label="Eyebrow" value={values.contactCards.eyebrow} onChange={(e) => setValues({ ...values, contactCards: { ...values.contactCards, eyebrow: e.target.value } })} />
          <FormField id="home-cards-heading" label="Heading" value={values.contactCards.heading} onChange={(e) => setValues({ ...values, contactCards: { ...values.contactCards, heading: e.target.value } })} />
          <FormField id="home-cards-body" label="Intro" wrapperClassName="form-grid__full" value={values.contactCards.body} onChange={(e) => setValues({ ...values, contactCards: { ...values.contactCards, body: e.target.value } })} />
        </div>
      </fieldset>

      <fieldset className="site-content-fieldset">
        <legend>Closing call-to-action banner</legend>
        <div className="form-grid form-grid--2col">
          <FormField id="home-cta-heading" label="Heading" value={values.cta.heading} onChange={(e) => setValues({ ...values, cta: { ...values.cta, heading: e.target.value } })} />
          <FormField id="home-cta-body" label="Text" value={values.cta.body} onChange={(e) => setValues({ ...values, cta: { ...values.cta, body: e.target.value } })} />
          <FormField id="home-cta-primary" label="Main button label (goes to Vehicles)" value={values.cta.primaryLabel} onChange={(e) => setValues({ ...values, cta: { ...values.cta, primaryLabel: e.target.value } })} />
          <FormField id="home-cta-secondary" label="Second button label (goes to Contact)" value={values.cta.secondaryLabel} onChange={(e) => setValues({ ...values, cta: { ...values.cta, secondaryLabel: e.target.value } })} />
        </div>
      </fieldset>

      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={status === "saving"}>
          {status === "saving" ? "Saving…" : "Save Homepage Sections"}
        </button>
      </div>
    </form>
  );
}
