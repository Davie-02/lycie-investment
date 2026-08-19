import { useState, type FormEvent, type ChangeEvent } from "react";
import FormField from "@/components/forms/FormField";
import FormStatusBanner from "@/components/forms/FormStatusBanner";
import ImageUploader from "./ImageUploader";
import { adminApi } from "../adminApi";
import { ApiError } from "@/services/http";
import type { Vehicle } from "@/types/vehicle";

interface VehicleFormProps {
  vehicle: Vehicle | null;
  onSaved: () => void;
  onCancel: () => void;
}

type FormValues = {
  slug: string;
  make: string;
  model: string;
  year: string;
  price: string;
  mileageKm: string;
  fuelType: string;
  transmission: string;
  bodyType: string;
  engine: string;
  driveType: string;
  condition: string;
  location: string;
  status: string;
  description: string;
  featuresText: string;
};

function toFormValues(vehicle: Vehicle | null): FormValues {
  if (!vehicle) {
    return {
      slug: "",
      make: "",
      model: "",
      year: String(new Date().getFullYear()),
      price: "",
      mileageKm: "",
      fuelType: "Petrol",
      transmission: "Automatic",
      bodyType: "",
      engine: "",
      driveType: "",
      condition: "",
      location: "",
      status: "available",
      description: "",
      featuresText: "",
    };
  }
  return {
    slug: vehicle.slug,
    make: vehicle.make,
    model: vehicle.model,
    year: String(vehicle.year),
    price: String(vehicle.price),
    mileageKm: String(vehicle.mileageKm),
    fuelType: vehicle.fuelType,
    transmission: vehicle.transmission,
    bodyType: vehicle.bodyType,
    engine: vehicle.engine,
    driveType: vehicle.driveType,
    condition: vehicle.condition,
    location: vehicle.location,
    status: vehicle.status,
    description: vehicle.description,
    featuresText: vehicle.features.join("\n"),
  };
}

export default function VehicleForm({ vehicle, onSaved, onCancel }: VehicleFormProps) {
  const [values, setValues] = useState<FormValues>(toFormValues(vehicle));
  const [images, setImages] = useState<string[]>(vehicle?.images ?? []);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleChange(field: keyof FormValues) {
    return (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      setValues((prev) => ({ ...prev, [field]: e.target.value }));
    };
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (images.length === 0) {
      setError("Add at least one image before saving.");
      return;
    }

    const payload = {
      slug: values.slug,
      make: values.make,
      model: values.model,
      year: Number(values.year),
      price: Number(values.price),
      mileageKm: Number(values.mileageKm),
      fuelType: values.fuelType,
      transmission: values.transmission,
      bodyType: values.bodyType,
      engine: values.engine,
      driveType: values.driveType,
      condition: values.condition,
      location: values.location,
      status: values.status,
      description: values.description,
      features: values.featuresText.split("\n").map((f) => f.trim()).filter(Boolean),
      images,
    };

    setIsSaving(true);
    try {
      if (vehicle) {
        await adminApi.patch(`/vehicles/${vehicle.id}`, payload);
      } else {
        await adminApi.post("/vehicles", payload);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save vehicle. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className="form-card" onSubmit={handleSubmit} noValidate>
      <h2>{vehicle ? `Edit ${vehicle.make} ${vehicle.model}` : "Add a Vehicle"}</h2>

      {error && <FormStatusBanner status="error" successMessage="" errorMessage={error} />}

      <div className="form-grid form-grid--2col">
        <FormField
          id="slug"
          label="Slug (used in the URL)"
          required
          value={values.slug}
          onChange={handleChange("slug")}
          placeholder="toyota-hilux-2022"
        />
        <FormField id="make" label="Make" required value={values.make} onChange={handleChange("make")} />
        <FormField id="model" label="Model" required value={values.model} onChange={handleChange("model")} />
        <FormField id="year" label="Year" type="number" required value={values.year} onChange={handleChange("year")} />
        <FormField id="price" label="Price (MWK)" type="number" required value={values.price} onChange={handleChange("price")} />
        <FormField id="mileageKm" label="Mileage (km)" type="number" required value={values.mileageKm} onChange={handleChange("mileageKm")} />

        <FormField id="fuelType" label="Fuel Type" as="select" value={values.fuelType} onChange={handleChange("fuelType")}>
          <option value="Petrol">Petrol</option>
          <option value="Diesel">Diesel</option>
          <option value="Hybrid">Hybrid</option>
          <option value="Electric">Electric</option>
        </FormField>

        <FormField id="transmission" label="Transmission" as="select" value={values.transmission} onChange={handleChange("transmission")}>
          <option value="Automatic">Automatic</option>
          <option value="Manual">Manual</option>
        </FormField>

        <FormField id="bodyType" label="Body Type" required value={values.bodyType} onChange={handleChange("bodyType")} placeholder="Sedan, SUV, Pickup..." />
        <FormField id="engine" label="Engine" required value={values.engine} onChange={handleChange("engine")} />
        <FormField id="driveType" label="Drive Type" required value={values.driveType} onChange={handleChange("driveType")} placeholder="4WD, FWD..." />
        <FormField id="condition" label="Condition" required value={values.condition} onChange={handleChange("condition")} />
        <FormField id="location" label="Location" required value={values.location} onChange={handleChange("location")} />

        <FormField id="status" label="Status" as="select" value={values.status} onChange={handleChange("status")}>
          <option value="available">Available</option>
          <option value="reserved">Reserved</option>
          <option value="sold">Sold</option>
        </FormField>

        <FormField
          id="description"
          label="Description"
          as="textarea"
          required
          value={values.description}
          onChange={handleChange("description")}
          wrapperClassName="form-grid__full"
        />

        <FormField
          id="featuresText"
          label="Features (one per line)"
          as="textarea"
          value={values.featuresText}
          onChange={handleChange("featuresText")}
          wrapperClassName="form-grid__full"
          placeholder={"4WD\nReverse camera\nAir conditioning"}
        />

        <div className="form-field form-grid__full">
          <label>Images</label>
          <ImageUploader images={images} onChange={setImages} />
        </div>
      </div>

      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={isSaving}>
          {isSaving ? "Saving…" : vehicle ? "Save Changes" : "Add Vehicle"}
        </button>
        <button type="button" className="btn-ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
