import { Link } from "react-router-dom";
import Seo from "@/components/common/Seo";
import { useAsyncData } from "@/hooks/useAsyncData";
import { getBlogPosts } from "@/services/blog.service";
import { resolveUploadUrl } from "@/utils/resolveUploadUrl";

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

export default function BlogList() {
  const { data: posts, isLoading, error } = useAsyncData(getBlogPosts, []);

  return (
    <>
      <Seo title="Blog" description="News, guides and updates from Lycie Investments." />

      <section className="service-hero">
        <div className="container">
          <h1>Blog</h1>
          <p>News, guides and updates from the Lycie Investments team.</p>
        </div>
      </section>

      <section className="section container">
        {isLoading && <p className="text-muted">Loading posts…</p>}

        {error && (
          <p className="text-muted" role="alert">
            Unable to load blog posts. Please try again.
          </p>
        )}

        {posts && posts.length === 0 && <p className="text-muted">No posts have been published yet.</p>}

        {posts && posts.length > 0 && (
          <div className="blog-list">
            {posts.map((post) => (
              <article className="blog-card" key={post.id}>
                {post.coverImageUrl && (
                  <Link to={`/blog/${post.slug}`}>
                    <img
                      src={resolveUploadUrl(post.coverImageUrl)}
                      alt={post.coverAlt ?? ""}
                      className="blog-card__image"
                    />
                  </Link>
                )}
                <div className="blog-card__body">
                  {post.publishedAt && (
                    <span className="text-muted mono blog-card__date">{formatDate(post.publishedAt)}</span>
                  )}
                  <h2>
                    <Link to={`/blog/${post.slug}`}>{post.title}</Link>
                  </h2>
                  {post.excerpt && <p className="text-muted">{post.excerpt}</p>}
                  <Link to={`/blog/${post.slug}`} className="blog-card__link">
                    Read more →
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
