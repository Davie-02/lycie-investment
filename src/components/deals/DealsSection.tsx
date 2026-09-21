import { Link } from "react-router-dom";
import { useAsyncData } from "@/hooks/useAsyncData";
import { getDeals } from "@/services/deals.service";
import DealCard from "./DealCard";
import "./Deals.css";

/**
 * "Latest deals" strip on the homepage. Shows the newest three published deals and quietly renders
 * nothing when there are none, so the homepage looks exactly as before until an admin publishes one.
 */
export default function DealsSection() {
  const { data: deals } = useAsyncData(getDeals, [], ["deals"]);
  if (!deals || deals.length === 0) return null;

  return (
    <section className="section container">
      <div className="section-heading">
        <span className="eyebrow">Current offers</span>
        <h2>Latest deals</h2>
        <p>Limited-time offers on vehicles and imports.</p>
      </div>
      <div className="deals-grid">
        {deals.slice(0, 3).map((deal) => (
          <DealCard key={deal.id} deal={deal} />
        ))}
      </div>
      {deals.length > 3 && (
        <p style={{ marginTop: "var(--space-5)" }}>
          <Link to="/deals" className="btn btn-secondary">See all deals</Link>
        </p>
      )}
    </section>
  );
}
