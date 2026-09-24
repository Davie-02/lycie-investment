/**
 * What the undo feature needs to know about each database table, read from
 * Prisma's own description of the schema (so a new table or column is picked
 * up automatically): its id column, which columns hold JSON, and which other
 * tables lose rows (Cascade) or get a column blanked (SetNull) when a row is
 * deleted.
 */
import { Prisma } from "@prisma/client";

/** Tables whose changes are never recorded: logs, counters, sign-in tokens, and the undo records themselves. */
export const UNTRACKED_MODELS = new Set([
  "AdminActivity",
  "ChangeRecord",
  "RevokedSession",
  "AuditLog",
  "LycieChatLog",
  "VehicleViewStat",
  "ContentLike",
  "PasswordResetToken",
  "AdminPasswordResetToken",
  "EmailVerificationToken",
]);

/**
 * Columns that change on their own (sign-ins, timestamps). They are ignored
 * when checking "has this row changed since?" and never written back by an undo,
 * so undoing an edit to an admin account doesn't also undo their last sign-in.
 */
export const VOLATILE_FIELDS = new Set(["updatedAt", "lastLoginAt", "failedLoginCount", "lockedUntil", "lastTotpStep"]);

export interface Dependent {
  model: string;
  /** Foreign-key column on the dependent table. */
  field: string;
  onDelete: "Cascade" | "SetNull";
}

export interface ModelMeta {
  name: string;
  idField: string;
  jsonFields: Set<string>;
  scalarFields: Set<string>;
  /** Tables whose rows point at this one and are affected when a row here is deleted. */
  dependents: Dependent[];
}

let cache: Map<string, ModelMeta> | null = null;

export function modelMeta(): Map<string, ModelMeta> {
  if (cache) return cache;
  const models = Prisma.dmmf.datamodel.models;
  const byName = new Map<string, ModelMeta>();

  for (const model of models) {
    const id = model.fields.find((field) => field.isId);
    if (!id) continue; // composite ids aren't used by any tracked table
    byName.set(model.name, {
      name: model.name,
      idField: id.name,
      jsonFields: new Set(model.fields.filter((field) => field.type === "Json").map((field) => field.name)),
      scalarFields: new Set(model.fields.filter((field) => field.kind !== "object").map((field) => field.name)),
      dependents: [],
    });
  }

  for (const model of models) {
    for (const field of model.fields) {
      const onDelete = (field as { relationOnDelete?: string }).relationOnDelete;
      if (field.kind !== "object" || !field.relationFromFields?.length) continue;
      if (onDelete !== "Cascade" && onDelete !== "SetNull") continue;
      byName.get(field.type)?.dependents.push({ model: model.name, field: field.relationFromFields[0], onDelete });
    }
  }

  cache = byName;
  return byName;
}

/** Prisma's client property for a model: "HireVehicle" → "hireVehicle". */
export function delegateName(model: string): string {
  return model.charAt(0).toLowerCase() + model.slice(1);
}

/** A database row as plain JSON (dates → ISO strings, decimals → strings), the form it is stored and compared in. */
export function toPlain(row: unknown): Record<string, unknown> | null {
  if (row === null || row === undefined) return null;
  return JSON.parse(JSON.stringify(row)) as Record<string, unknown>;
}

/** Stable text of a row's meaningful content, for "has it changed since?" comparisons. */
export function fingerprint(row: Record<string, unknown> | null): string {
  if (!row) return "null";
  const keys = Object.keys(row)
    .filter((key) => !VOLATILE_FIELDS.has(key))
    .sort();
  return JSON.stringify(keys.map((key) => [key, row[key]]));
}

/**
 * Turns a stored row back into data Prisma will accept for create/update:
 * only real columns, JSON nulls spelled the way Prisma requires, and
 * (for updates) without the id or self-updating columns.
 */
export function toWriteData(meta: ModelMeta, row: Record<string, unknown>, forUpdate: boolean): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (!meta.scalarFields.has(key)) continue;
    if (forUpdate && (key === meta.idField || VOLATILE_FIELDS.has(key))) continue;
    data[key] = value === null && meta.jsonFields.has(key) ? Prisma.DbNull : value;
  }
  return data;
}
