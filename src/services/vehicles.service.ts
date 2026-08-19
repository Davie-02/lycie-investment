import { apiGet, ApiError } from "./http";
import type { Vehicle, HireVehicle } from "@/types/vehicle";

export async function getVehicles(): Promise<Vehicle[]> {
  return apiGet<Vehicle[]>("/vehicles");
}

export async function getVehicleBySlug(slug: string): Promise<Vehicle | null> {
  try {
    return await apiGet<Vehicle>(`/vehicles/${encodeURIComponent(slug)}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      return null;
    }
    throw err;
  }
}

export async function getFeaturedVehicles(limit = 3): Promise<Vehicle[]> {
  return apiGet<Vehicle[]>(`/vehicles?featured=true&limit=${limit}`);
}

export async function getHireVehicles(): Promise<HireVehicle[]> {
  return apiGet<HireVehicle[]>("/hire-vehicles");
}
