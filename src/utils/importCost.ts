/**
 * The maths behind the "Import cost estimator" on the Import page. Every rate comes from the
 * admin-editable settings (Site Content → Import Cost Estimator), never from code.
 *
 * How the total is built (all in US dollars):
 *   CIF value   = vehicle price + shipping           (what customs values the vehicle at)
 *   duty        = CIF value × duty %
 *   VAT/surtax  = (CIF value + duty) × VAT %
 *   our fee     = vehicle price × service fee %
 *   total       = vehicle price + shipping + duty + VAT + clearing fee + our fee + delivery inside Malawi
 * It is an ESTIMATE — real duties are set by the tax authority and change — and the page says so.
 */
import type { ImportCalculatorContent } from "@/types/siteContent";

export interface ImportEstimate {
  vehiclePrice: number;
  shipping: number;
  duty: number;
  vat: number;
  clearing: number;
  serviceFee: number;
  delivery: number;
  total: number;
}

const round = (value: number) => Math.round(value);

export function estimateImportCost(vehiclePriceUsd: number, originName: string, config: ImportCalculatorContent): ImportEstimate | null {
  if (!Number.isFinite(vehiclePriceUsd) || vehiclePriceUsd <= 0) return null;
  const origin = config.origins.find((item) => item.name === originName);
  if (!origin) return null;

  const cif = vehiclePriceUsd + origin.shippingUsd;
  const duty = cif * (config.dutyPercent / 100);
  const vat = (cif + duty) * (config.vatPercent / 100);
  const serviceFee = vehiclePriceUsd * (config.serviceFeePercent / 100);

  const parts = {
    vehiclePrice: round(vehiclePriceUsd),
    shipping: round(origin.shippingUsd),
    duty: round(duty),
    vat: round(vat),
    clearing: round(config.clearingFeeUsd),
    serviceFee: round(serviceFee),
    delivery: round(config.deliveryUsd),
  };
  return { ...parts, total: Object.values(parts).reduce((sum, value) => sum + value, 0) };
}
