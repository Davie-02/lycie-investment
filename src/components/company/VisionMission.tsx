import { useSiteContent } from "@/context/SiteContentContext";
import Reveal from "@/components/common/Reveal";
import { ClockIcon, HandshakeIcon, LeafIcon, ShieldIcon } from "./icons";
import "./company.css";

const VALUE_ICONS = [ShieldIcon, ClockIcon, HandshakeIcon, LeafIcon];

export default function VisionMission() {
  const { content } = useSiteContent();
  const { vision, mission, missionPoints, values } = content.company;
  if (!vision && missionPoints.length === 0 && values.length === 0) return null;

  return (
    <section className="section container">
      <div className="vm-grid">
        {vision && (
          <Reveal>
            <article className="vm-card">
              <span className="eyebrow">Our vision</span>
              <p className="vm-card__lead">{vision}</p>
            </article>
          </Reveal>
        )}
        {missionPoints.length > 0 && (
          <Reveal delayMs={80}>
            <article className="vm-card vm-card--mission">
              <span className="eyebrow">Our mission</span>
              {mission && <p className="vm-card__lead">{mission}</p>}
              <ul className="vm-card__list">
                {missionPoints.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </article>
          </Reveal>
        )}
      </div>

      {values.length > 0 && (
        <ul className="values-grid">
          {values.map((value, index) => {
            const Icon = VALUE_ICONS[index % VALUE_ICONS.length];
            return (
              <li key={value.title}>
                <Reveal delayMs={Math.min(index, 4) * 70}>
                  <div className="value-card">
                    <span className="value-card__icon">
                      <Icon />
                    </span>
                    <h3>{value.title}</h3>
                    <p className="text-muted">{value.detail}</p>
                  </div>
                </Reveal>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
