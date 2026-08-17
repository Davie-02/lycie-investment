import { Link } from "react-router-dom";

interface CtaBandProps {
  heading: string;
  body: string;
  primary: { label: string; to: string };
  secondary?: { label: string; to: string };
}

export default function CtaBand({ heading, body, primary, secondary }: CtaBandProps) {
  return (
    <section className="cta-band">
      <div className="container">
        <h2>{heading}</h2>
        <p>{body}</p>
        <div className="cta-band__actions">
          <Link to={primary.to} className="btn btn-primary">
            {primary.label}
          </Link>
          {secondary && (
            <Link to={secondary.to} className="btn btn-secondary">
              {secondary.label}
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
