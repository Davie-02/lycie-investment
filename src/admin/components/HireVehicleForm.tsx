import { useState, type FormEvent, type ChangeEvent } from "react";
import FormField from "@/components/forms/FormField";
import FormStatusBanner from "@/components/forms/FormStatusBanner";
import ImageUploader from "./ImageUploader";
import { adminApi } from "../adminApi";
import { ApiError } from "@/services/http";
import type { HireVehicle } from "@/types/vehicle";

interface HireVehicleFormProps {
  vehicle: HireVehicle | null;
  onSaved: () => void;
  onCancel: () => void;
}

type FormValues = {
  slug: string;
  name: string;
  dailyRate: string;
  weeklyRate: string;
  transmission: string;
  fuelType: string;
  seats: string;
  available: boolean;
};

function toFormValues(vehicle: HireVehicle | null): FormValues {
  if (!vehicle) {
    return {
      slug: "",
      name: "",
      dailyRate: "",
      weeklyRate: "",
      transmission: "Automatic",
      fuelType: "Petrol",
      seats: "5",
      available: true,
    };
  }
  return {
    slug: vehicle.slug,
    name: vehicle.name,
    dailyRate: String(vehicle.dailyRate),
    weeklyRate: vehicle.weeklyRate ? String(vehicle.weeklyRate) : "",
    transmission: vehicle.transmission,
    fuelType: vehicle.fuelType,
    seats: String(vehicle.seats),
    available: vehicle.available,
  };
}

export default function HireVehicleForm({ vehicle, onSaved, onCancel }: HireVehicleFormProps) {
  const [values, setValues] = useState<FormValues>(toFormValues(vehicle));
  const [image, setImage] = useState<string[]>(vehicle?.image ? [vehicle.image] : []);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleChange(field: keyof FormValues) {
    return (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setValues((prev) => ({ ...prev, [field]: e.target.value }));
    };
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (image.length === 0) {
      setError("Add an image before saving.");
      return;
    }

    const payload = {
      slug: values.slug,
      name: values.name,
      dailyRate: Number(values.dailyRate),
      weeklyRate: values.weeklyRate ? Number(values.weeklyRate) : undefined,
      transmission: values.transmission,
      fuelType: values.fuelType,
      seats: Number(values.seats),
      available: values.available,
      image: image[0],
    };

    setIsSaving(true);
    try {
      if (vehicle) {
        await adminApi.patch(`/hire-vehicles/${vehicle.id}`, payload);
      } else {
        await adminApi.post("/hire-vehicles", payload);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save hire vehicle.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className="form-card" onSubmit={handleSubmit} noValidate>
      <h2>{vehicle ? `Edit ${vehicle.name}` : "Add a Hire Vehicle"}</h2>

      {error && <FormStatusBanner status="error" successMessage="" errorMessage={error} />}

      <div className="form-grid form-grid--2col">
        <FormField
          id="slug"
          label="Slug"
          required
          value={values.slug}
          onChange={handleChange("slug")}
          placeholder="toyota-corolla-hire"
        />
        <FormField id="name" label="Name" required value={values.name} onChange={handleChange("name")} />
        <FormField id="dailyRate" label="Daily Rate (MWK)" type="number" required value={values.dailyRate} onChange={handleChange("dailyRate")} />
        <FormField id="weeklyRate" label="Weekly Rate (MWK, optional)" type="number" value={values.weeklyRate} onChange={handleChange("weeklyRate")} />

        <FormField id="transmission" label="Transmission" as="select" value={values.transmission} onChange={handleChange("transmission")}>
          <option value="Automatic">Automatic</option>
          <option value="Manual">Manual</option>
        </FormField>

        <FormField id="fuelType" label="Fuel Type" as="select" value={values.fuelType} onChange={handleChange("fuelType")}>
          <option value="Petrol">Petrol</option>
          <option value="Diesel">Diesel</option>
          <option value="Hybrid">Hybrid</option>
          <option value="Electric">Electric</option>
        </FormField>

        <FormField id="seats" label="Seats" type="number" required value={values.seats} onChange={handleChange("seats")} />

        <FormField
          id="available"
          label="Availability"
          as="select"
          value={values.available ? "true" : "false"}
          onChange={(e) => setValues((prev) => ({ ...prev, available: e.target.value === "true" }))}
        >
          <option value="true">Available</option>
          <option value="false">Booked</option>
        </FormField>

        <div className="form-field form-grid__full">
          <label>Image</label>
          <ImageUploader images={image} onChange={setImage} multiple={false} />
        </div>
      </div>

      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={isSaving}>
          {isSaving ? "Saving…" : vehicle ? "Save Changes" : "Add Hire Vehicle"}
        </button>
        <button type="button" className="btn-ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
