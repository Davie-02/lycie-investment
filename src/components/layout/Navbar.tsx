/**
 * Top navigation on every public page: logo, page links, 'Get a Quote', and the
 * customer's account link (shows 'Sign in' or 'My account' depending on whether they are
 * signed in). On phones the links collapse into a hamburger menu that closes when a link
 * is chosen.
 */
import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import logo from "@/assets/logo.webp";
import ThemeToggle from "./ThemeToggle";
import { useAsyncData } from "@/hooks/useAsyncData";
import { getDeals } from "@/services/deals.service";
import "./Navbar.css";
import { useCustomerAuth } from "@/context/CustomerAuthContext";
import LanguageSwitch from "@/i18n/LanguageSwitch";
import { useT } from "@/i18n/LanguageContext";
import type { StringKey } from "@/i18n/strings";

const BASE_NAV_LINKS: Array<{ to: string; label: StringKey }> = [
  { to: "/", label: "nav.home" },
  { to: "/vehicles", label: "nav.vehicles" },
  { to: "/import", label: "nav.import" },
  { to: "/clearing", label: "nav.clearing" },
  { to: "/hire", label: "nav.hire" },
  { to: "/about", label: "nav.about" },
  { to: "/contact", label: "nav.contact" },
];

export default function Navbar() {
  // A "Deals" link appears only while at least one deal is published (updates live).
  const { data: deals } = useAsyncData(getDeals, [], ["deals"]);
  const NAV_LINKS = deals && deals.length > 0 ? [...BASE_NAV_LINKS.slice(0, 5), { to: "/deals", label: "nav.deals" as StringKey }, ...BASE_NAV_LINKS.slice(5)] : BASE_NAV_LINKS;
  const [isOpen, setIsOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const { isAuthenticated } = useCustomerAuth();
  const t = useT();

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
          <img src={logo} alt="Lycie Investments" className="navbar__logo" width="58" height="48" />
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
              {t(link.label)}
            </NavLink>
          ))}
        </nav>

        <LanguageSwitch className="navbar__lang" />
        <ThemeToggle />
        <NavLink to="/vehicles" className="btn btn-primary navbar__cta">
          {t("nav.quote")}
        </NavLink>
        <NavLink
          to={isAuthenticated ? "/account" : "/account/login"}
          className="navbar__account-link"
        >
          {isAuthenticated ? t("nav.account") : t("nav.signIn")}
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
              {t(link.label)}
            </NavLink>
          ))}
          <LanguageSwitch className="navbar__mobile-lang" />
          <NavLink
            to="/vehicles"
            className="btn btn-primary navbar__mobile-cta"
            onClick={() => setIsOpen(false)}
          >
            {t("nav.quote")}
          </NavLink>
          <NavLink
            to={isAuthenticated ? "/account" : "/account/login"}
            className="btn-ghost navbar__mobile-account"
            onClick={() => setIsOpen(false)}
          >
            {isAuthenticated ? t("nav.account") : t("nav.signIn")}
          </NavLink>
        </div>
      </nav>
    </header>
  );
}
