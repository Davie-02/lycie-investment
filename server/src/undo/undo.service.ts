/**
 * Saves each admin action's recorded changes, and reverses them on request.
 *
 * Undo puts every row the action touched back the way it was: rows it
 * deleted are re-created (with everything the database deleted along with
 * them), rows it edited get their old values back, and rows it created are
 * removed. It all happens in one transaction — either the whole action is
 * reversed or nothing is.
 *
 * Safety: if any of those rows has been changed again since (by anyone), the
 * undo stops and says so, because putting the old values back would silently
 * wipe out that later work. The admin can then choose "Undo anyway".
 *
 * An undo is itself recorded as an action, so it can be undone too (a redo).
 */
import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException, UnprocessableEntityException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { EventsService } from "../events/events.service";
import { currentChangeSet, type ChangeSet } from "./change-tracker";
import { delegateName, fingerprint, modelMeta, toPlain, toWriteData } from "./model-meta";

/** How long an action can still be undone. Older ones stay in the log for the record. */
export const UNDO_WINDOW_DAYS = 30;

export interface ActivityInput {
  adminId: string;
  adminName: string;
  role: string;
  action: string;
  route: string;
  targetId: string | null;
}

export interface Actor {
  sub: string;
  role: string;
  name?: string;
}

/** Which live-update topics (see events/topics.ts) a table belongs to, so open pages refresh after an undo. */
const TOPIC_FOR_MODEL: Record<string, string> = {
  Vehicle: "vehicles",
  HireVehicle: "hire-vehicles",
  HireRequest: "hire-vehicles",
  Testimonial: "testimonials",
  Faq: "faq",
  BlogPost: "blog-posts",
  Notice: "notices",
  SiteContent: "site-content",
  Review: "reviews",
  Deal: "deals",
};

/** Outside effects an undo can't take back, by the original action's route. */
const IRREVERSIBLE: Array<[RegExp, string]> = [
  [/\/contact-admin\/.*\/email$|\/contact-admin\/test-email$/, "The email that was sent can't be recalled."],
  [/\/contact-admin\/.*\/message$/, "The customer may already have seen the message."],
  [/\/social\/(posts\/:id\/publish|posts|reply)$/, "Anything already posted to Facebook or Instagram has to be removed there."],
  [/\/hire-requests\/:id\/status$/, "Any email already sent to the customer about this booking can't be recalled."],
  [/\/financial\/payments\//, "Any email already sent to the customer about this payment can't be recalled."],
];

type Delegate = {
  findMany: (args: unknown) => Promise<unknown[]>;
  findUnique: (args: unknown) => Promise<unknown>;
  upsert: (args: unknown) => Promise<unknown>;
  deleteMany: (args: unknown) => Promise<{ count: number }>;
};

function delegate(client: unknown, model: string): Delegate {
  return (client as Record<string, Delegate>)[delegateName(model)];
}

@Injectable()
export class UndoService {
  private readonly logger = new Logger(UndoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService
  ) {}

  /**
   * Writes the activity-log entry for a finished admin request, together with
   * the before/after state of every row it changed. Returns the entry, whose
   * `undoable` flag says whether an undo is possible.
   */
  async recordActivity(input: ActivityInput, set: ChangeSet | undefined) {
    if (set) set.closed = true;
    const rows = set ? [...set.rows.values()] : [];
    const undoable = Boolean(set && rows.length > 0 && !set.untrackable);

    // "After" = the state now that the request (and its transactions) has finished.
    const after = new Map<string, Record<string, unknown> | null>();
    if (undoable) {
      const byModel = new Map<string, string[]>();
      for (const row of rows) byModel.set(row.model, [...(byModel.get(row.model) ?? []), row.recordId]);
      for (const [model, ids] of byModel) {
        const meta = modelMeta().get(model)!;
        const current = await delegate(this.prisma, model).findMany({ where: { [meta.idField]: { in: ids } } });
        for (const row of current.map((item) => toPlain(item)!)) after.set(`${model}:${String(row[meta.idField])}`, row);
      }
    }

    return this.prisma.adminActivity.create({
      data: {
        ...input,
        action: set?.undoOf ? `${set.undoOf.action.startsWith("Undid: ") ? "Redid" : "Undid"}: ${set.undoOf.action.replace(/^(Undid|Redid): /, "")}` : input.action,
        undoOfId: set?.undoOf?.id ?? null,
        undoable,
        changes: undoable
          ? {
              create: rows.map((row) => ({
                seq: row.seq,
                model: row.model,
                recordId: row.recordId,
                before: (row.before ?? Prisma.DbNull) as Prisma.InputJsonValue,
                after: (after.get(`${row.model}:${row.recordId}`) ?? Prisma.DbNull) as Prisma.InputJsonValue,
              })),
            }
          : undefined,
      },
      select: { id: true, action: true, undoable: true },
    });
  }

  /** Can this person undo this entry? Owners can undo anyone's action; everyone else only their own. */
  canUndo(activity: { adminId: string; undoable: boolean; undoneAt: Date | null; createdAt: Date }, actor: Actor): boolean {
    return (
      activity.undoable &&
      !activity.undoneAt &&
      Date.now() - activity.createdAt.getTime() < UNDO_WINDOW_DAYS * 24 * 60 * 60_000 &&
      (actor.role === "OWNER" || activity.adminId === actor.sub)
    );
  }

  /**
   * Reverses one recorded action. Must be called inside the admin request's
   * change tracking (it is — via the /undo route), so the reversal is itself
   * recorded and can be redone.
   */
  async undo(activityId: string, actor: Actor, force = false): Promise<{ undone: true; action: string; restored: number; notes: string[] }> {
    const activity = await this.prisma.adminActivity.findUnique({
      where: { id: activityId },
      include: { changes: { orderBy: { seq: "asc" } } },
    });
    if (!activity) throw new NotFoundException("That action wasn't found.");
    if (activity.undoneAt) throw new BadRequestException("That action has already been undone.");
    if (!activity.undoable || activity.changes.length === 0) throw new BadRequestException("That action can't be undone.");
    if (actor.role !== "OWNER" && activity.adminId !== actor.sub) {
      throw new ForbiddenException("You can only undo your own actions. Ask an Owner to undo someone else's.");
    }
    if (!this.canUndo(activity, actor)) throw new BadRequestException(`Actions can only be undone within ${UNDO_WINDOW_DAYS} days.`);

    // Has anything been changed again since? Compare each row with how the action left it.
    const current = new Map<string, Record<string, unknown> | null>();
    const conflicts = new Set<string>();
    for (const change of activity.changes) {
      const meta = modelMeta().get(change.model);
      if (!meta) throw new BadRequestException("This action touched data that no longer exists in the system, so it can't be undone.");
      const row = toPlain(await delegate(this.prisma, change.model).findUnique({ where: { [meta.idField]: change.recordId } }));
      current.set(change.id, row);
      if (fingerprint(row) !== fingerprint(change.after as Record<string, unknown> | null)) conflicts.add(change.model);
    }
    if (conflicts.size > 0 && !force) {
      throw new ConflictException({
        statusCode: 409,
        code: "UNDO_CONFLICT",
        message: `Some of this has been changed again since (${[...conflicts].map(readableModel).join(", ")}). Undoing now would also wipe out those later changes.`,
      });
    }

    const set = currentChangeSet();
    if (set) set.undoOf = { id: activity.id, action: activity.action };

    const created = activity.changes.filter((change) => change.before === null);
    const restored = activity.changes.filter((change) => change.before !== null);

    try {
      await this.prisma.$transaction(async (tx) => {
        // 1. Put back rows that were deleted or edited (oldest first, so a parent exists before its children).
        for (const change of restored) {
          const meta = modelMeta().get(change.model)!;
          const before = change.before as Record<string, unknown>;
          await delegate(tx, change.model).upsert({
            where: { [meta.idField]: change.recordId },
            create: toWriteData(meta, before, false),
            update: toWriteData(meta, before, true),
          });
        }
        // 2. Remove rows the action created (newest first, so children go before parents).
        for (const change of [...created].reverse()) {
          const meta = modelMeta().get(change.model)!;
          await delegate(tx, change.model).deleteMany({ where: { [meta.idField]: change.recordId } });
        }
        await tx.adminActivity.update({ where: { id: activity.id }, data: { undoneAt: new Date(), undoneBy: actor.name ?? actor.sub } });
        // Undoing an undo (a redo) makes the original action undoable again.
        if (activity.undoOfId) {
          await tx.adminActivity.updateMany({ where: { id: activity.undoOfId }, data: { undoneAt: null, undoneBy: null } });
        }
      });
    } catch (error) {
      this.logger.warn(`Undo of ${activity.id} failed: ${error instanceof Error ? error.message : error}`);
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        const reason =
          error.code === "P2002"
            ? "something else now uses the same unique name or address (for example, a new item with the same web address)"
            : error.code === "P2003"
              ? "other records now depend on what this action created"
              : "the database refused the change";
        throw new UnprocessableEntityException(`Couldn't undo this because ${reason}. Nothing was changed.`);
      }
      throw error;
    }

    this.events.emit([...new Set(activity.changes.map((change) => TOPIC_FOR_MODEL[change.model]).filter(Boolean))]);

    const notes = IRREVERSIBLE.filter(([pattern]) => pattern.test(activity.route)).map(([, note]) => note);
    return { undone: true, action: activity.action, restored: activity.changes.length, notes };
  }

  /** The activity log, newest first. Owners see everyone's actions; others see only their own. */
  async list(actor: Actor, page: number, pageSize: number, mineOnly: boolean) {
    const where = actor.role === "OWNER" && !mineOnly ? {} : { adminId: actor.sub };
    const [items, total] = await Promise.all([
      this.prisma.adminActivity.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          adminId: true,
          adminName: true,
          role: true,
          action: true,
          route: true,
          createdAt: true,
          undoable: true,
          undoneAt: true,
          undoneBy: true,
          undoOfId: true,
          _count: { select: { changes: true } },
        },
      }),
      this.prisma.adminActivity.count({ where }),
    ]);
    return {
      items: items.map(({ _count, ...item }) => ({ ...item, changeCount: _count.changes, canUndo: this.canUndo(item, actor) })),
      total,
      page,
      pageSize,
      undoWindowDays: UNDO_WINDOW_DAYS,
    };
  }
}

/** "HireVehicle" → "hire vehicle", for messages. */
function readableModel(model: string): string {
  return model.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
}
