/**
 * A shipment's progress: the stages as a stepper (done / current / to come)
 * and every update with its message and photos. Used on the customer account
 * page ("Track my vehicle") and the workspace's Shipments pages.
 */
import { SHIPMENT_STAGES, stageIndex, stageLabel } from "@/utils/shipmentStages";
import { resolveUploadUrl } from "@/utils/resolveUploadUrl";
import "./ShipmentTimeline.css";

export interface ShipmentUpdateView {
  stage: string | null;
  message: string;
  photos: string[];
  createdAt: string;
}

export default function ShipmentTimeline({ stage, eta, updates }: { stage: string | null; eta?: string | null; updates: ShipmentUpdateView[] }) {
  const current = stageIndex(stage);
  return (
    <div className="shipment">
      <ol className="shipment__steps" aria-label={`Progress: ${stageLabel(stage)}`}>
        {SHIPMENT_STAGES.map((step, index) => (
          <li
            key={step.key}
            className={index < current ? "shipment__step shipment__step--done" : index === current ? "shipment__step shipment__step--current" : "shipment__step"}
            aria-current={index === current ? "step" : undefined}
          >
            <span className="shipment__dot" aria-hidden="true">{index < current ? "✓" : index + 1}</span>
            <span className="shipment__label">{step.label}</span>
          </li>
        ))}
      </ol>
      {eta && (
        <p className="shipment__eta">
          Expected: <strong>{new Date(eta).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })}</strong>
        </p>
      )}
      {updates.length > 0 && (
        <ul className="shipment__updates">
          {[...updates].reverse().map((update, index) => (
            <li key={`${update.createdAt}-${index}`}>
              <div className="shipment__update-head">
                <strong>{stageLabel(update.stage)}</strong>
                <time dateTime={update.createdAt}>{new Date(update.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</time>
              </div>
              <p>{update.message}</p>
              {update.photos.length > 0 && (
                <div className="shipment__photos">
                  {update.photos.map((photo) => (
                    <a key={photo} href={resolveUploadUrl(photo)} target="_blank" rel="noopener noreferrer">
                      <img src={resolveUploadUrl(photo)} alt={`Photo: ${stageLabel(update.stage)}`} loading="lazy" />
                    </a>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
