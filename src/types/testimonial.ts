export interface Testimonial {
  id: string;
  quote: string;
  authorName: string;
  authorTitle: string | null;
  authorPhotoUrl: string | null;
  rating: number;
  isFeatured: boolean;
  isPublished?: boolean;
  archivedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}
