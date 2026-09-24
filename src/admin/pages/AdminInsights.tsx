/**
 * Admin → Insights. What customers are saying and doing, built from reviews, contact
 * messages, inquiries, saved vehicles and vehicle page views: key figures (reviews,
 * feedback analysed, views in the last 30 days), customer sentiment charts, and
 * recommendations that come from clear rules (e.g. many views but no inquiries). Reads
 * GET /api/insights/overview.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { useAsyncData } from "@/hooks/useAsyncData";
import { adminApi } from "../adminApi";
import SentimentBar from "../components/SentimentBar";
import type { InsightRecommendation, InsightsOverview } from "@/types/insights";
import "../components/AdminLayout.css";
import "../components/AdminInsights.css";

const SEVERITY_LABEL: Record<InsightRecommendation["severity"], string> = {
  action: "⚠ Action needed",
  opportunity: "↗ Opportunity",
  info: "ℹ For your information",
};

function Kpi({ label, value, note }: { label: string; value: string | number; note?: string }) {
  return (
    <div className="insights-kpi">
      <div className="insights-kpi__label">{label}</div>
      <div className="insights-kpi__value">{value}</div>
      {note && <div className="insights-kpi__note">{note}</div>}
    </div>
  );
}

function weekLabel(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, { day: "numeric", month: "short", timeZone: "UTC" });
}

export default function AdminInsights() {
  const [refreshKey, setRefreshKey] = useState(0);
  const { data, isLoading, error } = useAsyncData(
    () => adminApi.get<InsightsOverview>("/insights/overview"),
    [refreshKey]
  );

  if (isLoading && !data) return <p className="text-muted">Working out the numbers…</p>;
  if (error || !data) return <p className="text-muted" role="alert">Unable to load insights.</p>;

  const { totals, sentiment, ratingDistribution, weeklyTrend, themes, vehicles, hireVehicles, recommendations } = data;
  const maxRating = Math.max(1, ...ratingDistribution);
  const maxWeek = Math.max(1, ...weeklyTrend.map((w) => w.count));
  const ratedCount = ratingDistribution.reduce((a, b) => a + b, 0);

  return (
    <div className="insights">
      <div className="admin-toolbar">
        <h1>Insights</h1>
        <button type="button" className="btn btn-secondary" onClick={() => setRefreshKey((k) => k + 1)}>
          Refresh
        </button>
      </div>
      <p className="admin-page-intro">
        What customers are saying and doing, and what to do about it. Built from reviews, contact
        messages, inquiries, saved vehicles, and vehicle page views.
      </p>
      <p className="insights-updated text-muted mono">
        Updated {new Date(data.generatedAt).toLocaleTimeString()}
      </p>

      <div className="insights-kpis">
        <Kpi
          label="Average rating"
          value={totals.averageRating === null ? "—" : `${totals.averageRating.toFixed(1)} / 5`}
          note={`${ratedCount} approved review${ratedCount === 1 ? "" : "s"}`}
        />
        <Kpi
          label="Reviews"
          value={totals.reviews}
          note={totals.pendingReviews > 0 ? `${totals.pendingReviews} awaiting moderation` : "All moderated"}
        />
        <Kpi label="Feedback analysed" value={totals.feedbackCount} note="Reviews, messages, inquiries" />
        <Kpi label="Vehicle views" value={totals.views30d} note="Last 30 days" />
        <Kpi label="Saved vehicles" value={totals.saves} note="Across all customers" />
        <Kpi label="Vehicle inquiries" value={totals.inquiries90d} note="Last 90 days" />
      </div>

      <section className="insights-section" aria-labelledby="recs-heading">
        <h2 id="recs-heading">Recommendations</h2>
        <div className="insights-recs">
          {recommendations.map((rec, index) => (
            <article className={`insights-rec insights-rec--${rec.severity}`} key={`${rec.title}-${index}`}>
              <div className="insights-rec__tag">{SEVERITY_LABEL[rec.severity]}</div>
              <h3>{rec.title}</h3>
              <p className="text-muted">{rec.detail}</p>
              {rec.title.includes("waiting for moderation") && (
                <Link to="/admin/reviews">Go to Reviews →</Link>
              )}
            </article>
          ))}
        </div>
        <p className="insights-table-note">
          Recommendations come from clear rules (for example, "many views and saves but no
          inquiries"), not a black box — each one names the numbers behind it. They're a starting
          point for your judgement, not a verdict.
        </p>
      </section>

      <section className="insights-section" aria-labelledby="charts-heading">
        <h2 id="charts-heading">Customer sentiment</h2>
        <div className="insights-charts">
          <div className="insights-card">
            <h3>How customers feel</h3>
            <p className="insights-card__sub">Overall, and by where the feedback came from</p>
            <div className="sbar-rows">
              <div>
                <div className="sbar-rows__label">Everything</div>
                <SentimentBar counts={sentiment.overall} />
              </div>
              <div>
                <div className="sbar-rows__label">Reviews</div>
                <SentimentBar counts={sentiment.reviews} thin showLegend={false} />
              </div>
              <div>
                <div className="sbar-rows__label">Messages &amp; inquiries</div>
                <SentimentBar counts={sentiment.messages} thin showLegend={false} />
              </div>
            </div>
          </div>

          <div className="insights-card">
            <h3>Star ratings</h3>
            <p className="insights-card__sub">Approved reviews only</p>
            {ratedCount === 0 ? (
              <p className="insights-empty">No approved reviews yet.</p>
            ) : (
              <div className="hbars">
                {[5, 4, 3, 2, 1].map((star) => {
                  const count = ratingDistribution[star - 1];
                  return (
                    <div className="hbars__row" key={star} title={`${count} × ${star}-star`}>
                      <span>{star} ★</span>
                      <div className="hbars__track">
                        <div className="hbars__fill" style={{ width: `${(count / maxRating) * 100}%` }} />
                      </div>
                      <b className="mono">{count}</b>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="insights-card">
            <h3>Feedback volume</h3>
            <p className="insights-card__sub">Comments received per week</p>
            {totals.feedbackCount === 0 ? (
              <p className="insights-empty">No feedback yet.</p>
            ) : (
              <>
                <div className="vbars" role="img" aria-label={`Feedback per week: ${weeklyTrend.map((w) => `${weekLabel(w.weekStart)} ${w.count}`).join(", ")}`}>
                  {weeklyTrend.map((week) => (
                    <div
                      className="vbars__col"
                      key={week.weekStart}
                      title={`Week of ${weekLabel(week.weekStart)}: ${week.count} comment${week.count === 1 ? "" : "s"}${
                        week.averageScore === null ? "" : `, average sentiment ${week.averageScore.toFixed(2)}`
                      }`}
                    >
                      <b className="mono">{week.count > 0 ? week.count : ""}</b>
                      <div className="vbars__bar" style={{ height: `${(week.count / maxWeek) * 100}%` }} />
                    </div>
                  ))}
                </div>
                <div className="vbars__axis">
                  {weeklyTrend.map((week) => (
                    <span key={week.weekStart}>{weekLabel(week.weekStart)}</span>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="insights-section" aria-labelledby="themes-heading">
        <h2 id="themes-heading">What people keep mentioning</h2>
        {themes.length === 0 ? (
          <p className="insights-empty">Common topics appear here once customers leave comments.</p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Topic</th>
                  <th className="num">Mentions</th>
                  <th>Tone when mentioned</th>
                </tr>
              </thead>
              <tbody>
                {themes.map((theme) => (
                  <tr key={theme.word}>
                    <td><strong>{theme.word}</strong></td>
                    <td className="num mono">{theme.total}</td>
                    <td style={{ minWidth: 220 }}>
                      <SentimentBar counts={theme} thin compact />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="insights-section" aria-labelledby="demand-heading">
        <h2 id="demand-heading">Vehicle demand</h2>
        {vehicles.length === 0 ? (
          <p className="insights-empty">No vehicles yet.</p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Vehicle</th>
                  <th>Status</th>
                  <th className="num">Views (30d)</th>
                  <th className="num">Saves</th>
                  <th className="num">Inquiries (90d)</th>
                  <th className="num">Rating</th>
                </tr>
              </thead>
              <tbody>
                {vehicles.map((vehicle) => (
                  <tr key={vehicle.id}>
                    <td><strong>{vehicle.label}</strong></td>
                    <td>{vehicle.status}</td>
                    <td className="num mono">{vehicle.views30d}</td>
                    <td className="num mono">{vehicle.saves}</td>
                    <td className="num mono">{vehicle.inquiries90d}</td>
                    <td className="num mono">
                      {vehicle.avgRating === null ? "—" : `${vehicle.avgRating.toFixed(1)} (${vehicle.reviewCount})`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="insights-table-note">Sorted by how wanted each vehicle is — an inquiry counts for far more than a view.</p>
      </section>

      <WaitingForSection />

      <section className="insights-section" aria-labelledby="hire-heading">
        <h2 id="hire-heading">Hire demand</h2>
        {hireVehicles.length === 0 ? (
          <p className="insights-empty">No hire vehicles yet.</p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Vehicle</th>
                  <th>Availability</th>
                  <th className="num">Requests (90d)</th>
                  <th className="num">Confirmed</th>
                </tr>
              </thead>
              <tbody>
                {hireVehicles.map((hire) => (
                  <tr key={hire.id}>
                    <td><strong>{hire.name}</strong></td>
                    <td>{hire.available ? "Available" : "Unavailable"}</td>
                    <td className="num mono">{hire.requests90d}</td>
                    <td className="num mono">{hire.confirmed90d}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}


interface AlertDemand {
  totalActive: number;
  wanted: Array<{ label: string; count: number; typicalBudget: number | null }>;
}

/**
 * What customers have asked to be emailed about (their vehicle alerts) — stock
 * people are waiting for but you don't have yet. A direct guide to what to import next.
 */
function WaitingForSection() {
  const { data } = useAsyncData(() => adminApi.get<AlertDemand>("/alerts/demand"), []);
  return (
    <section className="insights-section" aria-labelledby="waiting-heading">
      <h2 id="waiting-heading">What customers are waiting for</h2>
      {!data || data.wanted.length === 0 ? (
        <p className="insights-empty">No vehicle alerts yet. Customers create them from their account page ("email me when it arrives").</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Wanted</th>
                <th className="num">Customers waiting</th>
                <th className="num">Typical budget</th>
              </tr>
            </thead>
            <tbody>
              {data.wanted.map((item) => (
                <tr key={item.label}>
                  <td><strong>{item.label}</strong></td>
                  <td className="num mono">{item.count}</td>
                  <td className="num mono">{item.typicalBudget ? `USD ${item.typicalBudget.toLocaleString("en-US")}` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && data.totalActive > 0 && (
        <p className="insights-table-note">
          {data.totalActive} active alert{data.totalActive === 1 ? "" : "s"}. Everyone waiting is emailed automatically when a match is listed.
        </p>
      )}
    </section>
  );
}
