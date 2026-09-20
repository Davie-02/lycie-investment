import { Link } from "react-router-dom";
import Seo from "@/components/common/Seo";
import Reveal from "@/components/common/Reveal";
import { useAsyncData } from "@/hooks/useAsyncData";
import { getBlogPosts } from "@/services/blog.service";
import Img from "@/components/common/Img";
import LikeButton from "@/components/common/LikeButton";

const STAGGER_STEP_MS = 60;
const STAGGER_CAP = 6;

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

export default function BlogList() {
  const { data: posts, isLoading, error } = useAsyncData(getBlogPosts, [], ["blog-posts"]);

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
            {posts.map((post, index) => (
              <Reveal key={post.id} delayMs={Math.min(index, STAGGER_CAP) * STAGGER_STEP_MS}>
                <article className="blog-card">
                  {post.coverImageUrl && (
                    <Link to={`/blog/${post.slug}`}>
                      <Img
                        src={post.coverImageUrl}
                        alt={post.coverAlt ?? ""}
                        sizes="(min-width: 900px) 380px, 100vw"
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
                    <div className="blog-card__footer">
                      <Link to={`/blog/${post.slug}`} className="blog-card__link">
                        Read more →
                      </Link>
                      <LikeButton kind="blog" targetId={post.id} noun="post" />
                    </div>
                  </div>
                </article>
              </Reveal>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
