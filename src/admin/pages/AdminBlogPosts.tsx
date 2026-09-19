import { useCallback, useState } from "react";
import { useAsyncData } from "@/hooks/useAsyncData";
import { adminApi } from "../adminApi";
import BlogPostForm from "../components/BlogPostForm";
import { ApiError } from "@/services/http";
import type { BlogPost } from "@/types/blogPost";
import "../components/AdminLayout.css";

type View = { mode: "list" } | { mode: "create" } | { mode: "edit"; post: BlogPost };

export default function AdminBlogPosts() {
  const [view, setView] = useState<View>({ mode: "list" });
  const [refreshKey, setRefreshKey] = useState(0);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: posts, isLoading, error } = useAsyncData(
    () => adminApi.get<BlogPost[]>("/blog-posts/all"),
    [refreshKey]
  );

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  async function handleDelete(post: BlogPost) {
    if (!window.confirm(`Delete "${post.title}"? This cannot be undone.`)) return;
    setActionError(null);
    try {
      await adminApi.delete(`/blog-posts/${post.id}`);
      refresh();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to delete blog post.");
    }
  }

  if (view.mode === "create") {
    return (
      <BlogPostForm
        post={null}
        onSaved={() => {
          setView({ mode: "list" });
          refresh();
        }}
        onCancel={() => setView({ mode: "list" })}
      />
    );
  }

  if (view.mode === "edit") {
    return (
      <BlogPostForm
        post={view.post}
        onSaved={() => {
          setView({ mode: "list" });
          refresh();
        }}
        onCancel={() => setView({ mode: "list" })}
      />
    );
  }

  return (
    <div>
      <div className="admin-toolbar">
        <h1>Blog</h1>
        <button type="button" className="btn btn-primary" onClick={() => setView({ mode: "create" })}>
          Add Blog Post
        </button>
      </div>

      {actionError && <p className="admin-error-text" role="alert">{actionError}</p>}
      {isLoading && <p className="text-muted">Loading posts…</p>}
      {error && <p className="text-muted" role="alert">Unable to load blog posts.</p>}

      {posts && posts.length === 0 && (
        <div className="admin-empty-state">No blog posts yet. Add one to publish it on /blog.</div>
      )}

      {posts && posts.length > 0 && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Slug</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {posts.map((post) => (
                <tr key={post.id}>
                  <td>{post.title}</td>
                  <td className="mono">{post.slug}</td>
                  <td>
                    <span className={`admin-badge ${post.publishedAt ? "admin-badge--available" : "admin-badge--reserved"}`}>
                      {post.publishedAt ? "Published" : "Draft"}
                    </span>
                  </td>
                  <td>
                    <div className="admin-table__actions">
                      <button type="button" className="btn-ghost" onClick={() => setView({ mode: "edit", post })}>
                        Edit
                      </button>
                      <button type="button" className="btn-ghost" onClick={() => handleDelete(post)}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
