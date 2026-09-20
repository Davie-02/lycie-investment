export interface InquiryRequest {
  preferredContact?: "whatsapp" | "call" | "email" | "message";
  fullName: string;
  phone: string;
  email: string;
  vehicleId?: string;
  message: string;
}

export interface ImportRequest {
  preferredContact?: "whatsapp" | "call" | "email" | "message";
  fullName: string;
  phone: string;
  email: string;
  preferredMake: string;
  preferredModel: string;
  preferredYear?: number;
  budget?: number;
  fuelType?: string;
  transmission?: string;
  vehicleType?: string;
  preferredSourceCountry?: string;
  additionalRequirements?: string;
}

export interface ClearingRequest {
  preferredContact?: "whatsapp" | "call" | "email" | "message";
  fullName: string;
  phone: string;
  email: string;
  vehicleMake: string;
  vehicleModel: string;
  year?: number;
  vin: string;
  currentLocation: string;
  arrivalPortOrBorder: string;
  expectedArrivalDate?: string;
  availableDocuments?: string;
  additionalInformation?: string;
}

export interface HireRequest {
  preferredContact?: "whatsapp" | "call" | "email" | "message";
  fullName: string;
  phone: string;
  email: string;
  vehicleId: string;
  pickupDate: string;
  returnDate: string;
  pickupLocation: string;
  additionalRequirements?: string;
}

export interface ContactMessage {
  preferredContact?: "whatsapp" | "call" | "email" | "message";
  fullName: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
}
