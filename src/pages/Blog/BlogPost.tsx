import { useParams, Link } from "react-router-dom";
import Seo from "@/components/common/Seo";
import { useAsyncData } from "@/hooks/useAsyncData";
import { getBlogPostBySlug } from "@/services/blog.service";
import Img from "@/components/common/Img";
import LikeButton from "@/components/common/LikeButton";

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>();
  const { data: post, isLoading, error } = useAsyncData(() => getBlogPostBySlug(slug ?? ""), [slug], ["blog-posts"]);

  if (isLoading) {
    return (
      <section className="section container">
        <p className="text-muted">Loading post…</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="section container">
        <p className="text-muted" role="alert">
          Unable to load this post. Please try again.
        </p>
      </section>
    );
  }

  if (!post) {
    return (
      <section className="section container">
        <div className="section-heading">
          <h1>Post not found</h1>
          <p>This post may have been unpublished or the link may be incorrect.</p>
        </div>
        <Link to="/blog" className="btn btn-secondary">
          Back to Blog
        </Link>
      </section>
    );
  }

  return (
    <>
      <Seo title={post.seoTitle ?? post.title} description={post.seoDescription ?? post.excerpt ?? post.title} />

      <article className="section container blog-post">
        <Link to="/blog" className="blog-post__back">
          ← Back to Blog
        </Link>
        {post.publishedAt && (
          <span className="text-muted mono blog-post__date">{formatDate(post.publishedAt)}</span>
        )}
        <h1>{post.title}</h1>
        <div className="blog-post__actions">
          <LikeButton kind="blog" targetId={post.id} noun="post" />
        </div>
        {post.coverImageUrl && (
          <Img
            src={post.coverImageUrl}
            alt={post.coverAlt ?? ""}
            sizes="(min-width: 900px) 760px, 100vw"
            priority
            className="blog-post__cover"
          />
        )}
        <div className="blog-post__body">{post.body}</div>
      </article>
    </>
  );
}
