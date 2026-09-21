/**
 * Top navigation on every public page: logo, page links, 'Get a Quote', and the
 * customer's account link (shows 'Sign in' or 'My account' depending on whether they are
 * signed in). On phones the links collapse into a hamburger menu that closes when a link
 * is chosen.
 */
import { useEffect, useState } from "react";
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
  const [isScrolled, setIsScrolled] = useState(false);
  const { isAuthenticated } = useCustomerAuth();

  useEffect(() => {
    function onScroll() {
      setIsScrolled(window.scrollY > 8);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={isScrolled ? "navbar navbar--scrolled" : "navbar"}>
      <div className="container navbar__row">
        <NavLink to="/" className="navbar__brand" onClick={() => setIsOpen(false)}>
          <img src={logo} alt="Lycie Investments" className="navbar__logo" />
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
          className={isOpen ? "navbar__toggle navbar__toggle--open" : "navbar__toggle"}
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

      <nav
        id="mobile-nav"
        className={isOpen ? "navbar__mobile navbar__mobile--open" : "navbar__mobile"}
        aria-label="Mobile"
        aria-hidden={!isOpen}
      >
        <div className="navbar__mobile-inner">
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
        </div>
      </nav>
    </header>
  );
}
