/**
 * The staff workspace shell: a sidebar grouped by module (only the modules this
 * person can use, each with a "needs attention" badge), a top bar (search,
 * theme, account menu), tabs for the pages of the current module, and the page.
 *
 * Fast by design: the shell stays put while a page loads (its own spinner
 * inside), links start downloading their page on hover, and the badge numbers
 * come from one cached request shared with the dashboards.
 */
import { Suspense, useEffect, useMemo, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAdminAuth } from "../context/AdminAuthContext";
import { useIdleTimeout } from "../hooks/useIdleTimeout";
import { DATA_CHANGED_EVENT, SESSION_EXPIRED_EVENT, TWO_FACTOR_REQUIRED_EVENT } from "../adminApi";
import { MODULES, WORKSPACE_PAGES, ICONS, moduleForPath, moduleHomePath, prefetch, type IconName, type ModuleDef, type PageDef } from "../modules";
import { attentionCount, clearWorkspaceSummary, useWorkspaceSummary } from "../hooks/useWorkspaceSummary";
import { useAdminTheme, type AdminThemeMode } from "../hooks/useAdminTheme";
import "./AdminLayout.css";
import "./AdminShell.css";
import AdminSearch from "./AdminSearch";
import UndoToast from "./UndoToast";

// Idle auto-logout (a valid session doesn't help if someone walked away from an
// unlocked screen). System administrators get a shorter one and never "keep me signed in".
const IDLE_TIMEOUT_MS = 5 * 60 * 1000;
const SYSTEM_ADMIN_IDLE_MS = 3 * 60 * 1000;
const COLLAPSE_KEY = "lycie_admin_sidebar";

const ROLE_LABEL: Record<string, string> = { OWNER: "System administrator", MANAGER: "Manager", VIEWER: "Viewer", EMPLOYEE: "Staff" };
const DEPARTMENT_LABEL: Record<string, string> = {
  management: "Management",
  sales: "Sales",
  hire: "Hire & Fleet",
  imports: "Imports & Clearing",
  finance: "Finance",
  customer_care: "Customer Care",
  marketing: "Marketing",
  hr: "Human Resources",
  general: "General staff",
};

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  );
}

const THEME_OPTIONS: Array<{ mode: AdminThemeMode; label: string; glyph: string }> = [
  { mode: "light", label: "Light", glyph: "☀" },
  { mode: "dark", label: "Dark", glyph: "☾" },
  { mode: "system", label: "Match device", glyph: "◐" },
];

export default function AdminLayout() {
  const { logout, currentUser, isAuthenticated, isRemembered, isSystemAdmin, can } = useAdminAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { mode, setMode } = useAdminTheme();
  const { data: summary } = useWorkspaceSummary();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === "1";
    } catch {
      return false;
    }
  });

  function handleLogout(reason?: "inactivity" | "expired") {
    clearWorkspaceSummary();
    logout();
    navigate(isSystemAdmin ? "/admin/login" : "/account/login", { state: reason ? { reason } : undefined });
  }

  useIdleTimeout(isSystemAdmin ? SYSTEM_ADMIN_IDLE_MS : IDLE_TIMEOUT_MS, () => handleLogout("inactivity"), isAuthenticated && (isSystemAdmin || !isRemembered));

  // Any API call that finds the session over sends everyone back to sign in at once.
  useEffect(() => {
    const onExpired = () => handleLogout("expired");
    const onTwoFactorRequired = () => navigate("/admin/security", { replace: true });
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    window.addEventListener(TWO_FACTOR_REQUIRED_EVENT, onTwoFactorRequired);
    return () => {
      window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
      window.removeEventListener(TWO_FACTOR_REQUIRED_EVENT, onTwoFactorRequired);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // After an undo, remount the current page so it reloads whatever the undo changed.
  const [reloadKey, setReloadKey] = useState(0);
  useEffect(() => {
    const reload = () => setReloadKey((key) => key + 1);
    window.addEventListener(DATA_CHANGED_EVENT, reload);
    return () => window.removeEventListener(DATA_CHANGED_EVENT, reload);
  }, []);

  // Close the phone drawer and menus when the page changes.
  useEffect(() => {
    setDrawerOpen(false);
    setMenuOpen(false);
  }, [location.pathname]);

  const visiblePage = (module: ModuleDef, page: PageDef) =>
    !page.hidden && (page.systemAdminOnly ? isSystemAdmin : can(module.key, page.level ?? "view"));
  const modules = useMemo(
    () => MODULES.map((module) => ({ ...module, pages: module.pages.filter((page) => visiblePage(module, page)) })).filter((module) => module.pages.length > 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentUser]
  );
  const current = moduleForPath(location.pathname);
  const currentModule = current ? modules.find((m) => m.key === current.key) : undefined;
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => new Set(current ? [current.key] : []));
  useEffect(() => {
    if (current) setOpenGroups((prev) => (prev.has(current.key) ? prev : new Set(prev).add(current.key)));
  }, [current]);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, prev ? "0" : "1");
      } catch {
        // just not remembered
      }
      return !prev;
    });
  }

  const currentPage = currentModule?.pages.find((p) => p.path === location.pathname) ?? WORKSPACE_PAGES.find((p) => p.path === location.pathname);
  const who = currentUser?.department ? DEPARTMENT_LABEL[currentUser.department] ?? currentUser.department : ROLE_LABEL[currentUser?.role ?? ""];

  return (
    <div className={`ws${collapsed ? " ws--collapsed" : ""}${drawerOpen ? " ws--drawer" : ""}`}>
      <a className="ws-skip" href="#ws-main">Skip to content</a>
      <aside className="ws-sidebar" aria-label="Workspace">
        <div className="ws-brand">
          <Link to="/admin" className="ws-brand__name">
            <span className="ws-brand__mark">L</span>
            <span className="ws-label">Lycie <em>Workspace</em></span>
          </Link>
          <button type="button" className="ws-icon-button ws-only-mobile" onClick={() => setDrawerOpen(false)} aria-label="Close menu">
            ×
          </button>
        </div>

        <nav className="ws-nav">
          <ul className="ws-nav__list">
            {WORKSPACE_PAGES.filter((p) => p.path === "/admin" || p.path === "/admin/me").map((page) => (
              <li key={page.path}>
                <NavLink to={page.path} end className="ws-link" onMouseEnter={() => prefetch(page.path)} onFocus={() => prefetch(page.path)} title={page.label}>
                  <Icon name={page.path === "/admin" ? "home" : "user"} />
                  <span className="ws-label">{page.path === "/admin" ? "Home" : "My work & leave"}</span>
                </NavLink>
              </li>
            ))}
          </ul>

          {modules.length > 0 && <p className="ws-nav__heading ws-label">Departments</p>}
          <ul className="ws-nav__list">
            {modules.map((module) => {
              const open = openGroups.has(module.key) && !collapsed;
              const badge = attentionCount(summary?.[module.key]);
              return (
                <li key={module.key} className={current?.key === module.key ? "ws-group ws-group--current" : "ws-group"}>
                  <button
                    type="button"
                    className="ws-link ws-group__toggle"
                    aria-expanded={open}
                    title={module.label}
                    onClick={() => {
                      if (collapsed) {
                        navigate(moduleHomePath(module.key));
                        return;
                      }
                      setOpenGroups((prev) => {
                        const next = new Set(prev);
                        if (next.has(module.key)) next.delete(module.key);
                        else next.add(module.key);
                        return next;
                      });
                    }}
                    onMouseEnter={() => prefetch(moduleHomePath(module.key))}
                  >
                    <Icon name={module.icon} />
                    <span className="ws-label">{module.label}</span>
                    {badge > 0 && <span className="ws-badge" aria-label={`${badge} need attention`}>{badge > 99 ? "99+" : badge}</span>}
                    <span className="ws-chevron ws-label" aria-hidden="true">{open ? "▾" : "▸"}</span>
                  </button>
                  {open && (
                    <ul className="ws-subnav">
                      <li>
                        <NavLink to={moduleHomePath(module.key)} className="ws-sublink" end>
                          Overview
                        </NavLink>
                      </li>
                      {module.pages.map((page) => (
                        <li key={page.path}>
                          <NavLink to={page.path} className="ws-sublink" onMouseEnter={() => prefetch(page.path)} onFocus={() => prefetch(page.path)}>
                            {page.label}
                          </NavLink>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>

          <p className="ws-nav__heading ws-label">You</p>
          <ul className="ws-nav__list">
            {WORKSPACE_PAGES.filter((p) => !["/admin", "/admin/me"].includes(p.path)).map((page) => (
              <li key={page.path}>
                <NavLink to={page.path} className="ws-link" onMouseEnter={() => prefetch(page.path)} title={page.label}>
                  <Icon name={page.path.endsWith("security") ? "shield" : page.path.endsWith("activity") ? "undo" : "book"} />
                  <span className="ws-label">{page.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="ws-sidebar__foot">
          <div className="ws-theme" role="radiogroup" aria-label="Theme">
            {THEME_OPTIONS.map((option) => (
              <button
                key={option.mode}
                type="button"
                role="radio"
                aria-checked={mode === option.mode}
                className={mode === option.mode ? "ws-theme__option ws-theme__option--on" : "ws-theme__option"}
                onClick={() => setMode(option.mode)}
                title={option.label}
              >
                <span aria-hidden="true">{option.glyph}</span>
                <span className="ws-label">{option.label}</span>
              </button>
            ))}
          </div>
          <button type="button" className="ws-link ws-collapse ws-only-desktop" onClick={toggleCollapsed} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
            <span aria-hidden="true">{collapsed ? "»" : "«"}</span>
            <span className="ws-label">Collapse</span>
          </button>
        </div>
      </aside>
      {drawerOpen && <div className="ws-scrim" onClick={() => setDrawerOpen(false)} aria-hidden="true" />}

      <div className="ws-body">
        <header className="ws-topbar">
          <button type="button" className="ws-icon-button ws-only-mobile" onClick={() => setDrawerOpen(true)} aria-label="Open menu">
            ☰
          </button>
          <nav className="ws-crumbs" aria-label="Breadcrumb">
            <Link to="/admin">Workspace</Link>
            {currentModule && (
              <>
                <span aria-hidden="true">/</span>
                <Link to={moduleHomePath(currentModule.key)}>{currentModule.label}</Link>
              </>
            )}
            {currentPage && currentPage.path !== "/admin" && (
              <>
                <span aria-hidden="true">/</span>
                <span aria-current="page">{currentPage.label}</span>
              </>
            )}
          </nav>
          <div className="ws-topbar__tools">
            {modules.length > 0 && <AdminSearch />}
            <div className="ws-account">
              <button type="button" className="ws-account__button" aria-haspopup="menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>
                <span className="ws-avatar" aria-hidden="true">{(currentUser?.name ?? "?").slice(0, 1).toUpperCase()}</span>
                <span className="ws-account__text">
                  <strong>{currentUser?.name}</strong>
                  <small>{who}</small>
                </span>
              </button>
              {menuOpen && (
                <div className="ws-menu" role="menu">
                  <p className="ws-menu__who">
                    {currentUser?.email}
                    <br />
                    <span className={isSystemAdmin ? "ws-pill ws-pill--admin" : "ws-pill"}>{ROLE_LABEL[currentUser?.role ?? ""]}</span>
                    {currentUser?.jobTitle && <span className="ws-menu__job">{currentUser.jobTitle}</span>}
                  </p>
                  <Link role="menuitem" to="/admin/me">My work & leave</Link>
                  <Link role="menuitem" to="/admin/security">My security</Link>
                  <Link role="menuitem" to="/">View website</Link>
                  <button role="menuitem" type="button" onClick={() => handleLogout()}>
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {currentUser?.mustSetUpTwoFactor && (
          <div className="ws-alert" role="alert">
            <strong>Action needed:</strong> system administrator accounts must use two-step verification. Set it up below — the
            rest of the workspace unlocks as soon as it's on.
          </div>
        )}

        {currentModule && currentModule.pages.length > 1 && !location.pathname.startsWith("/admin/m/") && (
          <nav className="ws-tabs" aria-label={`${currentModule.label} pages`}>
            <NavLink to={moduleHomePath(currentModule.key)} className="ws-tab" end>
              Overview
            </NavLink>
            {currentModule.pages.map((page) => (
              <NavLink key={page.path} to={page.path} className="ws-tab" onMouseEnter={() => prefetch(page.path)}>
                {page.label}
              </NavLink>
            ))}
          </nav>
        )}

        <main className="ws-main" id="ws-main">
          <Suspense fallback={<PageSkeleton />}>
            <Outlet key={reloadKey} />
          </Suspense>
        </main>
      </div>
      <UndoToast />
    </div>
  );
}

/** Shown for the split second a page's code is downloading. */
function PageSkeleton() {
  return (
    <div className="ws-skeleton" aria-busy="true" aria-label="Loading">
      <div className="ws-skeleton__bar ws-skeleton__bar--title" />
      <div className="ws-skeleton__bar" />
      <div className="ws-skeleton__grid">
        <div className="ws-skeleton__card" />
        <div className="ws-skeleton__card" />
        <div className="ws-skeleton__card" />
      </div>
    </div>
  );
}
