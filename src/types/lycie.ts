export type ChatOutcome = "answered" | "no_info" | "unavailable" | "blocked" | "limited";

export interface LycieVehicleCard {
  slug: string;
  label: string;
  price: number;
  currency: string;
  image: string | null;
  status: string;
}

export interface LycieChatResponse {
  reply: string;
  vehicles: LycieVehicleCard[];
  outcome: ChatOutcome;
  logId: string | null;
}

export type KnowledgeCategory = "faq" | "policy" | "process" | "pricing" | "other";

export interface KnowledgeEntry {
  id: string;
  title: string;
  category: KnowledgeCategory;
  content: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeList {
  items: KnowledgeEntry[];
  faqCount: number;
  activeChars: number;
  budgetChars: number;
}

export interface LycieLogEntry {
  id: string;
  question: string;
  answer: string;
  model: string | null;
  outcome: ChatOutcome;
  helpful: boolean | null;
  createdAt: string;
}

export interface LycieAnalytics {
  days: number;
  total: number;
  outcomes: Partial<Record<ChatOutcome, number>>;
  helpful: number;
  notHelpful: number;
  gaps: LycieLogEntry[];
  recent: LycieLogEntry[];
}

export interface VisitorSubmission {
  id: string;
  kind: "question" | "comment";
  message: string;
  sentiment: "positive" | "neutral" | "negative" | null;
  status: "new" | "handled";
  createdAt: string;
}

export interface SubmissionList {
  items: VisitorSubmission[];
  newCount: number;
}

export interface TopTopic {
  representative: string;
  count: number;
  samples: string[];
  keywords: string[];
  covered: boolean;
  suggestionId: string | null;
}

export interface FaqSuggestion {
  id: string;
  question: string;
  answer: string;
  category: string | null;
  askCount: number;
  samples: string[];
  needsInput: boolean;
  status: "pending" | "published" | "rejected";
  model: string | null;
  createdAt: string;
}

export interface GenerateResult {
  topics: number;
  created: number;
  updated: number;
  aiUnavailable: boolean;
}

export interface KnowledgeDocument {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  charCount: number;
  isActive: boolean;
  createdAt: string;
  _count: { entries: number };
}

export interface KnowledgeDocumentDetail extends KnowledgeDocument {
  entries: Array<{ id: string; title: string; content: string }>;
}

export interface TestimonialIdea {
  id: string;
  source: "review" | "comment";
  sourceId: string;
  quote: string;
  authorName: string;
  rating: number | null;
  score: number;
  status: "pending" | "published" | "dismissed";
  createdAt: string;
}
