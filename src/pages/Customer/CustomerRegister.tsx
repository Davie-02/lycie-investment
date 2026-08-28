import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import Seo from "@/components/common/Seo";
import { useCustomerAuth } from "@/context/CustomerAuthContext";
import "./customer.css";

export default function CustomerRegister() {
  const { register, isSubmitting, errorMessage } = useCustomerAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (await register(name, email, password)) navigate("/account", { replace: true });
  }

  return (
    <>
      <Seo title="Create Customer Account" description="Create a Lycie Investment customer account." />
      <section className="service-hero">
        <div className="container">
          <h1>Open an account</h1>
          <p>Create a secure customer account to keep track of your transactions.</p>
        </div>
      </section>
      <section className="section container customer-auth">
        <form className="form-card customer-auth__form" onSubmit={handleSubmit}>
          <h2>Create account</h2>
          {errorMessage && (
            <p className="form-error" role="alert">
              {errorMessage}
            </p>
          )}
          <label htmlFor="customer-name">Full name</label>
          <input
            id="customer-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
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
            {isSubmitting ? "Creating account..." : "Create account"}
          </button>
          <p className="text-muted">
            Already registered? <Link to="/account/login">Sign in</Link>
          </p>
        </form>
      </section>
    </>
  );
}