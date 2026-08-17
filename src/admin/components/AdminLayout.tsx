import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAdminAuth } from "../context/AdminAuthContext";
import "./AdminLayout.css";

export default function AdminLayout() {
  const { logout, currentUser } = useAdminAuth();
  const navigate = useNavigate();

  const navItems = [
    { to: "/admin", label: "Dashboard", end: true },
    { to: "/admin/vehicles", label: "Vehicles" },
    { to: "/admin/hire-vehicles", label: "Hire Vehicles" },
    { to: "/admin/requests", label: "Submitted Requests" },
    ...(currentUser?.role === "OWNER" ? [{ to: "/admin/users", label: "Admin Users" }] : []),
  ];

  function handleLogout() {
    logout();
    navigate("/admin/login");
  }

  return (
    <div className="admin-shell">
      <header className="admin-header">
        <div className="admin-header__row">
          <span className="admin-header__title">Lycie Investment — Admin</span>
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
            {currentUser && (
              <span className="admin-header__user-info">
                {currentUser.name} <span className="admin-header__role">{currentUser.role}</span>
              </span>
            )}
            <button type="button" className="btn-ghost admin-header__logout" onClick={handleLogout}>
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
