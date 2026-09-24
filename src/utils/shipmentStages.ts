/** The journey of an imported vehicle, in order. Mirrors server/src/shipments/stages.ts. */
export const SHIPMENT_STAGES = [
  { key: "ordered", label: "Purchased / ordered" },
  { key: "shipped", label: "Shipped" },
  { key: "port", label: "Arrived at port" },
  { key: "transit", label: "On the road to Malawi" },
  { key: "border", label: "At the border" },
  { key: "customs", label: "Customs clearance" },
  { key: "ready", label: "Ready for collection" },
  { key: "delivered", label: "Delivered" },
] as const;

export function stageLabel(key: string | null | undefined): string {
  return SHIPMENT_STAGES.find((stage) => stage.key === key)?.label ?? "Not started";
}

export function stageIndex(key: string | null | undefined): number {
  return SHIPMENT_STAGES.findIndex((stage) => stage.key === key);
}
