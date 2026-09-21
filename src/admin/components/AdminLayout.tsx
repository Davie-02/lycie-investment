import { useEffect } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAdminAuth } from "../context/AdminAuthContext";
import { useIdleTimeout } from "../hooks/useIdleTimeout";
import { SESSION_EXPIRED_EVENT } from "../adminApi";
import "./AdminLayout.css";
import AdminSearch from "./AdminSearch";

// 5 minutes of no mouse/keyboard/scroll activity auto-logs-out the admin
// dashboard — separate from the JWT's own (longer) expiry, since a valid
// token doesn't help if someone's walked away from an unlocked screen.
// Skipped when the admin chose "Keep me signed in" on a device they trust.
const IDLE_TIMEOUT_MS = 5 * 60 * 1000;

export default function AdminLayout() {
  const { logout, currentUser, isAuthenticated, isRemembered } = useAdminAuth();
  const navigate = useNavigate();

  function handleLogout(reason?: "inactivity" | "expired") {
    logout();
    navigate("/admin/login", { state: reason ? { reason } : undefined });
  }

  useIdleTimeout(IDLE_TIMEOUT_MS, () => handleLogout("inactivity"), isAuthenticated && !isRemembered);

  // Fires the moment any admin API call gets a 401 (e.g. the token expired
  // server-side) — redirects immediately instead of leaving the user on a
  // dead session until they happen to trigger another request.
  useEffect(() => {
    function onSessionExpired() {
      handleLogout("expired");
    }
    window.addEventListener(SESSION_EXPIRED_EVENT, onSessionExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onSessionExpired);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const navItems = [
    { to: "/admin", label: "Dashboard", end: true },
    { to: "/admin/vehicles", label: "Vehicles" },
    { to: "/admin/hire-vehicles", label: "Hire Vehicles" },
    { to: "/admin/requests", label: "Submitted Requests" },
    { to: "/admin/bookings", label: "Bookings" },
    { to: "/admin/security", label: "My Security" },
    ...(currentUser?.role === "OWNER" || currentUser?.role === "MANAGER"
      ? [{ to: "/admin/payments", label: "Payments" }]
      : []),
    ...(currentUser?.role === "OWNER" || currentUser?.role === "MANAGER"
      ? [
          { to: "/admin/site-content", label: "Site Content" },
          { to: "/admin/notices", label: "Notices" },
          { to: "/admin/testimonials", label: "Testimonials" },
          { to: "/admin/faq", label: "FAQ" },
          { to: "/admin/blog", label: "Blog" },
          { to: "/admin/reviews", label: "Reviews" },
          { to: "/admin/insights", label: "Insights" },
          { to: "/admin/deals", label: "Deals & Market" },
          { to: "/admin/social", label: "Social Media" },
          { to: "/admin/lycie", label: "Lycie AI" },
        ]
      : []),
    ...(currentUser?.role === "OWNER"
      ? [
          { to: "/admin/users", label: "Admin Users" },
          { to: "/admin/activity", label: "Activity" },
        ]
      : []),
  ];

  return (
    <div className="admin-shell">
      <header className="admin-header">
        <div className="admin-header__row">
          <span className="admin-header__title">Lycie Investments — Admin</span>
          <nav className="admin-nav" aria-label="Admin">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  isActive ? "admin-nav__link admin-nav__link--active" : "admin-nav__link"
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="admin-header__user">
            {(currentUser?.role === "OWNER" || currentUser?.role === "MANAGER") && <AdminSearch />}
            {currentUser && (
              <span className="admin-header__user-info">
                {currentUser.name} <span className="admin-header__role">{currentUser.role}</span>
              </span>
            )}
            <button
              type="button"
              className="btn-ghost admin-header__logout"
              onClick={() => handleLogout()}
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  );
}
