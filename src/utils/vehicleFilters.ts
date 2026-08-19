import type { Vehicle } from "@/types/vehicle";

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

export function applyFilters(vehicles: Vehicle[], filters: VehicleFilters): Vehicle[] {
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
    if (filters.maxPrice && vehicle.price > Number(filters.maxPrice)) return false;
    return true;
  });
}

export function getUniqueValues<T extends keyof Vehicle>(vehicles: Vehicle[], key: T): string[] {
  const values = new Set(vehicles.map((v) => String(v[key])));
  return Array.from(values).sort();
}
