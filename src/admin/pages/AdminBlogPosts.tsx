import ContentManager from "../components/ContentManager";
import BlogPostForm from "../components/BlogPostForm";
import { useAdminAuth } from "../context/AdminAuthContext";
import type { BlogPost } from "@/types/blogPost";

export default function AdminBlogPosts() {
  const { currentUser } = useAdminAuth();
  const canEdit = currentUser?.role === "OWNER" || currentUser?.role === "MANAGER";

  return (
    <ContentManager<BlogPost>
      type="blog-posts"
      title="Blog"
      noun="post"
      canEdit={canEdit}
      describe={(p) => p.title}
      isLive={(p) => Boolean(p.publishedAt) && !p.archivedAt}
      isArchived={(p) => Boolean(p.archivedAt)}
      columns={[
        { header: "Title", render: (p) => p.title },
        { header: "Slug", render: (p) => <span className="mono">{p.slug}</span> },
        {
          header: "Published",
          render: (p) => (p.publishedAt ? new Date(p.publishedAt).toLocaleDateString() : "—"),
        },
      ]}
      renderForm={(item, onDone, onCancel) => <BlogPostForm post={item} onSaved={onDone} onCancel={onCancel} />}
    />
  );
}
