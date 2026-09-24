/** Finance → Prices & currency: exchange rate, margin and how prices are shown (the same settings as before, now in Finance). */
import PricingSettings from "../components/PricingSettings";
import "../components/AdminLayout.css";
import "@/components/forms/FormField.css";

export default function AdminPricing() {
  return (
    <div>
      <div className="ws-hero">
        <div>
          <h1>Prices & currency</h1>
          <p>Prices are stored in US dollars and shown with the kwacha equivalent at this rate.</p>
        </div>
      </div>
      <PricingSettings />
    </div>
  );
}
