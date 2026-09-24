/**
 * Portal overview: the customer's key numbers at a glance (balance, what's
 * still to pay on purchases, vehicles on their way, open requests, saved vehicles, unread messages), the latest on
 * each shipment, recent requests, and shortcuts to what they usually do next.
 */
import { Link } from "react-router-dom";
import { useSavedVehicles } from "@/context/SavedVehiclesContext";
import { formatCurrency } from "@/utils/format";
import { money } from "@/utils/purchases";
import { stageLabel } from "@/utils/shipmentStages";
import { usePortal } from "./PortalContext";
import { activeShipments, openRequests } from "./shared";
import PortalHeading from "./PortalHeading";
import { REQUEST_TYPE_LABELS, statusTone } from "./shared";

export default function Overview() {
  const { account, purchases, cases, requests, unreadMessages, isLoading, loadError } = usePortal();
  const { savedVehicles } = useSavedVehicles();
  const onTheWay = activeShipments(cases);
  const open = openRequests(requests);

  if (isLoading) return <p className="text-muted">Loading your account…</p>;
  if (loadError) return <p className="text-muted" role="alert">{loadError}</p>;

  // What's still owed on purchases, per currency (dollars and kwacha aren't added together).
  const owed = new Map<string, number>();
  for (const p of purchases) if (p.status === "active" && Number(p.balance) > 0) owed.set(p.currency, (owed.get(p.currency) ?? 0) + Number(p.balance));

  const stats = [
    ...[...owed.entries()].map(([currency, amount]) => ({ to: "/account/purchases", value: money(amount, currency), label: "Still to pay on purchases" })),
    { to: "/account/payments", value: account ? formatCurrency(Number(account.balance), account.currency) : "—", label: "Account balance" },
    { to: "/account/track", value: String(onTheWay.length), label: onTheWay.length === 1 ? "Vehicle on its way" : "Vehicles on their way" },
    { to: "/account/requests", value: String(open.length), label: "Open requests" },
    { to: "/account/saved", value: String(savedVehicles.length), label: "Saved vehicles" },
    { to: "/account/messages", value: String(unreadMessages), label: "Unread messages" },
  ];

  return (
    <>
      <PortalHeading title="Overview" intro="Everything about your vehicles, requests and payments in one place." />

      <div className="portal-stats">
        {stats.map((stat) => (
          <Link key={stat.to} to={stat.to} className="portal-stat">
            <span className="portal-stat__value">{stat.value}</span>
            <span className="portal-stat__label">{stat.label}</span>
          </Link>
        ))}
      </div>

      {onTheWay.length > 0 && (
        <section className="portal-card">
          <h3>Your vehicles on the way</h3>
          <ul className="portal-list">
            {onTheWay.map((shipment) => (
              <li key={shipment.id}>
                <span>
                  <strong>{shipment.title}</strong>
                  {shipment.eta && <span className="text-muted"> · expected {new Date(shipment.eta).toLocaleDateString()}</span>}
                </span>
                <Link to="/account/track" className="portal-pill">
                  {stageLabel(shipment.stage)}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="portal-card">
        <h3>Recent requests</h3>
        {requests.length === 0 ? (
          <p className="text-muted">Nothing yet. Requests you send while signed in appear here.</p>
        ) : (
          <ul className="portal-list">
            {requests.slice(0, 4).map((request) => (
              <li key={`${request.type}-${request.id}`}>
                <span>
                  <strong>{REQUEST_TYPE_LABELS[request.type]}</strong> <span className="text-muted">· {request.summary}</span>
                </span>
                <span className={`portal-pill ${statusTone(request.status)}`}>{request.status.replace("_", " ")}</span>
              </li>
            ))}
          </ul>
        )}
        {requests.length > 4 && (
          <p style={{ marginBottom: 0 }}>
            <Link to="/account/requests">See all requests →</Link>
          </p>
        )}
      </section>

      <section>
        <h3>What would you like to do?</h3>
        <div className="portal-actions">
          <Link to="/vehicles" className="portal-action">
            Browse vehicles<span>Cars in stock now</span>
          </Link>
          <Link to="/hire" className="portal-action">
            Hire a vehicle<span>See free dates and prices</span>
          </Link>
          <Link to="/import" className="portal-action">
            Import a vehicle<span>Tell us what you're looking for</span>
          </Link>
          <Link to="/clearing" className="portal-action">
            Clear a vehicle<span>We handle customs for you</span>
          </Link>
          <Link to="/account/purchases" className="portal-action">
            My purchases<span>Costs, payments and what's left to pay</span>
          </Link>
          <Link to="/account/payments" className="portal-action">
            Make a payment<span>Mobile money or proof of payment</span>
          </Link>
        </div>
      </section>
    </>
  );
}
