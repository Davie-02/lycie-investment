export type FuelType = "Petrol" | "Diesel" | "Hybrid" | "Electric";
export type TransmissionType = "Automatic" | "Manual";
export type VehicleStatus = "available" | "reserved" | "sold";
export type BodyType =
  | "Sedan"
  | "SUV"
  | "Pickup"
  | "Hatchback"
  | "Van"
  | "Truck"
  | "Minibus";

export interface Vehicle {
  id: string;
  slug: string;
  make: string;
  model: string;
  year: number;
  price: number;
  currency: "MWK";
  mileageKm: number;
  fuelType: FuelType;
  transmission: TransmissionType;
  bodyType: BodyType;
  engine: string;
  driveType: string;
  condition: string;
  location: string;
  status: VehicleStatus;
  description: string;
  features: string[];
  images: string[];
  /** Present on admin lists; public endpoints only ever return published, non-archived items. */
  isPublished?: boolean;
  archivedAt?: string | null;
  isFeatured?: boolean;
}

export interface HireVehicle {
  id: string;
  slug: string;
  name: string;
  dailyRate: number;
  weeklyRate?: number;
  currency: "MWK";
  transmission: TransmissionType;
  fuelType: FuelType;
  seats: number;
  available: boolean;
  /** Cover photo — always the first of `images`. */
  image: string;
  /** Whole gallery in display order. Missing on very old data; fall back to [image]. */
  images?: string[];
  isPublished?: boolean;
  archivedAt?: string | null;
}
