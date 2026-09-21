import { Link } from "react-router-dom";
import Price from "@/components/common/Price";
import type { PublicDeal } from "@/types/deal";
import "./Deals.css";

/** One promotion: headline, description, price (USD with kwacha equivalent) and how long it lasts. */
export default function DealCard({ deal }: { deal: PublicDeal }) {
  const until = deal.validUntil ? new Date(deal.validUntil).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" }) : null;
  return (
    <article className="deal-card">
      <span className="deal-card__tag">Deal</span>
      {deal.vehicleLabel && <p className="deal-card__vehicle text-muted mono">{deal.vehicleLabel}</p>}
      <h3>{deal.title}</h3>
      <p className="deal-card__summary">{deal.summary}</p>
      {deal.priceUsd && (
        <p className="deal-card__price mono">
          <Price amount={deal.priceUsd} currency="USD" />
        </p>
      )}
      {until && <p className="deal-card__until text-muted">Valid until {until}</p>}
      <Link to={`/contact?subject=${encodeURIComponent(`Deal: ${deal.title}`)}`} className="btn btn-secondary deal-card__cta">
        Ask about this deal
      </Link>
    </article>
  );
}
