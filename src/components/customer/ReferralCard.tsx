/**
 * "Invite friends" on the customer account page: the customer's personal share
 * link, and how many friends joined and were rewarded.
 */
import { useEffect, useState } from "react";
import { getMyReferral, type MyReferral } from "@/services/customer.service";

export default function ReferralCard() {
  const [referral, setReferral] = useState<MyReferral | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    getMyReferral().then(setReferral).catch(() => undefined);
  }, []);

  if (!referral) return null;
  const message = `I buy, import and hire vehicles with Lycie Investments. Create your account with my link: ${referral.link}`;
  const shareOnWhatsApp = `https://wa.me/?text=${encodeURIComponent(message)}`;

  return (
    <div className="customer-account__history">
      <h2>Invite friends</h2>
      <p className="text-muted">
        Share your link. When a friend who joins through it buys, imports or hires with us, we'll add a thank-you reward to your account.
      </p>
      <div className="form-card customer-account__form">
        <p className="mono" style={{ overflowWrap: "anywhere", margin: 0 }}>{referral.link}</p>
        <div className="form-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              void navigator.clipboard?.writeText(referral.link).then(() => setCopied(true));
            }}
          >
            {copied ? "Copied" : "Copy link"}
          </button>
          <a className="btn btn-whatsapp" href={shareOnWhatsApp} target="_blank" rel="noopener noreferrer">
            Share on WhatsApp
          </a>
        </div>
        <p className="text-muted" style={{ marginBottom: 0 }}>
          {referral.invited} friend{referral.invited === 1 ? "" : "s"} joined · {referral.rewarded} rewarded
          {referral.rewardsTotal ? ` · MWK ${referral.rewardsTotal.toLocaleString()} earned` : ""}
        </p>
      </div>
    </div>
  );
}
