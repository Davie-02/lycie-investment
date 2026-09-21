/**
 * The Deals page: every published, unexpired promotion (GET /api/deals). Admins publish deals from
 * Admin → Deals & Market; visitors never see where a deal was found. Updates live when an admin publishes.
 */
import Seo from "@/components/common/Seo";
import DealCard from "@/components/deals/DealCard";
import { useAsyncData } from "@/hooks/useAsyncData";
import { getDeals } from "@/services/deals.service";
import "@/components/deals/Deals.css";

export default function Deals() {
  const { data: deals, isLoading, error } = useAsyncData(getDeals, [], ["deals"]);

  return (
    <>
      <Seo title="Deals & promotions" description="Current deals and promotions on vehicles, imports and hire from Lycie Investments." />
      <section className="service-hero">
        <div className="container">
          <h1>Deals &amp; promotions</h1>
          <p>Limited-time offers on vehicles and imports.</p>
        </div>
      </section>
      <section className="section container">
        {isLoading && <p className="text-muted">Loading deals…</p>}
        {error && <p className="text-muted" role="alert">{error}</p>}
        {deals && deals.length === 0 && <p className="text-muted">There are no deals right now — check back soon, or <a href="/contact">ask us</a> what we can source for you.</p>}
        {deals && deals.length > 0 && (
          <div className="deals-grid">
            {deals.map((deal) => (
              <DealCard key={deal.id} deal={deal} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
