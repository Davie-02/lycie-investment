import { Link } from "react-router-dom";
import "../components/AdminLayout.css";
import { useAdminAuth } from "../context/AdminAuthContext";

const BASE_CARDS = [
  {
    to: "/admin/vehicles",
    title: "Vehicles",
    description: "Add, edit, or remove vehicles for sale.",
  },
  {
    to: "/admin/hire-vehicles",
    title: "Hire Vehicles",
    description: "Manage the hire fleet and daily/weekly rates.",
  },
  {
    to: "/admin/requests",
    title: "Submitted Requests",
    description: "View inquiries, import, clearing, hire, and contact submissions.",
  },
  {
    to: "/admin/bookings",
    title: "Bookings",
    description: "See confirmed hire bookings with live countdowns to pickup/return.",
  },
];

const SITE_CONTENT_CARD = {
  to: "/admin/site-content",
  title: "Site Content",
  description: "Edit contact info, social links, and About page copy — no redeploy needed.",
};

const NOTICES_CARD = {
  to: "/admin/notices",
  title: "Notices",
  description: "Manage site-wide banners, warnings, and special-offer popups.",
};

const OWNER_CARD = {
  to: "/admin/users",
  title: "Admin Users",
  description: "Add, edit, or remove admin accounts and their roles.",
};

export default function AdminDashboard() {
  const { currentUser } = useAdminAuth();
  const canEditContent = currentUser?.role === "OWNER" || currentUser?.role === "MANAGER";

  const cards = [
    ...BASE_CARDS,
    ...(canEditContent ? [SITE_CONTENT_CARD, NOTICES_CARD] : []),
    ...(currentUser?.role === "OWNER" ? [OWNER_CARD] : []),
  ];

  return (
    <div>
      <h1>Dashboard</h1>
      <p className="admin-page-intro">Manage what's shown on the public site from here.</p>

      <div className="admin-dashboard-grid">
        {cards.map((card) => (
          <Link to={card.to} className="admin-dashboard-card" key={card.to}>
            <h2>{card.title}</h2>
            <p className="text-muted">{card.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
