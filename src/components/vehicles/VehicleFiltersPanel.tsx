import type { Vehicle } from "@/types/vehicle";
import type { VehicleFilters } from "@/utils/vehicleFilters";
import { getUniqueValues } from "@/utils/vehicleFilters";
import "./VehicleFiltersPanel.css";

interface VehicleFiltersPanelProps {
  vehicles: Vehicle[];
  filters: VehicleFilters;
  onChange: (filters: VehicleFilters) => void;
  onReset: () => void;
}

export default function VehicleFiltersPanel({
  vehicles,
  filters,
  onChange,
  onReset,
}: VehicleFiltersPanelProps) {
  const makes = getUniqueValues(vehicles, "make");
  const bodyTypes = getUniqueValues(vehicles, "bodyType");

  function update<K extends keyof VehicleFilters>(key: K, value: VehicleFilters[K]) {
    onChange({ ...filters, [key]: value });
  }

  return (
    <div className="vehicle-filters">
      <div className="vehicle-filters__search">
        <label htmlFor="vehicle-search" className="visually-hidden">
          Search vehicles
        </label>
        <input
          id="vehicle-search"
          type="search"
          placeholder="Search by make, model or year"
          value={filters.search}
          onChange={(e) => update("search", e.target.value)}
          className="form-field__input"
        />
      </div>

      <div className="vehicle-filters__row">
        <select
          aria-label="Filter by make"
          value={filters.make}
          onChange={(e) => update("make", e.target.value)}
          className="form-field__input"
        >
          <option value="">All Makes</option>
          {makes.map((make) => (
            <option key={make} value={make}>
              {make}
            </option>
          ))}
        </select>

        <select
          aria-label="Filter by body type"
          value={filters.bodyType}
          onChange={(e) => update("bodyType", e.target.value)}
          className="form-field__input"
        >
          <option value="">All Body Types</option>
          {bodyTypes.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>

        <select
          aria-label="Filter by fuel type"
          value={filters.fuelType}
          onChange={(e) => update("fuelType", e.target.value)}
          className="form-field__input"
        >
          <option value="">All Fuel Types</option>
          <option value="Petrol">Petrol</option>
          <option value="Diesel">Diesel</option>
          <option value="Hybrid">Hybrid</option>
          <option value="Electric">Electric</option>
        </select>

        <select
          aria-label="Filter by transmission"
          value={filters.transmission}
          onChange={(e) => update("transmission", e.target.value)}
          className="form-field__input"
        >
          <option value="">All Transmissions</option>
          <option value="Automatic">Automatic</option>
          <option value="Manual">Manual</option>
        </select>

        <select
          aria-label="Filter by status"
          value={filters.status}
          onChange={(e) => update("status", e.target.value)}
          className="form-field__input"
        >
          <option value="">Any Status</option>
          <option value="available">Available</option>
          <option value="reserved">Reserved</option>
          <option value="sold">Sold</option>
        </select>

        <input
          type="number"
          aria-label="Maximum price"
          placeholder="Max price (MWK)"
          value={filters.maxPrice}
          onChange={(e) => update("maxPrice", e.target.value)}
          className="form-field__input"
        />

        <button type="button" className="btn-ghost vehicle-filters__reset" onClick={onReset}>
          Clear filters
        </button>
      </div>
    </div>
  );
}
