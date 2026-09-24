/**
 * Track my vehicle: every import or clearing we're handling for the customer,
 * with its stages, updates, photos and private tracking code. Updates arrive
 * live. This is the only place customers can track a vehicle.
 */
import ShipmentTimeline from "@/components/common/ShipmentTimeline";
import { usePortal } from "./PortalContext";
import PortalHeading from "./PortalHeading";

export default function TrackVehicle() {
  const { cases, isLoading } = usePortal();
  if (isLoading) return <p className="text-muted">Loading…</p>;

  return (
    <>
      <PortalHeading title="Track my vehicle" intro="Where each vehicle we're importing or clearing for you is right now. Updates appear here the moment we post them." />
      {cases.length === 0 ? (
        <div className="portal-card">
          <p className="text-muted" style={{ margin: 0 }}>
            Nothing to track yet. When we import or clear a vehicle for you, its progress appears here.
          </p>
        </div>
      ) : (
        <div className="customer-cases">
          {cases.map((customerCase) => (
            <article className="customer-case" key={customerCase.id}>
              <div className="customer-case__heading">
                <div>
                  <h3>{customerCase.title}</h3>
                  <p className="text-muted">
                    {customerCase.vehicle
                      ? `${customerCase.vehicle.make} ${customerCase.vehicle.model} (${customerCase.vehicle.year})`
                      : customerCase.hireVehicle?.name}
                  </p>
                </div>
                <strong>{customerCase.status.replace("_", " ")}</strong>
              </div>
              {customerCase.details && <p>{customerCase.details}</p>}
              {customerCase.trackingCode ? (
                <>
                  <p className="text-muted">
                    Your tracking code: <span className="mono">{customerCase.trackingCode}</span> — keep it private; our team will ask for it
                    when you contact us about this vehicle.
                  </p>
                  <ShipmentTimeline
                    stage={customerCase.stage ?? null}
                    eta={customerCase.eta}
                    updates={[...customerCase.updates].reverse().map((update) => ({ ...update, stage: update.stage ?? null, photos: update.photos ?? [] }))}
                  />
                </>
              ) : (
                <ul>
                  {customerCase.updates.map((update) => (
                    <li key={update.id}>
                      <span className="mono">{new Date(update.createdAt).toLocaleDateString()}</span> {update.message}
                    </li>
                  ))}
                </ul>
              )}
            </article>
          ))}
        </div>
      )}
    </>
  );
}
