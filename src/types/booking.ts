import type { HireVehicle } from "./vehicle";

export type HireRequestStatus = "pending" | "confirmed" | "cancelled";

export interface Booking {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  vehicleId: string;
  vehicle: HireVehicle;
  pickupDate: string;
  returnDate: string;
  pickupLocation: string;
  additionalRequirements: string | null;
  days: number;
  totalCost: number;
  currency: string;
  status: HireRequestStatus;
  createdAt: string;
}

export type BookingPhase = "upcoming" | "active" | "completed";

export function getBookingPhase(booking: Booking): BookingPhase {
  const now = Date.now();
  const pickup = new Date(booking.pickupDate).getTime();
  const returnT = new Date(booking.returnDate).getTime();
  if (now < pickup) return "upcoming";
  if (now > returnT) return "completed";
  return "active";
}
