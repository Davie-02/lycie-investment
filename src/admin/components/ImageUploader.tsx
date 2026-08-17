import { useRef, useState, type ChangeEvent } from "react";
import { adminApi, resolveUploadUrl } from "../adminApi";
import { ApiError } from "@/services/http";
import "./AdminLayout.css";

interface ImageUploaderProps {
  images: string[];
  onChange: (images: string[]) => void;
  multiple?: boolean;
}

export default function ImageUploader({ images, onChange, multiple = true }: ImageUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setError(null);
    try {
      const uploaded: string[] = [];
      for (const file of Array.from(files)) {
        const result = await adminApi.uploadFile<{ url: string }>("/uploads", file);
        uploaded.push(result.url);
      }
      onChange(multiple ? [...images, ...uploaded] : uploaded);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Upload failed. Please try again.");
    } finally {
      setIsUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function handleRemove(index: number) {
    onChange(images.filter((_, i) => i !== index));
  }

  return (
    <div>
      {images.length > 0 && (
        <div className="admin-image-list">
          {images.map((url, index) => (
            <div className="admin-image-list__item" key={url + index}>
              <img src={resolveUploadUrl(url)} alt={`Upload ${index + 1}`} />
              <button
                type="button"
                className="admin-image-list__remove"
                onClick={() => handleRemove(index)}
                aria-label={`Remove image ${index + 1}`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple={multiple}
        onChange={handleFileChange}
        disabled={isUploading}
      />

      {isUploading && <p className="text-muted">Uploading…</p>}
      {error && (
        <p className="admin-error-text" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
