/**
 * What "published", "unpublished" and "archived" mean for every kind of
 * content, in ONE place, so the public site, Lycie and the admin can never
 * disagree about what a visitor is allowed to see.
 *
 * - published:   live on the site
 * - unpublished: hidden, but still an editable draft
 * - archived:    hidden and tucked away; can be restored or duplicated later
 *
 * Most content uses an `isPublished` flag; notices predate it and use
 * `isActive`; blog posts use `publishedAt` (null = draft).
 */
export type ContentType = "vehicles" | "hire-vehicles" | "testimonials" | "faq" | "blog-posts" | "notices";
export type ContentState = "published" | "unpublished" | "archived";
export type ContentAction = "publish" | "unpublish" | "archive" | "restore" | "delete";

export const CONTENT_TYPES: ContentType[] = ["vehicles", "hire-vehicles", "testimonials", "faq", "blog-posts", "notices"];

type Where = Record<string, unknown>;

interface Rules {
  published: Where;
  unpublished: Where;
  archived: Where;
  /** Data that makes an item live / hidden. */
  publish: () => Where;
  unpublish: () => Where;
}

const flag = (field: string): Rules => ({
  published: { [field]: true, archivedAt: null },
  unpublished: { [field]: false, archivedAt: null },
  archived: { archivedAt: { not: null } },
  publish: () => ({ [field]: true, archivedAt: null }),
  unpublish: () => ({ [field]: false }),
});

export const RULES: Record<ContentType, Rules> = {
  vehicles: flag("isPublished"),
  "hire-vehicles": flag("isPublished"),
  testimonials: flag("isPublished"),
  faq: flag("isPublished"),
  notices: flag("isActive"),
  "blog-posts": {
    published: { publishedAt: { not: null }, archivedAt: null },
    unpublished: { publishedAt: null, archivedAt: null },
    archived: { archivedAt: { not: null } },
    publish: () => ({ publishedAt: new Date(), archivedAt: null }),
    unpublish: () => ({ publishedAt: null }),
  },
};

/** The `where` clause every public read must include. */
export const PUBLIC: Record<ContentType, Where> = {
  vehicles: RULES.vehicles.published,
  "hire-vehicles": RULES["hire-vehicles"].published,
  testimonials: RULES.testimonials.published,
  faq: RULES.faq.published,
  notices: RULES.notices.published,
  "blog-posts": RULES["blog-posts"].published,
};

/** Data applied for each state-changing action. Archiving also hides, so a restored item comes back as a draft. */
export function dataFor(type: ContentType, action: Exclude<ContentAction, "delete">): Where {
  const rules = RULES[type];
  switch (action) {
    case "publish":
      return rules.publish();
    case "unpublish":
      return rules.unpublish();
    case "archive":
      return { ...rules.unpublish(), archivedAt: new Date() };
    case "restore":
      return { archivedAt: null };
  }
}
