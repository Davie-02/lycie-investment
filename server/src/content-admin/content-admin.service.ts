/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars --
   One implementation is deliberately shared by six Prisma models, so the model
   delegate is addressed dynamically (typed loosely); the type-safe surface is
   ContentType / ContentAction. */
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ContentAction, ContentState, ContentType, RULES, dataFor } from "./content-state";

interface TypeConfig {
  search: string[];
  orderBy: Record<string, "asc" | "desc">[];
  /** Turns a row into the data for its copy (a draft, ready to review and publish). */
  clone: (row: Record<string, any>) => Record<string, unknown>;
}

const copySlug = (slug: string) => `${slug}-copy-${Math.random().toString(36).slice(2, 6)}`;

const CONFIG: Record<ContentType, TypeConfig> = {
  vehicles: {
    search: ["make", "model", "slug", "location", "bodyType"],
    orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
    // A relisting of the same type of vehicle: fresh slug, available again, hidden until reviewed.
    clone: (r) => ({ ...r, slug: copySlug(r.slug), status: "available", isPublished: false, isFeatured: false, archivedAt: null }),
  },
  "hire-vehicles": {
    search: ["name", "slug"],
    orderBy: [{ createdAt: "desc" }],
    clone: (r) => ({ ...r, slug: copySlug(r.slug), name: `${r.name} (copy)`, isPublished: false, archivedAt: null }),
  },
  testimonials: {
    search: ["quote", "authorName"],
    orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
    clone: (r) => ({ ...r, isFeatured: false, isPublished: false, archivedAt: null }),
  },
  faq: {
    search: ["question", "answer", "category"],
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    clone: (r) => ({ ...r, question: `${r.question} (copy)`, isPublished: false, archivedAt: null }),
  },
  "blog-posts": {
    search: ["title", "excerpt", "slug"],
    orderBy: [{ createdAt: "desc" }],
    clone: (r) => ({ ...r, slug: copySlug(r.slug), title: `${r.title} (copy)`, publishedAt: null, archivedAt: null }),
  },
  notices: {
    search: ["title", "message"],
    orderBy: [{ createdAt: "desc" }],
    clone: (r) => ({ ...r, title: r.title ? `${r.title} (copy)` : r.title, isActive: false, archivedAt: null }),
  },
};

const DELEGATES: Record<ContentType, string> = {
  vehicles: "vehicle",
  "hire-vehicles": "hireVehicle",
  testimonials: "testimonial",
  faq: "faq",
  "blog-posts": "blogPost",
  notices: "notice",
};

const STATES: ContentState[] = ["published", "unpublished", "archived"];

/**
 * One implementation of list / filter / search / publish / unpublish /
 * archive / restore / duplicate / bulk for every kind of content, so all six
 * admin pages behave identically.
 */
@Injectable()
export class ContentAdminService {
  constructor(private readonly prisma: PrismaService) {}

  private delegate(type: ContentType): any {
    return (this.prisma as any)[DELEGATES[type]];
  }

  async list(type: ContentType, state: ContentState | "all", q: string | undefined, page: number, pageSize: number) {
    const cfg = CONFIG[type];
    const delegate = this.delegate(type);
    const search = q?.trim()
      ? { OR: cfg.search.map((field) => ({ [field]: { contains: q.trim(), mode: "insensitive" } })) }
      : {};
    // "all" excludes archived items — they live in their own tab so the main list stays tidy.
    const stateWhere = state === "all" ? { archivedAt: null } : RULES[type][state];
    const where = { AND: [stateWhere, search] };

    const [items, total, ...counts] = await Promise.all([
      delegate.findMany({ where, orderBy: cfg.orderBy, skip: (page - 1) * pageSize, take: pageSize }),
      delegate.count({ where }),
      ...STATES.map((s) => delegate.count({ where: RULES[type][s] })),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
      counts: {
        published: counts[0],
        unpublished: counts[1],
        archived: counts[2],
        all: counts[0] + counts[1],
      },
    };
  }

  async apply(type: ContentType, ids: string[], action: ContentAction): Promise<{ affected: number }> {
    if (ids.length === 0) throw new BadRequestException("Select at least one item.");
    const delegate = this.delegate(type);
    const where = { id: { in: ids } };

    if (action === "delete") {
      const result = await delegate.deleteMany({ where });
      return { affected: result.count };
    }
    const result = await delegate.updateMany({ where, data: dataFor(type, action) });
    return { affected: result.count };
  }

  /** Copies an item as a hidden draft — e.g. new stock of the same kind of vehicle. */
  async duplicate(type: ContentType, id: string) {
    const delegate = this.delegate(type);
    const row = await delegate.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Item not found.");

    const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = CONFIG[type].clone(row) as Record<string, unknown>;
    return delegate.create({ data: rest });
  }
}
