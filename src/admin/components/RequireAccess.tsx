import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useAdminAuth } from "../context/AdminAuthContext";
import type { Level, ModuleKey } from "../access";

/** Shows its page only to people with this module access (the server enforces it too); others go back to their dashboard. */
export default function RequireAccess({ module, level = "view", systemAdminOnly, children }: { module?: ModuleKey; level?: Level; systemAdminOnly?: boolean; children: ReactNode }) {
  const { can, isSystemAdmin } = useAdminAuth();
  const allowed = systemAdminOnly ? isSystemAdmin : !module || can(module, level);
  return allowed ? <>{children}</> : <Navigate to="/admin" replace />;
}
