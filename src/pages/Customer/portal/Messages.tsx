/** Messages from our team. Opening them marks them read, which clears the menu badge. */
import MyMessages from "@/components/customer/MyMessages";
import { usePortal } from "./PortalContext";
import PortalHeading from "./PortalHeading";
import { useEffect } from "react";

export default function Messages() {
  const { setUnreadMessages } = usePortal();
  // MyMessages marks everything read as soon as it opens.
  useEffect(() => setUnreadMessages(0), [setUnreadMessages]);
  return (
    <>
      <PortalHeading title="Messages" intro="Messages from our team about your vehicles, bookings and requests." />
      <MyMessages />
    </>
  );
}
