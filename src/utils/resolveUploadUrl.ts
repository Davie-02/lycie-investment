const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001/api";

/**
 * Vehicle/hire-vehicle images are stored as whatever URL the upload
 * endpoint returned — either an absolute URL (S3/R2/MinIO configured) or a
 * relative path like "/uploads/abc.jpg" (local disk storage, the default
 * when no object storage is configured). The frontend and backend run on
 * different origins/ports, so a relative path must be resolved against the
 * API's origin before it'll actually load — otherwise the browser requests
 * it from the frontend's own origin, where no such file exists, and the
 * image just shows broken everywhere it's displayed.
 */
export function resolveUploadUrl(path: string): string {
  if (!path) return path;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const origin = API_BASE_URL.replace(/\/api\/?$/, "");
  return `${origin}${path}`;
}
