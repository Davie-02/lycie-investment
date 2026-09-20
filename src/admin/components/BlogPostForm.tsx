import { useState, type FormEvent } from "react";
import FormField from "@/components/forms/FormField";
import FormStatusBanner from "@/components/forms/FormStatusBanner";
import ImageUploader from "./ImageUploader";
import { adminApi } from "../adminApi";
import { ApiError } from "@/services/http";
import type { BlogPost } from "@/types/blogPost";
import AiWriteButton from "./AiWriteButton";

interface BlogPostFormProps {
  post: BlogPost | null;
  onSaved: () => void;
  onCancel: () => void;
}

export default function BlogPostForm({ post, onSaved, onCancel }: BlogPostFormProps) {
  const [slug, setSlug] = useState(post?.slug ?? "");
  const [title, setTitle] = useState(post?.title ?? "");
  const [excerpt, setExcerpt] = useState(post?.excerpt ?? "");
  const [body, setBody] = useState(post?.body ?? "");
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(post?.coverImageUrl ?? null);
  const [coverAlt, setCoverAlt] = useState(post?.coverAlt ?? "");
  const [seoTitle, setSeoTitle] = useState(post?.seoTitle ?? "");
  const [seoDescription, setSeoDescription] = useState(post?.seoDescription ?? "");
  const [isPublished, setIsPublished] = useState(Boolean(post?.publishedAt));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!slug.trim() || !title.trim() || !body.trim()) {
      setError("Slug, title, and body are required.");
      return;
    }
    setError(null);
    setIsSaving(true);

    const payload = {
      slug,
      title,
      excerpt: excerpt || null,
      body,
      coverImageUrl,
      coverAlt: coverAlt || null,
      seoTitle: seoTitle || null,
      seoDescription: seoDescription || null,
      isPublished,
    };

    try {
      if (post) {
        await adminApi.patch(`/blog-posts/${post.id}`, payload);
      } else {
        await adminApi.post("/blog-posts", payload);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save blog post.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className="form-card" onSubmit={handleSubmit} noValidate>
      <h2>{post ? `Edit "${post.title}"` : "Add a Blog Post"}</h2>

      {error && <FormStatusBanner status="error" successMessage="" errorMessage={error} />}

      <div className="form-grid form-grid--2col">
        <FormField
          id="blog-title"
          label="Title"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <FormField
          id="blog-slug"
          label="Slug (used in the URL)"
          required
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="how-to-import-a-vehicle"
        />

        <FormField
          id="blog-isPublished"
          label="Status"
          as="select"
          value={isPublished ? "true" : "false"}
          onChange={(e) => setIsPublished(e.target.value === "true")}
        >
          <option value="false">Draft — hidden from the public site</option>
          <option value="true">Published</option>
        </FormField>

        <FormField
          id="blog-excerpt"
          label="Excerpt (optional — shown on the blog list)"
          as="textarea"
          value={excerpt}
          onChange={(e) => setExcerpt(e.target.value)}
          wrapperClassName="form-grid__full"
          footer={
            <AiWriteButton
              kind="blog-excerpt"
              current={excerpt}
              facts={() => `Post title: ${title}\nPost text: ${body.slice(0, 1500)}`}
              onApply={setExcerpt}
              maxChars={220}
            />
          }
        />
        <FormField
          id="blog-body"
          label="Body"
          as="textarea"
          required
          value={body}
          onChange={(e) => setBody(e.target.value)}
          wrapperClassName="form-grid__full"
          footer={
            <AiWriteButton
              kind="blog-body"
              current={body}
              hint={title ? `Write a post titled “${title}”` : ""}
              facts={() => (title ? `Post title: ${title}` : "")}
              defaultTone="professional"
              onApply={setBody}
            />
          }
        />

        <div className="form-field form-grid__full">
          <label>Cover Image (optional)</label>
          <ImageUploader
            images={coverImageUrl ? [coverImageUrl] : []}
            onChange={(images) => setCoverImageUrl(images[0] ?? null)}
            multiple={false}
          />
        </div>

        <FormField
          id="blog-coverAlt"
          label="Cover Image Alt Text (optional)"
          value={coverAlt}
          onChange={(e) => setCoverAlt(e.target.value)}
        />

        <FormField
          id="blog-seoTitle"
          label="SEO Title (optional — defaults to Title)"
          value={seoTitle}
          onChange={(e) => setSeoTitle(e.target.value)}
        />
        <FormField
          id="blog-seoDescription"
          label="SEO Description (optional — defaults to Excerpt)"
          as="textarea"
          value={seoDescription}
          onChange={(e) => setSeoDescription(e.target.value)}
          wrapperClassName="form-grid__full"
        />
      </div>

      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={isSaving}>
          {isSaving ? "Saving…" : post ? "Save Changes" : "Add Blog Post"}
        </button>
        <button type="button" className="btn-ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
