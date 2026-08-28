import { useState } from "react";
import { NavLink } from "react-router-dom";
import logo from "@/assets/logo.png";
import "./Navbar.css";
import { useCustomerAuth } from "@/context/CustomerAuthContext";

const NAV_LINKS = [
  { to: "/", label: "Home" },
  { to: "/vehicles", label: "Vehicles" },
  { to: "/import", label: "Import" },
  { to: "/clearing", label: "Clearing" },
  { to: "/hire", label: "Hire" },
  { to: "/about", label: "About" },
  { to: "/contact", label: "Contact" },
];

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const { isAuthenticated } = useCustomerAuth();

  return (
    <header className="navbar">
      <div className="container navbar__row">
        <NavLink to="/" className="navbar__brand" onClick={() => setIsOpen(false)}>
          <img src={logo} alt="Lycie Investment" className="navbar__logo" />
        </NavLink>

        <nav className="navbar__links navbar__links--desktop" aria-label="Primary">
          {NAV_LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === "/"}
              className={({ isActive }) =>
                isActive ? "navbar__link navbar__link--active" : "navbar__link"
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        <NavLink to="/vehicles" className="btn btn-primary navbar__cta">
          Get a Quote
        </NavLink>
        <NavLink
          to={isAuthenticated ? "/account" : "/account/login"}
          className="navbar__account-link"
        >
          {isAuthenticated ? "My account" : "Sign in"}
        </NavLink>

        <button
          className="navbar__toggle"
          aria-expanded={isOpen}
          aria-controls="mobile-nav"
          aria-label={isOpen ? "Close menu" : "Open menu"}
          onClick={() => setIsOpen((open) => !open)}
        >
          <span />
          <span />
          <span />
        </button>
      </div>

      {isOpen && (
        <nav id="mobile-nav" className="navbar__mobile" aria-label="Mobile">
          {NAV_LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === "/"}
              className="navbar__mobile-link"
              onClick={() => setIsOpen(false)}
            >
              {link.label}
            </NavLink>
          ))}
          <NavLink
            to="/vehicles"
            className="btn btn-primary navbar__mobile-cta"
            onClick={() => setIsOpen(false)}
          >
            Get a Quote
          </NavLink>
          <NavLink
            to={isAuthenticated ? "/account" : "/account/login"}
            className="btn-ghost navbar__mobile-account"
            onClick={() => setIsOpen(false)}
          >
            {isAuthenticated ? "My account" : "Sign in"}
          </NavLink>
        </nav>
      )}
    </header>
  );
}
