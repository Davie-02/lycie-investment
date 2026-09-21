/**
 * The team section, from Site Content → Team (Admin): groups of people with role and
 * optional photo. Renders nothing until members are added.
 */
import { useSiteContent } from "@/context/SiteContentContext";
import Reveal from "@/components/common/Reveal";
import Img from "@/components/common/Img";
import "./company.css";

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

export default function TeamSection() {
  const { content } = useSiteContent();
  const { eyebrow, heading, body, groups } = content.team;
  const shown = groups.filter((g) => g.members.length > 0);
  if (shown.length === 0) return null;

  return (
    <section className="section container team">
      <div className="section-heading">
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        {heading && <h2>{heading}</h2>}
        {body && <p>{body}</p>}
      </div>

      {shown.map((group, groupIndex) => (
        <Reveal key={group.title} delayMs={Math.min(groupIndex, 3) * 80}>
          <div className="team__group">
            <h3 className="team__group-title">{group.title}</h3>
            <ul className={group.members.length === 1 ? "team__grid team__grid--single" : "team__grid"}>
              {group.members.map((member) => (
                <li key={member.name} className="team-card">
                  <span className="team-card__avatar" aria-hidden={!member.photoUrl}>
                    {member.photoUrl ? <Img src={member.photoUrl} alt={member.name} sizes="72px" /> : initials(member.name)}
                  </span>
                  <span className="team-card__text">
                    <strong>{member.name}</strong>
                    <span className="text-muted">{member.role}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      ))}
    </section>
  );
}
