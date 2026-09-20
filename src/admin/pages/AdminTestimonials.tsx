import ContentManager from "../components/ContentManager";
import TestimonialForm from "../components/TestimonialForm";
import { resolveUploadUrl } from "../adminApi";
import { useAdminAuth } from "../context/AdminAuthContext";
import type { Testimonial } from "@/types/testimonial";

export default function AdminTestimonials() {
  const { currentUser } = useAdminAuth();
  const canEdit = currentUser?.role === "OWNER" || currentUser?.role === "MANAGER";

  return (
    <ContentManager<Testimonial>
      type="testimonials"
      title="Testimonials"
      noun="testimonial"
      intro="Featured testimonials appear first. Lycie can suggest new ones from positive reviews — see Lycie AI → Testimonial ideas."
      canEdit={canEdit}
      describe={(t) => `${t.authorName}: ${t.quote.slice(0, 40)}`}
      isLive={(t) => t.isPublished !== false && !t.archivedAt}
      isArchived={(t) => Boolean(t.archivedAt)}
      columns={[
        {
          header: "Author",
          render: (t) => (
            <div className="admin-table__author">
              {t.authorPhotoUrl && <img src={resolveUploadUrl(t.authorPhotoUrl)} alt="" className="admin-table__avatar" />}
              <div>
                <strong>{t.authorName}</strong>
                {t.authorTitle && <div className="text-muted">{t.authorTitle}</div>}
              </div>
            </div>
          ),
        },
        { header: "Quote", render: (t) => (t.quote.length > 80 ? `${t.quote.slice(0, 80)}…` : t.quote) },
        { header: "Rating", render: (t) => <span className="mono">{t.rating} / 5</span> },
        { header: "Featured", render: (t) => (t.isFeatured ? "Yes" : "No") },
      ]}
      renderForm={(item, onDone, onCancel) => <TestimonialForm testimonial={item} onSaved={onDone} onCancel={onCancel} />}
    />
  );
}
