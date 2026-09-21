import { Link } from "react-router-dom";
import { useSiteContent } from "@/context/SiteContentContext";
import { useAsyncData } from "@/hooks/useAsyncData";
import { getFaqs } from "@/services/faq.service";

const HOMEPAGE_LIMIT = 5;

/**
 * Native <details>/<summary> gives us an accessible, keyboard-operable
 * accordion for free — no custom ARIA state management needed.
 */
export default function FaqSection() {
  const { content } = useSiteContent();
  const { data: faqs, isLoading, error } = useAsyncData(getFaqs, [], ["faq"]);

  if (isLoading || error || !faqs || faqs.length === 0) {
    return null;
  }

  const shown = faqs.slice(0, HOMEPAGE_LIMIT);

  return (
    <section className="section container faq-section">
      <div className="section-heading">
        <span className="eyebrow">{content.homeSections.faq.eyebrow}</span>
        <h2>{content.homeSections.faq.heading}</h2>
      </div>
      <div className="faq-section__list">
        {shown.map((faq) => (
          <details className="faq-item" key={faq.id}>
            <summary>{faq.question}</summary>
            <p className="text-muted">{faq.answer}</p>
          </details>
        ))}
      </div>
      {faqs.length > HOMEPAGE_LIMIT && (
        <Link to="/faq" className="btn btn-secondary faq-section__more">
          View all FAQs
        </Link>
      )}
    </section>
  );
}
