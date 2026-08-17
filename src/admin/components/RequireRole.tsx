import { Navigate, Outlet } from "react-router-dom";
import { useAdminAuth } from "../context/AdminAuthContext";

interface RequireRoleProps {
  roles: Array<"OWNER" | "MANAGER" | "VIEWER">;
}

export default function RequireRole({ roles }: RequireRoleProps) {
  const { currentUser } = useAdminAuth();

  if (!currentUser || !roles.includes(currentUser.role)) {
    return <Navigate to="/admin" replace />;
  }

  return <Outlet />;
}
