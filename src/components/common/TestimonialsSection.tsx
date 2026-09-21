import { useSiteContent } from "@/context/SiteContentContext";
import { useAsyncData } from "@/hooks/useAsyncData";
import { getTestimonials } from "@/services/testimonials.service";
import { resolveUploadUrl } from "@/utils/resolveUploadUrl";

function Stars({ rating }: { rating: number }) {
  return (
    <span className="testimonials__stars" aria-label={`${rating} out of 5 stars`}>
      {"★".repeat(rating)}
      {"☆".repeat(5 - rating)}
    </span>
  );
}

/**
 * Managed via /admin — quietly doesn't render if there's no content yet,
 * same pattern as VehicleCarousel, so a site that hasn't added testimonials
 * yet doesn't show an empty/broken section.
 */
export default function TestimonialsSection() {
  const { content } = useSiteContent();
  const { data: testimonials, isLoading, error } = useAsyncData(getTestimonials, [], ["testimonials"]);

  if (isLoading || error || !testimonials || testimonials.length === 0) {
    return null;
  }

  return (
    <section className="section container testimonials">
      <div className="section-heading">
        <span className="eyebrow">{content.homeSections.testimonials.eyebrow}</span>
        <h2>{content.homeSections.testimonials.heading}</h2>
      </div>
      <div className="testimonials__grid">
        {testimonials.map((testimonial) => (
          <figure className="testimonials__card" key={testimonial.id}>
            <Stars rating={testimonial.rating} />
            <blockquote>&ldquo;{testimonial.quote}&rdquo;</blockquote>
            <figcaption>
              {testimonial.authorPhotoUrl && (
                <img src={resolveUploadUrl(testimonial.authorPhotoUrl)} alt="" aria-hidden="true" />
              )}
              <div>
                <span className="testimonials__author">{testimonial.authorName}</span>
                {testimonial.authorTitle && (
                  <span className="text-muted testimonials__author-title">
                    {testimonial.authorTitle}
                  </span>
                )}
              </div>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
