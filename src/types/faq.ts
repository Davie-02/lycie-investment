export interface Faq {
  id: string;
  question: string;
  answer: string;
  category: string | null;
  sortOrder: number;
  isPublished?: boolean;
  archivedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}
