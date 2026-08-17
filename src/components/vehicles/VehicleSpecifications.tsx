import type { Vehicle } from "@/types/vehicle";
import { formatCurrency, formatMileage } from "@/utils/format";
import "./VehicleSpecifications.css";

interface VehicleSpecificationsProps {
  vehicle: Vehicle;
}

export default function VehicleSpecifications({ vehicle }: VehicleSpecificationsProps) {
  const specs: [string, string][] = [
    ["Make", vehicle.make],
    ["Model", vehicle.model],
    ["Year", String(vehicle.year)],
    ["Price", formatCurrency(vehicle.price, vehicle.currency)],
    ["Mileage", formatMileage(vehicle.mileageKm)],
    ["Fuel", vehicle.fuelType],
    ["Transmission", vehicle.transmission],
    ["Engine", vehicle.engine],
    ["Body Type", vehicle.bodyType],
    ["Drive Type", vehicle.driveType],
    ["Condition", vehicle.condition],
    ["Location", vehicle.location],
  ];

  return (
    <dl className="vehicle-specs">
      {specs.map(([label, value]) => (
        <div className="vehicle-specs__row" key={label}>
          <dt>{label}</dt>
          <dd className="mono">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
