import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import Seo from "@/components/common/Seo";
import { useCustomerAuth } from "@/context/CustomerAuthContext";
import "./customer.css";

export default function CustomerLogin() {
  const { login, isSubmitting, errorMessage } = useCustomerAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (await login(email, password)) {
      const destination = (location.state as { from?: string } | null)?.from ?? "/account";
      navigate(destination, { replace: true });
    }
  }

  return (
    <>
      <Seo title="Customer Login" description="Sign in to view your Lycie Investment account." />
      <section className="service-hero">
        <div className="container">
          <h1>Customer account</h1>
          <p>Sign in to view your balance and transaction history.</p>
        </div>
      </section>
      <section className="section container customer-auth">
        <form className="form-card customer-auth__form" onSubmit={handleSubmit}>
          <h2>Sign in</h2>
          {errorMessage && (
            <p className="form-error" role="alert">
              {errorMessage}
            </p>
          )}
          <label htmlFor="customer-email">Email</label>
          <input
            id="customer-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <label htmlFor="customer-password">Password</label>
          <input
            id="customer-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={8}
          />
          <button className="btn btn-primary" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Signing in..." : "Sign in"}
          </button>
          <p className="text-muted">
            New customer? <Link to="/account/register">Create an account</Link>
          </p>
        </form>
      </section>
    </>
  );
}