import Seo from "@/components/common/Seo";
import ReviewsSection from "@/components/reviews/ReviewsSection";

export default function Reviews() {
  return (
    <>
      <Seo
        title="Customer Reviews"
        description="Read what customers say about Lycie Investments, and share your own experience."
      />

      <section className="service-hero">
        <div className="container">
          <h1>What our customers say</h1>
          <p>Honest feedback from people who've bought, hired, imported or cleared a vehicle with us.</p>
        </div>
      </section>

      <section className="section container">
        <ReviewsSection heading="Reviews of Lycie Investments" />
      </section>
    </>
  );
}
