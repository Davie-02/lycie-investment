import type { HireVehicle } from "./vehicle";

export type HireRequestStatus = "pending" | "confirmed" | "cancelled" | "completed";

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

export type BookingPhase = "upcoming" | "active" | "overdue" | "completed" | "cancelled";

/**
 * "completed" here means an admin actually marked the vehicle returned
 * (status === "completed") — NOT just that the return date has passed.
 * A confirmed booking whose return date has passed but hasn't been marked
 * returned is "overdue", which is a distinct, actionable state (something
 * needs following up), not the same as done.
 */
export function getBookingPhase(booking: Booking): BookingPhase {
  if (booking.status === "cancelled") return "cancelled";
  if (booking.status === "completed") return "completed";

  const now = Date.now();
  const pickup = new Date(booking.pickupDate).getTime();
  const returnT = new Date(booking.returnDate).getTime();

  if (now < pickup) return "upcoming";
  if (now > returnT) return "overdue";
  return "active";
}
