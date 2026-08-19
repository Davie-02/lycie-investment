import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAdminAuth } from "../context/AdminAuthContext";
import FormField from "@/components/forms/FormField";
import FormStatusBanner from "@/components/forms/FormStatusBanner";

const REASON_MESSAGES: Record<string, string> = {
  inactivity: "You were logged out after a period of inactivity. Please log in again.",
  expired: "Your session has expired. Please log in again.",
};

export default function AdminLogin() {
  const { isAuthenticated, isLoggingIn, loginError, login } = useAdminAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const reason = (location.state as { reason?: string } | null)?.reason;
  const reasonMessage = reason ? REASON_MESSAGES[reason] : null;

  if (isAuthenticated) {
    return <Navigate to="/admin" replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const success = await login(email, password);
    if (success) {
      navigate("/admin");
    }
  }

  return (
    <div className="admin-login">
      <form className="form-card admin-login__card" onSubmit={handleSubmit} noValidate>
        <h1 className="admin-login__title">Admin Login</h1>
        <p className="text-muted admin-login__subtitle">Lycie Investment content management</p>

        {reasonMessage && !loginError && (
          <FormStatusBanner status="error" successMessage="" errorMessage={reasonMessage} />
        )}
        {loginError && (
          <FormStatusBanner status="error" successMessage="" errorMessage={loginError} />
        )}

        <div className="form-grid">
          <FormField
            id="email"
            label="Email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
          />
          <FormField
            id="password"
            label="Password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>

        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={isLoggingIn}>
            {isLoggingIn ? "Signing in…" : "Sign In"}
          </button>
        </div>
      </form>
    </div>
  );
}
