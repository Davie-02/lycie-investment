/**
 * The customer portal (/account/*): a greeting, a menu of sections with live
 * badges (shipments on their way, unread messages), and the chosen section.
 * On desktop the menu is a sidebar; on phones it becomes a row of tabs you
 * swipe. Sections load on demand; the data they share loads once
 * (PortalContext) so moving between sections is instant.
 */
import { Suspense, useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import Seo from "@/components/common/Seo";
import { useCustomerAuth } from "@/context/CustomerAuthContext";
import { resendVerificationEmail } from "@/services/customer.service";
import { PortalProvider, usePortal } from "./PortalContext";
import { activeShipments } from "./shared";
import { PortalIcon, type PortalIconName } from "./icons";
import "../customer.css";
import "./portal.css";

interface Section {
  to: string;
  label: string;
  icon: PortalIconName;
  end?: boolean;
}

const PORTAL_SECTIONS: Section[] = [
  { to: "/account", label: "Overview", icon: "home", end: true },
  { to: "/account/track", label: "Track my vehicle", icon: "ship" },
  { to: "/account/requests", label: "My requests", icon: "list" },
  { to: "/account/purchases", label: "My purchases", icon: "receipt" },
  { to: "/account/payments", label: "Payments", icon: "wallet" },
  { to: "/account/saved", label: "Saved & alerts", icon: "heart" },
  { to: "/account/messages", label: "Messages", icon: "chat" },
  { to: "/account/invite", label: "Invite friends", icon: "gift" },
  { to: "/account/settings", label: "Profile & security", icon: "user" },
];

export default function PortalLayout() {
  return (
    <PortalProvider>
      <PortalShell />
    </PortalProvider>
  );
}

function PortalShell() {
  const { currentUser, logout } = useCustomerAuth();
  const { cases, purchases, unreadMessages } = usePortal();
  const navigate = useNavigate();
  const location = useLocation();
  const [verifyNotice, setVerifyNotice] = useState<"idle" | "sending" | "sent" | "error">("idle");

  // Older email links pointed at /account#track.
  useEffect(() => {
    if (location.pathname === "/account" && location.hash === "#track") navigate("/account/track", { replace: true });
  }, [location.pathname, location.hash, navigate]);

  // On phones the menu is a sideways-scrolling row: keep the current section's tab in view.
  useEffect(() => {
    document.querySelector(".portal-nav__link.active")?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [location.pathname]);

  const badges: Record<string, number> = {
    "/account/track": activeShipments(cases).length,
    "/account/messages": unreadMessages,
    "/account/purchases": purchases.filter((p) => p.status === "active" && Number(p.balance) > 0).length,
  };
  const current = PORTAL_SECTIONS.find((s) => (s.end ? location.pathname === s.to : location.pathname.startsWith(s.to)));

  async function resend() {
    setVerifyNotice("sending");
    try {
      await resendVerificationEmail();
      setVerifyNotice("sent");
    } catch {
      setVerifyNotice("error");
    }
  }

  return (
    <>
      <Seo noindex title={current ? `${current.label} — My account` : "My account"} description="Your Lycie Investments account." />
      <section className="portal-hero">
        <div className="container portal-hero__row">
          <div>
            <p className="portal-hero__eyebrow">My account</p>
            <h1>Hello, {currentUser?.name?.split(" ")[0] ?? "there"}</h1>
          </div>
          <button
            type="button"
            className="customer-account__logout"
            onClick={() => {
              logout();
              navigate("/account/login");
            }}
          >
            Sign out
          </button>
        </div>
      </section>

      <div className="container portal">
        <nav className="portal-nav" aria-label="My account">
          {PORTAL_SECTIONS.map((section) => (
            <NavLink key={section.to} to={section.to} end={section.end} className="portal-nav__link">
              <PortalIcon name={section.icon} />
              <span>{section.label}</span>
              {badges[section.to] > 0 && <span className="portal-nav__badge">{badges[section.to]}</span>}
            </NavLink>
          ))}
        </nav>

        <main className="portal-main">
          {currentUser && !currentUser.emailVerifiedAt && (
            <div className="form-status form-status--info" role="status">
              <strong>Please confirm your email address.</strong> We sent a link to {currentUser.email}.{" "}
              {verifyNotice === "sent" ? (
                "A new link is on its way."
              ) : (
                <button type="button" className="link-button" onClick={() => void resend()} disabled={verifyNotice === "sending"}>
                  {verifyNotice === "sending" ? "Sending…" : verifyNotice === "error" ? "Couldn't send — try again" : "Send the link again"}
                </button>
              )}
            </div>
          )}
          <Suspense fallback={<p className="text-muted">Loading…</p>}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </>
  );
}
