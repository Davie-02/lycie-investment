import { useEffect } from "react";
import { useLikes } from "@/context/LikesContext";
import type { LikeKind } from "@/services/likes.service";
import "@/components/vehicles/SaveVehicleButton.css";

interface LikeButtonProps {
  kind: LikeKind;
  targetId: string;
  className?: string;
  /** e.g. "vehicle", "post" — used in the accessible label. */
  noun?: string;
  /** Called after the visitor likes/unlikes (used to mirror into a customer's saved list). */
  onChange?: (liked: boolean) => void;
}

/** A heart that anyone can press — no account needed — with a live count. */
export default function LikeButton({ kind, targetId, className, noun = "item", onChange }: LikeButtonProps) {
  const { isLiked, count, register, toggle } = useLikes();
  useEffect(() => register(kind, targetId), [register, kind, targetId]);

  const liked = isLiked(kind, targetId);
  const total = count(kind, targetId);
  const label = liked ? `Unlike this ${noun}` : `Like this ${noun}`;

  return (
    <button
      type="button"
      className={`save-vehicle-btn${liked ? " save-vehicle-btn--saved" : ""}${className ? ` ${className}` : ""}`}
      onClick={(event) => {
        // Cards are often wrapped in links — a like must never navigate.
        event.preventDefault();
        event.stopPropagation();
        void toggle(kind, targetId).then((now) => onChange?.(now));
      }}
      aria-pressed={liked}
      aria-label={total > 0 ? `${label} (${total} likes)` : label}
      title={label}
    >
      <svg viewBox="0 0 24 24" className="save-vehicle-btn__icon" aria-hidden="true">
        <path d="M12 20.5s-7.5-4.6-10.2-9.3C.1 8.1 1.4 4.5 4.8 3.6c2.2-.6 4.3.3 5.6 2.1l1.6 2 1.6-2c1.3-1.8 3.4-2.7 5.6-2.1 3.4.9 4.7 4.5 3 7.6C19.5 15.9 12 20.5 12 20.5z" />
      </svg>
      {total > 0 && <span className="save-vehicle-btn__count">{total}</span>}
    </button>
  );
}
