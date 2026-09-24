import { Navigate, Outlet } from "react-router-dom";
import { useAdminAuth } from "../context/AdminAuthContext";

/** The workspace needs a staff sign-in. Most people are staff, so they're sent to the website sign-in (administrators have a link to their portal there). */
export default function ProtectedRoute() {
  const { isAuthenticated } = useAdminAuth();

  if (!isAuthenticated) {
    return <Navigate to="/account/login" replace />;
  }

  return <Outlet />;
}
