/**
 * Admin → Notices. Plugs the notice form and endpoints into the shared ContentManager
 * list.
 */
import ContentManager from "../components/ContentManager";
import NoticeForm from "../components/NoticeForm";
import { useAdminAuth } from "../context/AdminAuthContext";
import { NOTICE_TYPE_LABELS, NOTICE_TYPE_STYLES, type Notice } from "@/types/notice";

export default function AdminNotices() {
  const { currentUser } = useAdminAuth();
  const canEdit = currentUser?.role === "OWNER" || currentUser?.role === "MANAGER";

  return (
    <ContentManager<Notice>
      type="notices"
      title="Notices"
      noun="notice"
      intro="Site-wide banners and popups. Unpublish a notice when an offer ends and Duplicate it to run it again later."
      canEdit={canEdit}
      describe={(n) => n.title ?? n.message.slice(0, 40)}
      isLive={(n) => n.isActive && !n.archivedAt}
      isArchived={(n) => Boolean(n.archivedAt)}
      columns={[
        {
          header: "Type",
          render: (n) => {
            const style = NOTICE_TYPE_STYLES[n.type];
            return (
              <span className="admin-badge" style={{ color: style.text, borderColor: style.border, background: style.background }}>
                {NOTICE_TYPE_LABELS[n.type]}
              </span>
            );
          },
        },
        { header: "Show as", render: (n) => (n.displayAs === "banner" ? "Banner" : "Popup") },
        { header: "Message", render: (n) => `${n.title ? `${n.title}: ` : ""}${n.message}` },
      ]}
      renderForm={(item, onDone, onCancel) => <NoticeForm notice={item} onSaved={onDone} onCancel={onCancel} />}
    />
  );
}
