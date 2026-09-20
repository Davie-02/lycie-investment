/**
 * A tiny, safe formatter for Lycie's replies. It understands exactly what her
 * prompt allows — paragraphs, "- " / "1. " lists, **bold** — and turns emails,
 * phone numbers and web addresses into tappable links. It produces plain data
 * (never HTML), so nothing the AI or a customer types can inject markup.
 */
export type Inline =
  | { type: "text"; text: string }
  | { type: "bold"; text: string }
  | { type: "link"; text: string; href: string };

export type Block =
  | { type: "p"; lines: Inline[][] }
  | { type: "ul"; items: Inline[][] }
  | { type: "ol"; items: Inline[][] };

const BULLET = /^\s*[-*•]\s+(.*)$/;
const NUMBERED = /^\s*\d+[.)]\s+(.*)$/;

// Order matters: earlier alternatives win. Phone numbers must start with "+" or a Malawi
// mobile prefix so prices like "MWK 12,800,000" are never mistaken for phone numbers.
const INLINE =
  /\*\*([^*\n]+)\*\*|([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})|(https?:\/\/[^\s<>()]+[^\s<>().,;:!?])|(\+\d[\d\s().-]{7,}\d|\b0[89]\d[\d\s.-]{6,}\d)/g;

export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  let last = 0;
  for (const match of text.matchAll(INLINE)) {
    const index = match.index ?? 0;
    if (index > last) out.push({ type: "text", text: text.slice(last, index) });
    const [whole, bold, email, url, phone] = match;
    if (bold !== undefined) out.push({ type: "bold", text: bold });
    else if (email) out.push({ type: "link", text: email, href: `mailto:${email}` });
    else if (url) out.push({ type: "link", text: url, href: url });
    else if (phone) out.push({ type: "link", text: phone, href: `tel:${phone.replace(/[^\d+]/g, "")}` });
    last = index + whole.length;
  }
  if (last < text.length) out.push({ type: "text", text: text.slice(last) });
  return out;
}

export function parseRichText(input: string): Block[] {
  const lines = input.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let list: { type: "ul" | "ol"; items: string[] } | null = null;

  const flushParagraph = () => {
    if (paragraph.length) blocks.push({ type: "p", lines: paragraph.map(parseInline) });
    paragraph = [];
  };
  const flushList = () => {
    if (list) blocks.push({ type: list.type, items: list.items.map(parseInline) });
    list = null;
  };

  for (const line of lines) {
    if (line.trim() === "") {
      flushParagraph();
      flushList();
      continue;
    }
    const bullet = line.match(BULLET);
    const numbered = bullet ? null : line.match(NUMBERED);
    if (bullet || numbered) {
      flushParagraph();
      const type = bullet ? "ul" : "ol";
      if (list && list.type !== type) flushList();
      list ??= { type, items: [] };
      list.items.push((bullet ?? numbered)![1]);
    } else {
      flushList();
      paragraph.push(line.trim());
    }
  }
  flushParagraph();
  flushList();
  return blocks;
}
