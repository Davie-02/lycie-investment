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
