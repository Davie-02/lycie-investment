import { useSiteContent } from "@/context/SiteContentContext";
import "./company.css";

/** A row of plain, checkable facts about the company — shown only once the company details are filled in. */
export default function TrustStrip() {
  const { content } = useSiteContent();
  const { established } = content.company;
  const teamSize = content.team.groups.reduce((n, g) => n + g.members.length, 0);
  if (!established) return null;

  const years = new Date().getFullYear() - established;
  const stats = [
    { value: String(established), label: "Established" },
    ...(years > 0 ? [{ value: `${years}`, label: years === 1 ? "Year of service" : "Years of service" }] : []),
    ...(teamSize > 0 ? [{ value: String(teamSize), label: "Team members" }] : []),
    { value: "Registered", label: "Fully registered company" },
  ];

  return (
    <section className="trust-strip" aria-label="About the company at a glance">
      <ul className="container trust-strip__list">
        {stats.map((stat) => (
          <li key={stat.label}>
            <strong className="trust-strip__value">{stat.value}</strong>
            <span className="trust-strip__label">{stat.label}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
