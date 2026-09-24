/**
 * Workspace home: a greeting, what needs attention across the modules this
 * person can use, each module's key numbers (one cached request, see
 * useWorkspaceSummary), and shortcuts into every module.
 */
import { Link } from "react-router-dom";
import { useAdminAuth } from "../context/AdminAuthContext";
import { useWorkspaceSummary, type Stat } from "../hooks/useWorkspaceSummary";
import { MODULES, moduleHomePath, prefetch } from "../modules";
import { Icon } from "../components/AdminLayout";
import AttentionPanel from "../components/AttentionPanel";
import "../components/AdminLayout.css";

function greeting(): string {
  const hour = new Date().getHours();
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}

export function StatTile({ stat }: { stat: Stat }) {
  return (
    <Link to={stat.path} className={stat.attention ? "ws-stat ws-stat--attention" : "ws-stat"} onMouseEnter={() => prefetch(stat.path)}>
      <span className="ws-stat__value">{stat.value.toLocaleString()}</span>
      <span className="ws-stat__label">{stat.label}</span>
    </Link>
  );
}

export default function AdminDashboard() {
  const { currentUser, can, isSystemAdmin } = useAdminAuth();
  const { data, error } = useWorkspaceSummary();
  const modules = MODULES.filter((module) => can(module.key));
  const urgent = modules.flatMap((module) => (data?.[module.key] ?? []).filter((stat) => stat.attention && stat.value > 0).map((stat) => ({ ...stat, module: module.label })));

  return (
    <div>
      <div className="ws-hero">
        <div>
          <h1>
            {greeting()}, {currentUser?.name.split(" ")[0]}
          </h1>
          <p>{new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}</p>
        </div>
        <Link className="btn btn-secondary" to="/admin/me">
          My work & leave
        </Link>
      </div>

      {modules.length === 0 && (
        <div className="admin-empty-state">
          You haven't been given access to any department modules yet. Your system administrator decides what each person can use. Meanwhile
          you can request leave and see the team directory from the menu.
        </div>
      )}

      {urgent.length > 0 && (
        <section className="ws-section" aria-labelledby="urgent-heading">
          <div className="ws-section__head">
            <h2 id="urgent-heading">Needs attention</h2>
          </div>
          <div className="ws-stats">
            {urgent.map((stat) => (
              <StatTile key={`${stat.module}-${stat.key}`} stat={{ ...stat, label: `${stat.label} · ${stat.module}` }} />
            ))}
          </div>
        </section>
      )}

      {isSystemAdmin && <AttentionPanel />}
      {error && !data && <p className="text-muted" role="alert">Couldn't load the numbers just now.</p>}

      {modules.map((module) => {
        const stats = data?.[module.key];
        return (
          <section key={module.key} className="ws-section" aria-labelledby={`mod-${module.key}`}>
            <div className="ws-section__head">
              <h2 id={`mod-${module.key}`}>
                <Icon name={module.icon} /> {module.label}
              </h2>
              <Link to={moduleHomePath(module.key)} onMouseEnter={() => prefetch(moduleHomePath(module.key))}>
                Open →
              </Link>
            </div>
            {stats ? (
              <div className="ws-stats">
                {stats.map((stat) => (
                  <StatTile key={stat.key} stat={stat} />
                ))}
              </div>
            ) : (
              <div className="ws-skeleton__grid" aria-busy="true">
                <div className="ws-skeleton__card" />
                <div className="ws-skeleton__card" />
                <div className="ws-skeleton__card" />
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
