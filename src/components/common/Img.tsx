import { useState, type ImgHTMLAttributes } from "react";
import { resolveUploadUrl } from "@/utils/resolveUploadUrl";

const UPLOADED_WEBP = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp/;

/** Address of a smaller copy of an uploaded image (the server makes -w480 and -w960 on upload). */
export function variantUrl(url: string, width: number): string {
  return url.replace(/\.webp(\?.*)?$/, `-w${width}.webp$1`);
}

interface ImgProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "srcSet"> {
  src: string;
  /** How wide the image is drawn, e.g. "(min-width: 900px) 33vw, 100vw". */
  sizes?: string;
  /** Above-the-fold image: load first instead of lazily. */
  priority?: boolean;
}

/**
 * An image that downloads only as many pixels as the screen needs.
 *
 * Uploaded photos come in three sizes, so phones and list grids fetch the
 * small ones. Photos uploaded before that existed (and external URLs) have
 * no smaller copy — if a size 404s we quietly fall back to the original, so
 * an image never appears broken.
 */
export default function Img({ src, sizes = "100vw", priority = false, alt, ...rest }: ImgProps) {
  const [useOriginal, setUseOriginal] = useState(false);
  const full = resolveUploadUrl(src);
  const responsive = !useOriginal && UPLOADED_WEBP.test(src);

  return (
    <img
      {...rest}
      alt={alt}
      src={full}
      srcSet={
        responsive
          ? `${resolveUploadUrl(variantUrl(src, 480))} 480w, ${resolveUploadUrl(variantUrl(src, 960))} 960w, ${full} 2000w`
          : undefined
      }
      sizes={responsive ? sizes : undefined}
      loading={priority ? "eager" : "lazy"}
      decoding={priority ? "sync" : "async"}
      {...(priority ? ({ fetchpriority: "high" } as object) : {})}
      onError={(event) => {
        if (responsive) setUseOriginal(true);
        rest.onError?.(event);
      }}
    />
  );
}
