/**
 * Pure functions behind the Vehicles page filters: the filter shape, an empty default,
 * applyFilters() (search text, make, body type, fuel, transmission, status, max price)
 * and getUniqueValues() for the dropdown options. Runs in the browser on the already-
 * loaded list.
 */
import type { Vehicle } from "@/types/vehicle";
import { toUsd } from "@/utils/price";

export interface VehicleFilters {
  search: string;
  make: string;
  fuelType: string;
  transmission: string;
  bodyType: string;
  status: string;
  maxPrice: string;
}

export const EMPTY_FILTERS: VehicleFilters = {
  search: "",
  make: "",
  fuelType: "",
  transmission: "",
  bodyType: "",
  status: "",
  maxPrice: "",
};

/**
 * @param rate kwacha per US dollar — needed to compare the max price (entered in USD) with
 * older listings still stored in kwacha.
 */
export function applyFilters(vehicles: Vehicle[], filters: VehicleFilters, rate: number | null = null): Vehicle[] {
  return vehicles.filter((vehicle) => {
    if (filters.search) {
      const term = filters.search.toLowerCase();
      const haystack = `${vehicle.make} ${vehicle.model} ${vehicle.year}`.toLowerCase();
      if (!haystack.includes(term)) return false;
    }
    if (filters.make && vehicle.make !== filters.make) return false;
    if (filters.fuelType && vehicle.fuelType !== filters.fuelType) return false;
    if (filters.transmission && vehicle.transmission !== filters.transmission) return false;
    if (filters.bodyType && vehicle.bodyType !== filters.bodyType) return false;
    if (filters.status && vehicle.status !== filters.status) return false;
    if (filters.maxPrice) {
      const usd = toUsd(vehicle.price, vehicle.currency, rate);
      // A kwacha listing we can't convert yet is kept rather than hidden by mistake.
      if (usd !== null && usd > Number(filters.maxPrice)) return false;
    }
    return true;
  });
}

export function getUniqueValues<T extends keyof Vehicle>(vehicles: Vehicle[], key: T): string[] {
  const values = new Set(vehicles.map((v) => String(v[key])));
  return Array.from(values).sort();
}
