/** Invite friends: the customer's share link and their rewards. */
import ReferralCard from "@/components/customer/ReferralCard";
import PortalHeading from "./PortalHeading";

export default function Invite() {
  return (
    <>
      <PortalHeading title="Invite friends" intro="Share your link — when a friend who joins through it does business with us, we add a thank-you reward to your balance." />
      <ReferralCard withHeading={false} />
    </>
  );
}
