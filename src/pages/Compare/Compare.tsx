/**
 * Side-by-side comparison of up to three vehicles for sale (/compare?v=slug,slug).
 * Reached from "Add to compare" on a vehicle page or "Compare" on saved vehicles.
 * The best value in each comparable row (lowest price, lowest mileage, newest
 * year) is highlighted, so the differences stand out on a phone too.
 */
import { useSearchParams, Link } from "react-router-dom";
import Seo from "@/components/common/Seo";
import Price from "@/components/common/Price";
import { useAsyncData } from "@/hooks/useAsyncData";
import { getVehicleBySlug } from "@/services/vehicles.service";
import { resolveUploadUrl } from "@/utils/resolveUploadUrl";
import { formatMileage } from "@/utils/format";
import { MAX_COMPARE, getCompareList, removeFromCompare } from "@/utils/compareList";
import type { Vehicle } from "@/types/vehicle";
import "./Compare.css";

type Row = { label: string; value: (v: Vehicle) => React.ReactNode; best?: (vs: Vehicle[]) => number | null };

const indexOfMin = (values: number[]) => (values.length > 1 && new Set(values).size > 1 ? values.indexOf(Math.min(...values)) : null);
const indexOfMax = (values: number[]) => (values.length > 1 && new Set(values).size > 1 ? values.indexOf(Math.max(...values)) : null);

const ROWS: Row[] = [
  // Prices are only compared when all are in the same currency.
  {
    label: "Price",
    value: (v) => <Price amount={v.price} currency={v.currency} layout="inline" />,
    best: (vs) => (new Set(vs.map((v) => v.currency)).size === 1 ? indexOfMin(vs.map((v) => v.price)) : null),
  },
  { label: "Year", value: (v) => v.year, best: (vs) => indexOfMax(vs.map((v) => v.year)) },
  { label: "Mileage", value: (v) => formatMileage(v.mileageKm), best: (vs) => indexOfMin(vs.map((v) => v.mileageKm)) },
  { label: "Status", value: (v) => v.status },
  { label: "Body type", value: (v) => v.bodyType },
  { label: "Fuel", value: (v) => v.fuelType },
  { label: "Transmission", value: (v) => v.transmission },
  { label: "Engine", value: (v) => v.engine },
  { label: "Drive", value: (v) => v.driveType },
  { label: "Condition", value: (v) => v.condition },
  { label: "Location", value: (v) => v.location },
  { label: "Features", value: (v) => (v.features.length ? v.features.join(", ") : "—") },
];

export default function Compare() {
  const [params, setParams] = useSearchParams();
  const fromUrl = (params.get("v") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const slugs = (fromUrl.length ? fromUrl : getCompareList()).slice(0, MAX_COMPARE);

  const { data, isLoading } = useAsyncData(
    async () => (await Promise.all(slugs.map((slug) => getVehicleBySlug(slug).catch(() => null)))).filter((v): v is Vehicle => Boolean(v)),
    [slugs.join(",")],
    ["vehicles"]
  );
  const vehicles = data ?? [];

  return (
    <>
      <Seo title="Compare vehicles" description="Compare vehicles for sale side by side." />
      <section className="service-hero">
        <div className="container">
          <h1>Compare vehicles</h1>
          <p>See up to {MAX_COMPARE} vehicles side by side. The best value in each row is highlighted.</p>
        </div>
      </section>
      <section className="section container">
        {isLoading && <p className="text-muted">Loading…</p>}
        {!isLoading && vehicles.length < 2 && (
          <p className="text-muted">
            Pick at least two vehicles to compare: open a vehicle and press <strong>Add to compare</strong>.{" "}
            <Link to="/vehicles">Browse vehicles</Link>
          </p>
        )}
        {vehicles.length >= 1 && (
          <div className="compare-table-wrap">
            <table className="compare-table">
              <thead>
                <tr>
                  <th scope="col">
                    <span className="visually-hidden">Detail</span>
                  </th>
                  {vehicles.map((v) => (
                    <th scope="col" key={v.id}>
                      <Link to={`/vehicles/${v.slug}`} className="compare-table__vehicle">
                        {v.images[0] && <img src={resolveUploadUrl(v.images[0])} alt="" loading="lazy" />}
                        <span>
                          {v.year} {v.make} {v.model}
                        </span>
                      </Link>
                      <button
                        type="button"
                        className="link-button compare-table__remove"
                        onClick={() => {
                          removeFromCompare(v.slug);
                          setParams({ v: slugs.filter((slug) => slug !== v.slug).join(",") }, { replace: true });
                        }}
                      >
                        Remove
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROWS.map((row) => {
                  const best = row.best?.(vehicles) ?? null;
                  return (
                    <tr key={row.label}>
                      <th scope="row">{row.label}</th>
                      {vehicles.map((v, index) => (
                        <td key={v.id} className={best === index ? "compare-table__best" : undefined}>
                          {row.value(v)}
                          {best === index && <span className="visually-hidden"> (best)</span>}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
