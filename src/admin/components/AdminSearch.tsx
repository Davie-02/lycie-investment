/**
 * Global search in the admin header (also opens with Ctrl/Cmd + K). Sends what is typed
 * to GET /api/admin-tools/search and lists matching vehicles, requests, customers and
 * content, each linking to its admin page.
 */
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { adminApi } from "../adminApi";
import "./AdminSearch.css";

interface Hit {
  group: string;
  label: string;
  detail?: string;
  path: string;
}

/** Find a vehicle, customer request, booking, post or FAQ from anywhere. Press Ctrl/⌘ + K to jump to it. */
export default function AdminSearch() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const ticket = useRef(0);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        input.current?.focus();
      }
    };
    const onClick = (event: MouseEvent) => {
      if (box.current && !box.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, []);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setHits([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const mine = ++ticket.current;
    const timer = setTimeout(() => {
      adminApi
        .get<Hit[]>(`/admin-tools/search?q=${encodeURIComponent(term)}`)
        .then((data) => {
          if (mine !== ticket.current) return;
          setHits(data);
          setActive(0);
        })
        .catch(() => mine === ticket.current && setHits([]))
        .finally(() => mine === ticket.current && setLoading(false));
    }, 200);
    return () => clearTimeout(timer);
  }, [query]);

  function go(hit: Hit) {
    setOpen(false);
    setQuery("");
    navigate(hit.path);
  }

  let lastGroup = "";
  return (
    <div className="admin-search" ref={box}>
      <input
        ref={input}
        type="search"
        role="combobox"
        aria-expanded={open && query.trim().length >= 2}
        aria-controls="admin-search-results"
        aria-label="Search the admin"
        placeholder="Search…  (Ctrl/⌘ K)"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
          else if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => Math.min(hits.length - 1, i + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(0, i - 1));
          } else if (e.key === "Enter" && hits[active]) go(hits[active]);
        }}
      />
      {open && query.trim().length >= 2 && (
        <ul className="admin-search__results" id="admin-search-results" role="listbox">
          {loading && hits.length === 0 && <li className="admin-search__note">Searching…</li>}
          {!loading && hits.length === 0 && <li className="admin-search__note">No matches.</li>}
          {hits.map((hit, index) => {
            const heading = hit.group !== lastGroup ? hit.group : null;
            lastGroup = hit.group;
            return (
              <li key={`${hit.path}-${index}`} role="presentation">
                {heading && <div className="admin-search__group">{heading}</div>}
                <button
                  type="button"
                  role="option"
                  aria-selected={index === active}
                  className={index === active ? "admin-search__hit admin-search__hit--active" : "admin-search__hit"}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => go(hit)}
                >
                  <span>{hit.label}</span>
                  {hit.detail && <small>{hit.detail}</small>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
