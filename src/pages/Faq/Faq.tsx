import { useMemo } from "react";
import Seo from "@/components/common/Seo";
import Reveal from "@/components/common/Reveal";
import { useAsyncData } from "@/hooks/useAsyncData";
import { getFaqs } from "@/services/faq.service";

export default function Faq() {
  const { data: faqs, isLoading, error } = useAsyncData(getFaqs, []);

  const groups = useMemo(() => {
    if (!faqs) return [];
    const byCategory = new Map<string, typeof faqs>();
    for (const faq of faqs) {
      const key = faq.category ?? "General";
      byCategory.set(key, [...(byCategory.get(key) ?? []), faq]);
    }
    return Array.from(byCategory.entries());
  }, [faqs]);

  return (
    <>
      <Seo
        title="FAQ"
        description="Answers to common questions about buying, importing, hiring and clearing vehicles with Lycie Investments."
      />

      <section className="service-hero">
        <div className="container">
          <h1>Frequently asked questions</h1>
          <p>Everything you need to know before getting started.</p>
        </div>
      </section>

      <section className="section container">
        {isLoading && <p className="text-muted">Loading questions…</p>}

        {error && (
          <p className="text-muted" role="alert">
            Unable to load FAQs. Please try again.
          </p>
        )}

        {faqs && faqs.length === 0 && (
          <p className="text-muted">No questions have been published yet.</p>
        )}

        {groups.map(([category, items], index) => (
          <Reveal key={category} delayMs={Math.min(index, 4) * 80}>
            <div className="faq-page__group">
              <h2>{category}</h2>
              <div className="faq-section__list">
                {items.map((faq) => (
                  <details className="faq-item" key={faq.id}>
                    <summary>{faq.question}</summary>
                    <p className="text-muted">{faq.answer}</p>
                  </details>
                ))}
              </div>
            </div>
          </Reveal>
        ))}
      </section>
    </>
  );
}
