import Seo from "@/components/common/Seo";
import { useSiteContent } from "@/context/SiteContentContext";
import ReviewsSection from "@/components/reviews/ReviewsSection";

export default function Reviews() {
  const { content } = useSiteContent();
  return (
    <>
      <Seo
        title="Customer Reviews"
        description="Read what customers say about Lycie Investments, and share your own experience."
      />

      <section className="service-hero">
        <div className="container">
          <h1>{content.pageHeadings.reviews.heading}</h1>
          <p>{content.pageHeadings.reviews.body}</p>
        </div>
      </section>

      <section className="section container">
        <ReviewsSection heading="Reviews of Lycie Investments" />
      </section>
    </>
  );
}
