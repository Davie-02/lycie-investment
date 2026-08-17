import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import "./ServiceCard.css";

interface ServiceCardProps {
  icon: ReactNode;
  title: string;
  description: string;
  href: string;
}

export default function ServiceCard({ icon, title, description, href }: ServiceCardProps) {
  return (
    <article className="service-card">
      <div className="service-card__icon" aria-hidden="true">
        {icon}
      </div>
      <h3>{title}</h3>
      <p className="text-muted">{description}</p>
      <Link to={href} className="btn-ghost service-card__link">
        Learn more →
      </Link>
    </article>
  );
}
