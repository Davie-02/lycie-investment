/**
 * Records which database rows an admin action touches, and what they looked
 * like beforehand, so the action can be undone later.
 *
 * How: ActivityInterceptor runs each admin write request inside `trackChanges()`
 * (an AsyncLocalStorage context). A Prisma middleware installed on the one
 * shared client (PrismaService) sees every write made while that context is
 * active and, BEFORE the write runs, reads the rows it is about to change.
 * Only the first sighting of a row in a request is kept, so "before" is the
 * state before the whole action. The "after" state is read once the request
 * has finished (see UndoService.persist), when every transaction has committed.
 *
 * Requests that aren't admin writes never open a context, so this costs them
 * nothing. Anything unusual (a raw SQL write, a bulk insert, a very large
 * delete) marks the action as not undoable rather than recording half of it.
 */
import { AsyncLocalStorage } from "async_hooks";
import type { Prisma, PrismaClient } from "@prisma/client";
import { UNTRACKED_MODELS, delegateName, modelMeta, toPlain } from "./model-meta";

/** Above this many rows in one action, snapshots are skipped (and the action isn't undoable). */
export const MAX_TRACKED_ROWS = 1000;

export interface TrackedRow {
  seq: number;
  model: string;
  recordId: string;
  /** null = the row was created by this action. */
  before: Record<string, unknown> | null;
}

export interface ChangeSet {
  rows: Map<string, TrackedRow>;
  /** Set when something happened that can't be reliably reversed. */
  untrackable: string | null;
  /** No more changes are accepted once the request's result has been saved. */
  closed: boolean;
  /** Filled in by an undo so the activity log reads "Undid: …" and links back. */
  undoOf?: { id: string; action: string };
}

const storage = new AsyncLocalStorage<ChangeSet>();

export function newChangeSet(): ChangeSet {
  return { rows: new Map(), untrackable: null, closed: false };
}

/** Runs `work` with change tracking on. Everything it (and anything it awaits) writes is recorded in `set`. */
export function trackChanges<T>(set: ChangeSet, work: () => T): T {
  return storage.run(set, work);
}

export function currentChangeSet(): ChangeSet | undefined {
  const set = storage.getStore();
  return set && !set.closed ? set : undefined;
}

const WRITE_ACTIONS = new Set(["create", "update", "upsert", "delete", "updateMany", "deleteMany", "createMany", "createManyAndReturn"]);

type Delegate = {
  findMany: (args: { where: unknown; take?: number }) => Promise<unknown[]>;
};

function remember(set: ChangeSet, model: string, recordId: string, before: Record<string, unknown> | null): void {
  const key = `${model}:${recordId}`;
  if (set.rows.has(key)) return; // the first sighting is the true "before"
  if (set.rows.size >= MAX_TRACKED_ROWS) {
    set.untrackable = "too many rows changed at once";
    return;
  }
  set.rows.set(key, { seq: set.rows.size, model, recordId, before });
}

/**
 * Reads the rows a write is about to affect, plus — for deletes — the rows in
 * other tables that the database will delete or blank along with them.
 */
async function snapshotBefore(
  client: PrismaClient,
  set: ChangeSet,
  model: string,
  where: unknown,
  isDelete: boolean,
  depth = 0
): Promise<void> {
  const meta = modelMeta().get(model);
  if (!meta || UNTRACKED_MODELS.has(model)) return;
  const delegate = (client as unknown as Record<string, Delegate>)[delegateName(model)];
  const rows = (await delegate.findMany({ where, take: MAX_TRACKED_ROWS + 1 })).map((row) => toPlain(row)!);
  if (rows.length > MAX_TRACKED_ROWS) {
    set.untrackable = "too many rows changed at once";
    return;
  }
  for (const row of rows) remember(set, model, String(row[meta.idField]), row);

  if (!isDelete || rows.length === 0 || depth > 4) return;
  const ids = rows.map((row) => row[meta.idField]);
  for (const dependent of meta.dependents) {
    // Cascade: those rows vanish too. SetNull: their link is blanked. Either way, remember them.
    await snapshotBefore(client, set, dependent.model, { [dependent.field]: { in: ids } }, dependent.onDelete === "Cascade", depth + 1);
  }
}

/**
 * Installs the recording middleware on the shared Prisma client. Called once
 * by PrismaService. Uses the base client for its reads, so they see committed
 * data — exactly the state before the action for any row touched first.
 */
export function installChangeTracking(client: PrismaClient): void {
  client.$use(async (params: Prisma.MiddlewareParams, next: (params: Prisma.MiddlewareParams) => Promise<unknown>) => {
    const set = currentChangeSet();
    const model = params.model;
    if (!set || !model || !WRITE_ACTIONS.has(params.action) || UNTRACKED_MODELS.has(model)) return next(params);

    const meta = modelMeta().get(model);
    const args = (params.args ?? {}) as { where?: unknown };

    try {
      if (!meta) {
        set.untrackable = `changes to ${model} can't be recorded`;
      } else if (params.action === "createMany" || params.action === "createManyAndReturn") {
        set.untrackable = "bulk inserts can't be undone";
      } else if (params.action !== "create") {
        // update / upsert / delete / *Many: the rows matching `where` are what will change.
        await snapshotBefore(client, set, model, args.where ?? {}, params.action === "delete" || params.action === "deleteMany");
      }
    } catch {
      set.untrackable = "the state before the change couldn't be read";
    }

    const result = await next(params);

    if (meta && (params.action === "create" || params.action === "upsert")) {
      const id = (result as Record<string, unknown> | null)?.[meta.idField];
      // An upsert that updated an existing row was already remembered above with its real "before".
      if (id !== undefined) remember(set, model, String(id), null);
      else if (params.action === "create") set.untrackable = "a new record's id wasn't returned";
    }
    return result;
  });
}

/** Marks the current action as not undoable (used for raw SQL writes and outside effects). */
export function markUntrackable(reason: string): void {
  const set = currentChangeSet();
  if (set) set.untrackable = reason;
}
