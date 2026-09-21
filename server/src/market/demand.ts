/**
 * "What are people actually asking for?" — computed from the company's own data, no AI involved.
 *
 * Every signal of interest in a vehicle is counted and weighted by how strongly it shows someone
 * wants to BUY: an import request (they'll pay to have it sourced) is worth the most, then an
 * inquiry, a saved vehicle, a like and finally a page view. The ranking answers "which vehicles
 * should we stock or source more of?" and flags the gaps: high demand but nothing in stock.
 */

export interface DemandInput {
  vehicles: Array<{ id: string; make: string; model: string; status: string }>;
  importRequests: Array<{ preferredMake: string; preferredModel: string | null }>;
  inquiries: Array<{ vehicleId: string | null }>;
  saves: Array<{ vehicleId: string }>;
  likes: Array<{ targetId: string }>;
  views: Array<{ vehicleId: string; views: number }>;
}

export interface DemandRow {
  name: string;
  score: number;
  importRequests: number;
  inquiries: number;
  saves: number;
  likes: number;
  views: number;
  /** How many available vehicles of this kind are listed right now. */
  inStock: number;
  /** A plain-language next step. */
  advice: string;
}

/** How much each kind of interest counts toward the score. */
export const WEIGHTS = { importRequests: 5, inquiries: 4, saves: 3, likes: 1, views: 0.2 } as const;

const norm = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");
const titleCase = (value: string) => value.replace(/\b\w/g, (c) => c.toUpperCase());

interface Bucket extends Omit<DemandRow, "score" | "advice"> {
  make: string;
  model: string;
}

/** Advice from the shape of the numbers — deliberately simple and explainable. */
export function adviceFor(row: Omit<DemandRow, "advice" | "score">): string {
  const asks = row.importRequests + row.inquiries;
  if (row.inStock === 0 && asks > 0) return `Customers are asking for this but none is listed — source some.`;
  if (row.importRequests >= 2) return `Several customers want this imported — promote your import service for it.`;
  if (row.views + row.likes + row.saves >= 20 && asks === 0) return `Lots of interest but no enquiries — check the price, photos and description.`;
  if (row.inStock > 0 && asks >= 2) return `Selling interest is strong — keep stock available and respond to enquiries quickly.`;
  return `Steady interest — keep an eye on it.`;
}

export function buildDemand(input: DemandInput, limit = 10): DemandRow[] {
  const byId = new Map(input.vehicles.map((vehicle) => [vehicle.id, vehicle]));
  const buckets = new Map<string, Bucket>();

  const bucketFor = (make: string, model: string): Bucket | null => {
    const cleanMake = norm(make);
    if (!cleanMake) return null;
    const cleanModel = norm(model);
    const key = `${cleanMake}|${cleanModel}`;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { name: titleCase(`${cleanMake} ${cleanModel}`.trim()), make: cleanMake, model: cleanModel, importRequests: 0, inquiries: 0, saves: 0, likes: 0, views: 0, inStock: 0 };
      buckets.set(key, bucket);
    }
    return bucket;
  };
  const forVehicle = (id: string | null) => {
    const vehicle = id ? byId.get(id) : undefined;
    return vehicle ? bucketFor(vehicle.make, vehicle.model) : null;
  };

  for (const request of input.importRequests) {
    const bucket = bucketFor(request.preferredMake, request.preferredModel ?? "");
    if (bucket) bucket.importRequests += 1;
  }
  for (const inquiry of input.inquiries) {
    const bucket = forVehicle(inquiry.vehicleId);
    if (bucket) bucket.inquiries += 1;
  }
  for (const save of input.saves) {
    const bucket = forVehicle(save.vehicleId);
    if (bucket) bucket.saves += 1;
  }
  for (const like of input.likes) {
    const bucket = forVehicle(like.targetId);
    if (bucket) bucket.likes += 1;
  }
  for (const view of input.views) {
    const bucket = forVehicle(view.vehicleId);
    if (bucket) bucket.views += view.views;
  }

  // Stock: an import request that names only a make matches any model of that make.
  for (const bucket of buckets.values()) {
    bucket.inStock = input.vehicles.filter(
      (vehicle) => vehicle.status === "available" && norm(vehicle.make) === bucket.make && (!bucket.model || norm(vehicle.model) === bucket.model)
    ).length;
  }

  return [...buckets.values()]
    .map((bucket) => {
      const { make: _make, model: _model, ...row } = bucket;
      void _make;
      void _model;
      const score = Math.round((row.importRequests * WEIGHTS.importRequests + row.inquiries * WEIGHTS.inquiries + row.saves * WEIGHTS.saves + row.likes * WEIGHTS.likes + row.views * WEIGHTS.views) * 10) / 10;
      return { ...row, score, advice: adviceFor(row) };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
