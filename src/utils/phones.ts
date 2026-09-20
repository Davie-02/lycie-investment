/** A contact field may hold several numbers ("+265 999 074 038 / +265 888 074 038"). */
export function splitPhones(value: string): Array<{ label: string; href: string | null }> {
  return value
    .split(/\s*(?:\/|,|;| or |\n)\s*/i)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((label) => {
      const digits = label.replace(/[^\d+]/g, "");
      const looksLikeNumber = digits.replace(/\D/g, "").length >= 7;
      return { label, href: looksLikeNumber ? `tel:${digits}` : null };
    });
}
