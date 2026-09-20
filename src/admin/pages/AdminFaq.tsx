import ContentManager from "../components/ContentManager";
import FaqForm from "../components/FaqForm";
import { useAdminAuth } from "../context/AdminAuthContext";
import type { Faq } from "@/types/faq";

export default function AdminFaq() {
  const { currentUser } = useAdminAuth();
  const canEdit = currentUser?.role === "OWNER" || currentUser?.role === "MANAGER";

  return (
    <ContentManager<Faq>
      type="faq"
      title="FAQ"
      noun="FAQ"
      intro="Shown on the homepage (first 5) and the full /faq page, grouped by category. Lycie also uses every live FAQ when answering customers."
      canEdit={canEdit}
      describe={(f) => f.question}
      isLive={(f) => f.isPublished !== false && !f.archivedAt}
      isArchived={(f) => Boolean(f.archivedAt)}
      columns={[
        { header: "Order", render: (f) => <span className="mono">{f.sortOrder}</span> },
        { header: "Category", render: (f) => f.category ?? "—" },
        { header: "Question", render: (f) => f.question },
      ]}
      renderForm={(item, onDone, onCancel) => <FaqForm faq={item} onSaved={onDone} onCancel={onCancel} />}
    />
  );
}
