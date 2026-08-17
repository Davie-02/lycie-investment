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
];

const OWNER_CARD = {
  to: "/admin/users",
  title: "Admin Users",
  description: "Add, edit, or remove admin accounts and their roles.",
};

export default function AdminDashboard() {
  const { currentUser } = useAdminAuth();
  const cards = currentUser?.role === "OWNER" ? [...BASE_CARDS, OWNER_CARD] : BASE_CARDS;

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
