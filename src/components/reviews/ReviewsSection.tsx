/**
 * Shows approved customer reviews (company-wide, or for one vehicle) with a form to add
 * one. New reviews wait for admin approval, and the list refreshes live when an admin
 * approves one. Uses services/reviews.service.ts (/api/reviews).
 */
import { useEffect, useState, type FormEvent } from "react";
import FormField from "@/components/forms/FormField";
import FormStatusBanner from "@/components/forms/FormStatusBanner";
import { useCustomerAuth } from "@/context/CustomerAuthContext";
import { getReviews, submitReview } from "@/services/reviews.service";
import { subscribeLive } from "@/services/liveContent";
import { ApiError } from "@/services/http";
import type { PublicReviewList } from "@/types/review";
import "./ReviewsSection.css";

interface ReviewsSectionProps {
  /** Omit to show and collect reviews about the company itself. */
  vehicleId?: string;
  heading?: string;
}

function Stars({ value }: { value: number }) {
  return (
    <span className="reviews__stars" role="img" aria-label={`${value} out of 5 stars`}>
      {"★".repeat(value)}
      <span className="reviews__stars-empty">{"★".repeat(5 - value)}</span>
    </span>
  );
}

export default function ReviewsSection({ vehicleId, heading = "Customer reviews" }: ReviewsSectionProps) {
  const { currentUser } = useCustomerAuth();
  const [list, setList] = useState<PublicReviewList | null>(null);
  const [page, setPage] = useState(1);
  const [loadError, setLoadError] = useState(false);

  const [authorName, setAuthorName] = useState("");
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [errors, setErrors] = useState<{ authorName?: string; rating?: string; comment?: string }>({});
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadError(false);
    const load = () =>
      getReviews(vehicleId, page).then((data) => !cancelled && setList(data));
    load().catch(() => !cancelled && setLoadError(true));
    // An approved (or removed) review appears without a page reload.
    const unsubscribe = subscribeLive(["reviews"], () => void load().catch(() => undefined));
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [vehicleId, page]);

  // Pre-fill (but don't lock) the name for signed-in customers.
  useEffect(() => {
    if (currentUser?.name) setAuthorName((current) => current || currentUser.name);
  }, [currentUser]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const next: typeof errors = {};
    if (authorName.trim().length < 2) next.authorName = "Enter your name (at least 2 characters).";
    if (rating < 1) next.rating = "Choose a star rating.";
    if (comment.trim().length < 10) next.comment = "Tell us a little more (at least 10 characters).";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setStatus("submitting");
    setServerError(null);
    try {
      await submitReview({ authorName: authorName.trim(), rating, comment: comment.trim(), vehicleId });
      setStatus("success");
      setRating(0);
      setComment("");
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
      setStatus("error");
    }
  }

  const totalPages = list ? Math.max(1, Math.ceil(list.total / list.pageSize)) : 1;

  return (
    <section className="reviews" aria-labelledby="reviews-heading">
      <div className="reviews__header">
        <h2 id="reviews-heading">{heading}</h2>
        {list && list.total > 0 && list.averageRating !== null && (
          <p className="reviews__summary">
            <Stars value={Math.round(list.averageRating)} />
            <strong>{list.averageRating.toFixed(1)}</strong>
            <span className="text-muted">
              from {list.total} review{list.total === 1 ? "" : "s"}
            </span>
          </p>
        )}
      </div>

      {loadError && <p className="text-muted" role="alert">Reviews couldn't be loaded right now.</p>}
      {list && list.total === 0 && (
        <p className="text-muted">No reviews yet — be the first to share your experience.</p>
      )}

      {list && list.items.length > 0 && (
        <ul className="reviews__list">
          {list.items.map((review) => (
            <li className="reviews__item" key={review.id}>
              <div className="reviews__item-head">
                <Stars value={review.rating} />
                <strong>{review.authorName}</strong>
                <span className="text-muted mono">{new Date(review.createdAt).toLocaleDateString()}</span>
              </div>
              <p>{review.comment}</p>
            </li>
          ))}
        </ul>
      )}

      {totalPages > 1 && (
        <nav className="reviews__pager" aria-label="Review pages">
          <button type="button" className="btn-ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Previous
          </button>
          <span className="text-muted mono">
            Page {page} of {totalPages}
          </span>
          <button type="button" className="btn-ghost" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
            Next
          </button>
        </nav>
      )}

      <form className="form-card reviews__form" onSubmit={handleSubmit} noValidate>
        <h3>Share your experience</h3>

        {status === "success" && (
          <FormStatusBanner
            status="success"
            successMessage="Thank you! Your review has been received and will appear once our team has approved it."
            errorMessage={null}
          />
        )}
        {status === "error" && <FormStatusBanner status="error" successMessage="" errorMessage={serverError} />}

        <div className="form-grid">
          <FormField
            id={`review-name-${vehicleId ?? "company"}`}
            label="Your name"
            required
            value={authorName}
            maxLength={60}
            onChange={(e) => setAuthorName(e.target.value)}
            error={errors.authorName}
            autoComplete="name"
          />

          <fieldset className="reviews__rating" aria-describedby={errors.rating ? "review-rating-error" : undefined}>
            <legend>
              Rating<span className="form-field__required"> *</span>
            </legend>
            <div className="reviews__rating-options">
              {[1, 2, 3, 4, 5].map((value) => (
                <label key={value} className={value <= rating ? "reviews__star reviews__star--on" : "reviews__star"}>
                  <input
                    type="radio"
                    name={`rating-${vehicleId ?? "company"}`}
                    value={value}
                    checked={rating === value}
                    onChange={() => setRating(value)}
                  />
                  <span aria-hidden="true">★</span>
                  <span className="reviews__sr">{value} star{value === 1 ? "" : "s"}</span>
                </label>
              ))}
            </div>
            {errors.rating && (
              <p className="form-field__error" id="review-rating-error" role="alert">{errors.rating}</p>
            )}
          </fieldset>

          <FormField
            id={`review-comment-${vehicleId ?? "company"}`}
            label="Your review"
            as="textarea"
            required
            value={comment}
            maxLength={1000}
            onChange={(e) => setComment(e.target.value)}
            error={errors.comment}
          />
        </div>

        <div className="form-actions">
          <button className="btn btn-primary" type="submit" disabled={status === "submitting"}>
            {status === "submitting" ? "Submitting…" : "Submit Review"}
          </button>
        </div>
      </form>
    </section>
  );
}
