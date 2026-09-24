/**
 * Workspace guides: the "About this page" descriptions staff see.
 *
 * The built-in texts (guide-defaults.ts) apply until the main system
 * administrator edits one (System → Guides). They decide who sees each guide:
 *   module      — anyone who can open that area (the default)
 *   admins      — system administrators only (used for security details)
 *   departments — only the listed departments (and administrators)
 *   hidden      — nobody
 * Staff only ever receive the guides meant for them.
 */
import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { EventsService } from "../events/events.service";
import { atLeast, DEPARTMENTS } from "../access/modules";
import type { StaffActor } from "../access/current-staff.decorator";
import { GUIDE_DEFAULTS, GUIDE_KEYS, type GuideAudience } from "./guide-defaults";

export const AUDIENCES: GuideAudience[] = ["module", "admins", "departments", "hidden"];

export interface SaveGuideInput {
  title: string;
  body: string;
  audience: GuideAudience;
  departments: string[];
}

@Injectable()
export class GuidesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService
  ) {}

  /** Every guide with its current text and audience, plus the built-in version (for the editor). */
  async all() {
    const saved = new Map((await this.prisma.workspaceGuide.findMany()).map((row) => [row.key, row]));
    return GUIDE_DEFAULTS.map((def) => {
      const row = saved.get(def.key);
      return {
        key: def.key,
        module: def.module,
        title: row?.title ?? def.title,
        body: row?.body ?? def.body,
        audience: (row?.audience as GuideAudience | undefined) ?? def.audience,
        departments: row?.departments ?? [],
        customized: Boolean(row),
        updatedBy: row?.updatedBy ?? null,
        updatedAt: row?.updatedAt ?? null,
        defaultTitle: def.title,
        defaultBody: def.body,
        defaultAudience: def.audience,
      };
    });
  }

  /** Only the guides this person should see. */
  async visibleTo(actor: StaffActor & { department?: string | null }) {
    const department = (await this.prisma.adminUser.findUnique({ where: { id: actor.sub }, select: { department: true } }))?.department ?? null;
    const isAdmin = actor.role === "OWNER";
    return (await this.all())
      .filter((guide) => {
        if (guide.audience === "hidden") return false;
        if (isAdmin) return true;
        if (guide.audience === "admins") return false;
        if (guide.audience === "departments" && !(department && guide.departments.includes(department))) return false;
        return !guide.module || atLeast(actor.access[guide.module], "view");
      })
      .map(({ key, title, body }) => ({ key, title, body }));
  }

  async save(key: string, input: SaveGuideInput, actor: StaffActor) {
    if (!GUIDE_KEYS.has(key)) throw new BadRequestException("Unknown guide.");
    const departments = input.audience === "departments" ? input.departments.filter((d) => DEPARTMENTS[d]) : [];
    if (input.audience === "departments" && departments.length === 0) throw new BadRequestException("Choose at least one department.");
    const data = { title: input.title.trim(), body: input.body.trim(), audience: input.audience, departments, updatedBy: actor.name };
    await this.prisma.workspaceGuide.upsert({ where: { key }, create: { key, ...data }, update: data });
    this.events.emit(["guides"]);
    return (await this.all()).find((guide) => guide.key === key);
  }

  async reset(key: string) {
    await this.prisma.workspaceGuide.deleteMany({ where: { key } });
    this.events.emit(["guides"]);
    return (await this.all()).find((guide) => guide.key === key);
  }
}
