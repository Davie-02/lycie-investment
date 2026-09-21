/** A deal as visitors see it (GET /api/deals). Never includes how-to-get notes or where it was found. */
export interface PublicDeal {
  id: string;
  title: string;
  summary: string;
  priceUsd: number | null;
  vehicleLabel: string | null;
  validUntil: string | null;
}

export type DealStatus = "NEW" | "PUBLISHED" | "DISMISSED";

/** A deal in the admin, with the staff-only details. */
export interface AdminDeal extends PublicDeal {
  status: DealStatus;
  origin: "ai" | "manual";
  howToGet: string;
  sources: string[];
  createdAt: string;
  publishedAt: string | null;
}
