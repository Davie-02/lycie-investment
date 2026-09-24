/**
 * A module's overview (/admin/m/<module>): its numbers and a card for each of
 * its pages the person can open. The module tabs and sidebar lead here too.
 */
import { Link, Navigate, useParams } from "react-router-dom";
import { useAdminAuth } from "../context/AdminAuthContext";
import { useWorkspaceSummary } from "../hooks/useWorkspaceSummary";
import { MODULES, prefetch } from "../modules";
import { Icon } from "../components/AdminLayout";
import { StatTile } from "./AdminDashboard";
import { LEVEL_LABELS } from "../access";

export default function ModuleHome() {
  const { module: key } = useParams();
  const { can, currentUser, isSystemAdmin } = useAdminAuth();
  const { data } = useWorkspaceSummary();
  const module = MODULES.find((m) => m.key === key);
  if (!module || !can(module.key)) return <Navigate to="/admin" replace />;

  const pages = module.pages.filter((page) => !page.hidden && (page.systemAdminOnly ? isSystemAdmin : can(module.key, page.level ?? "view")));
  const level = isSystemAdmin ? "manage" : currentUser?.access?.[module.key] ?? "none";

  return (
    <div>
      <div className="ws-hero">
        <div>
          <h1 style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <Icon name={module.icon} size={28} /> {module.label}
          </h1>
          <p>{module.description}</p>
        </div>
        <span className="ws-chip" title="Your access to this module">
          Your access: {LEVEL_LABELS[level]}
        </span>
      </div>

      <section className="ws-section">
        <div className="ws-stats">
          {(data?.[module.key] ?? []).map((stat) => (
            <StatTile key={stat.key} stat={stat} />
          ))}
        </div>
      </section>

      <section className="ws-section">
        <div className="ws-cards">
          {pages.map((page) => (
            <Link key={page.path} to={page.path} className="ws-card" onMouseEnter={() => prefetch(page.path)} onFocus={() => prefetch(page.path)}>
              <h3>{page.label} →</h3>
              {page.description && <p>{page.description}</p>}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
