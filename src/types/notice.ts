export type NoticeType = "info" | "warning" | "success" | "promo";
export type NoticeDisplayMode = "banner" | "popup";

export interface Notice {
  id: string;
  title: string | null;
  message: string;
  type: NoticeType;
  displayAs: NoticeDisplayMode;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Single source of truth for notice colors, so "the color depends on the
 * type" is enforced by the design system rather than left to whoever's
 * creating a notice in the admin. Kept separate from the CSS custom
 * properties in variables.css since these are specifically the four notice
 * categories, not general brand colors.
 */
export const NOTICE_TYPE_STYLES: Record<NoticeType, { background: string; text: string; border: string }> = {
  info: { background: "#EAF4F9", text: "#175877", border: "#2E7A9C" },
  success: { background: "#EAF6EF", text: "#155C3B", border: "#1E7D4F" },
  warning: { background: "#FEF6E7", text: "#8A5A00", border: "#D99A2B" },
  promo: { background: "#FBEFE4", text: "#8A4419", border: "#C8722C" },
};

export const NOTICE_TYPE_LABELS: Record<NoticeType, string> = {
  info: "Info",
  success: "Success",
  warning: "Warning",
  promo: "Promo / Special Offer",
};
