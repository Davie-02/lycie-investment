/**
 * Pure rules for vehicle alerts: does a vehicle match what a customer asked
 * to hear about, and how to describe an alert in a sentence. Kept free of the
 * database so they are easy to test.
 */
import { toUsd } from "../pricing/price-format";

export interface AlertCriteria {
  make?: string | null;
  model?: string | null;
  bodyType?: string | null;
  /** Upper limit in US dollars. */
  maxPrice?: number | null;
  minYear?: number | null;
}

export interface AlertVehicleFacts {
  make: string;
  model: string;
  bodyType: string;
  year: number;
  price: number;
  currency: string;
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
const contains = (haystack: string, needle: string) => haystack.toLowerCase().includes(needle.trim().toLowerCase());

export function vehicleMatchesAlert(vehicle: AlertVehicleFacts, alert: AlertCriteria): boolean {
  if (alert.make && !same(vehicle.make, alert.make)) return false;
  // Model is matched loosely so "Hilux" also finds "Hilux Double Cab".
  if (alert.model && !contains(vehicle.model, alert.model)) return false;
  if (alert.bodyType && !same(vehicle.bodyType.replace(/s$/i, ""), alert.bodyType.replace(/s$/i, ""))) return false;
  if (alert.minYear && vehicle.year < alert.minYear) return false;
  if (alert.maxPrice) {
    // Old kwacha-priced listings can't be compared without a rate; let them through rather than miss a match.
    const usd = toUsd(vehicle.price, vehicle.currency, null);
    if (usd !== null && usd > alert.maxPrice) return false;
  }
  return true;
}

/** "Toyota Hilux, 2018 or newer, up to USD 25,000" */
export function describeAlert(alert: AlertCriteria): string {
  const parts: string[] = [];
  const name = [alert.make, alert.model].filter(Boolean).join(" ");
  parts.push(name || (alert.bodyType ? `Any ${alert.bodyType}` : "Any vehicle"));
  if (name && alert.bodyType) parts.push(alert.bodyType);
  if (alert.minYear) parts.push(`${alert.minYear} or newer`);
  if (alert.maxPrice) parts.push(`up to USD ${alert.maxPrice.toLocaleString("en-US")}`);
  return parts.join(", ");
}
