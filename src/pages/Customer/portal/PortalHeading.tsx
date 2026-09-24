import type { ReactNode } from "react";

/** The title (and optional intro and actions) at the top of each portal section. */
export default function PortalHeading({ title, intro, children }: { title: string; intro?: string; children?: ReactNode }) {
  return (
    <div className="portal-heading">
      <div>
        <h2>{title}</h2>
        {intro && <p className="text-muted">{intro}</p>}
      </div>
      {children}
    </div>
  );
}
