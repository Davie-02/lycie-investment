import { useState, type FormEvent } from "react";
import FormField from "@/components/forms/FormField";
import FormStatusBanner from "@/components/forms/FormStatusBanner";
import ImageUploader from "./ImageUploader";
import { adminApi } from "../adminApi";
import { ApiError } from "@/services/http";
import type { Testimonial } from "@/types/testimonial";

interface TestimonialFormProps {
  testimonial: Testimonial | null;
  onSaved: () => void;
  onCancel: () => void;
}

export default function TestimonialForm({ testimonial, onSaved, onCancel }: TestimonialFormProps) {
  const [quote, setQuote] = useState(testimonial?.quote ?? "");
  const [authorName, setAuthorName] = useState(testimonial?.authorName ?? "");
  const [authorTitle, setAuthorTitle] = useState(testimonial?.authorTitle ?? "");
  const [authorPhotoUrl, setAuthorPhotoUrl] = useState<string | null>(testimonial?.authorPhotoUrl ?? null);
  const [rating, setRating] = useState(testimonial?.rating ?? 5);
  const [isFeatured, setIsFeatured] = useState(testimonial?.isFeatured ?? false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!quote.trim() || !authorName.trim()) {
      setError("Quote and author name are required.");
      return;
    }
    setError(null);
    setIsSaving(true);

    const payload = {
      quote,
      authorName,
      authorTitle: authorTitle || null,
      authorPhotoUrl,
      rating,
      isFeatured,
    };

    try {
      if (testimonial) {
        await adminApi.patch(`/testimonials/${testimonial.id}`, payload);
      } else {
        await adminApi.post("/testimonials", payload);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save testimonial.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className="form-card" onSubmit={handleSubmit} noValidate>
      <h2>{testimonial ? "Edit Testimonial" : "Add a Testimonial"}</h2>

      {error && <FormStatusBanner status="error" successMessage="" errorMessage={error} />}

      <div className="form-grid form-grid--2col">
        <FormField
          id="testimonial-authorName"
          label="Author Name"
          required
          value={authorName}
          onChange={(e) => setAuthorName(e.target.value)}
        />
        <FormField
          id="testimonial-authorTitle"
          label="Author Title (optional)"
          value={authorTitle}
          onChange={(e) => setAuthorTitle(e.target.value)}
          placeholder="e.g. Repeat customer, Lilongwe"
        />

        <FormField
          id="testimonial-rating"
          label="Rating"
          as="select"
          value={String(rating)}
          onChange={(e) => setRating(Number(e.target.value))}
        >
          {[5, 4, 3, 2, 1].map((value) => (
            <option key={value} value={value}>
              {value} star{value === 1 ? "" : "s"}
            </option>
          ))}
        </FormField>

        <FormField
          id="testimonial-isFeatured"
          label="Featured"
          as="select"
          value={isFeatured ? "true" : "false"}
          onChange={(e) => setIsFeatured(e.target.value === "true")}
        >
          <option value="false">No</option>
          <option value="true">Yes — shown first on the homepage</option>
        </FormField>

        <FormField
          id="testimonial-quote"
          label="Quote"
          as="textarea"
          required
          value={quote}
          onChange={(e) => setQuote(e.target.value)}
          wrapperClassName="form-grid__full"
        />

        <div className="form-field form-grid__full">
          <label>Author Photo (optional)</label>
          <ImageUploader
            images={authorPhotoUrl ? [authorPhotoUrl] : []}
            onChange={(images) => setAuthorPhotoUrl(images[0] ?? null)}
            multiple={false}
          />
        </div>
      </div>

      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={isSaving}>
          {isSaving ? "Saving…" : testimonial ? "Save Changes" : "Add Testimonial"}
        </button>
        <button type="button" className="btn-ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
