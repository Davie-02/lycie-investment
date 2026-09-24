/** The journey of an imported vehicle, in order. Mirrored in src/utils/shipmentStages.ts for the website. */
export const STAGES = [
  { key: "ordered", label: "Purchased / ordered", status: "REQUESTED" },
  { key: "shipped", label: "Shipped", status: "IN_PROGRESS" },
  { key: "port", label: "Arrived at port", status: "IN_PROGRESS" },
  { key: "transit", label: "On the road to Malawi", status: "IN_PROGRESS" },
  { key: "border", label: "At the border", status: "IN_PROGRESS" },
  { key: "customs", label: "Customs clearance", status: "IN_PROGRESS" },
  { key: "ready", label: "Ready for collection", status: "READY" },
  { key: "delivered", label: "Delivered", status: "COMPLETED" },
] as const;

export type StageKey = (typeof STAGES)[number]["key"];
export const STAGE_KEYS = STAGES.map((stage) => stage.key) as StageKey[];

export function stageInfo(key: string | null | undefined) {
  return STAGES.find((stage) => stage.key === key) ?? null;
}
