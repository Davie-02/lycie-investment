# Lycie Investment — Website

A corporate website for Lycie Investment, covering vehicle sourcing, importing,
dealership, hire, and clearing services.

The repository contains two applications:

```
lycie-investment/       Frontend (React + TypeScript + Vite)
server/                 Backend API (NestJS + Prisma + PostgreSQL)
strapi/                 CMS for marketing content — testimonials, FAQ, blog
                         posts, SEO settings (optional, see server/README.md
                         "CMS content (Strapi)")
```
Phases 1–5 of the build plan are complete: the full UI, all forms, and a real
backend with a database are in place. Vehicle/hire listings are served from
PostgreSQL, and form submissions are persisted through the API rather than
simulated.

## Features

- Home, About, Vehicles (with filters + search), Vehicle Details, Import,
  Clearing, Hire, and Contact pages
- A landing-page vehicle carousel showcasing featured/available vehicles —
  auto-advancing, pausable on hover/focus, keyboard and touch navigable,
  and respects the visitor's reduced-motion preference
- Vehicle inquiry, import request, clearing request, hire request, and contact
  forms — validated on the client and again on the server, with real
  loading/success/error states throughout, and consistent styling across
  every form on the site (public, customer, and admin)
- Customer registration, login, balance, and transaction history with
  server-side ownership checks
- Payment-proof submissions that remain pending until an authorized staff
  member approves them
- Staff payment review in the admin dashboard, including proof viewing and
  approval or rejection with a review note
- Security: CSRF protection, HTTP security headers (helmet), rate-limited
  login endpoints, and Serializable-transaction-protected money/booking
  operations — see `server/README.md`'s Security section for the full list
- Semantic HTML, keyboard-navigable, labeled forms, visible focus states
- Per-page SEO (title, meta description), with sitewide defaults and social
  metadata sourced from the CMS when it's configured
- Testimonials, FAQ, and a blog, sourced from a separate Strapi CMS so
  non-technical staff can publish marketing content without a deploy — see
  server/README.md's "CMS content (Strapi)" section
- Branding pulled from the actual Lycie Investment logo (navy `#19406C` /
  sky blue `#76CAE9`) — see "Design system" below

## Tech stack

**Frontend:** React 18, TypeScript, Vite, React Router
**Backend:** NestJS, Prisma, PostgreSQL — see `server/README.md`
**CMS (optional):** Strapi — marketing content only, see `server/README.md`'s "CMS content (Strapi)"

## Not yet built

- Payment-provider integration. The internal customer ledger does not move
  money through a bank or payment provider — payments are submitted as
  proof (an image) and approved manually by staff.
- Broader automated test coverage. What exists today: backend unit tests
  (`server/`, run with `npm test`) for the auth guards and hire-pricing
  math, and a Playwright E2E harness (root, run with `npm run test:e2e`)
  covering customer register/login/session-persistence/logout and admin
  login/vehicle-CRUD/logout, each against an isolated `lycie_investment_test`
  database that's wiped and reseeded on every run — see "Testing" below.
  Coverage is intentionally narrow (the auth boundary and money/booking math
  first, since those are the highest-consequence areas) rather than
  exhaustive; most endpoints still have no automated test.

Browser authentication uses HTTP-only session cookies. JWTs are not stored in
local storage or exposed to frontend JavaScript. Sessions expire based on
`JWT_EXPIRES_IN` (2 hours by default). The admin dashboard additionally
auto-logs-out after 5 minutes of inactivity (`src/admin/components/AdminLayout.tsx`);
the customer account area does the same after 30 minutes
(`src/context/CustomerAuthContext.tsx`) — these are separate, shorter,
client-side timeouts on top of the server-side session expiry, since a
still-valid token doesn't help if someone's walked away from an unlocked
screen.

## Requirements

- Node.js 18 or later
- npm
- PostgreSQL (only needed to run the backend — see `server/README.md` for
  setup, including a one-line Docker option)

## Running the whole site locally

You need both the API and the frontend running.

**1. Start the backend** (see `server/README.md` for full detail):

```bash
cd server
npm install
cp .env.example .env    # then point DATABASE_URL at your Postgres instance
npx prisma migrate deploy
npm run prisma:seed
npm run start:dev
```

This serves the API at `http://localhost:3001/api`.

**2. Start the frontend**, from the repo root:

```bash
npm install
cp .env.example .env    # defaults already point at the local API
npm run dev
```

This serves the site at `http://localhost:5173`.

If the backend isn't running, every page that loads data (Vehicles, Hire, the
homepage's featured vehicles) will show its real "unable to load" error state
rather than silently falling back to fake data — that's intentional, not a
bug.

## Build

```bash
npm run build
```

Type-checks the project and produces a production build in `dist/`.

## Performance

The frontend uses route-level lazy loading, so public, customer, and admin page
code is downloaded only when needed. Vehicle and hire-vehicle APIs return
bounded pages rather than unlimited result sets. Public read-only API responses
have short-lived cache headers, other API responses are not cached, and the
API compresses responses when supported by the client.

New uploaded images are resized and converted to WebP on the server. Existing
large uploads should be replaced through the admin dashboard when practical.
The current deployment uses one free-tier API instance; horizontal load
balancing and autoscaling require hosting support beyond the free tier.

## Preview a production build

```bash
npm run preview
```

## Testing

Backend unit tests (Jest — auth guards, hire-pricing math):

```bash
cd server
npm test
```

End-to-end tests (Playwright — customer and admin auth flows) run against a
**separate, dedicated database**, never your local dev database. One-time
setup:

```bash
createdb lycie_investment_test   # same Postgres user as your dev DB
npx playwright install chromium  # downloads a browser Playwright drives
```

Then from the repo root:

```bash
npm run test:e2e
```

This boots the frontend and backend itself (`playwright.config.ts`'s
`webServer` entries) against `lycie_investment_test`, running
`prisma migrate reset --force` first to wipe and reseed it fresh — so runs
are reproducible and never touch or depend on your own local data. The seeded
test admin account's credentials live in `tests/constants.ts` (not a real
secret — this account only ever exists in a throwaway test database).

Coverage today is intentionally narrow: the customer register → login →
refresh → logout → protected-route-denied flow, and the admin
login → create/edit/delete a vehicle → logout → protected-route-denied flow.
Most endpoints and admin screens still have no automated test — see
"Not yet built" above.

## Lint

```bash
npm run lint
```

## Environment variables

`VITE_API_BASE_URL` — base URL of the backend API. Defaults to
`http://localhost:3001/api` if unset. See `.env.example`.

The frontend has no separate CMS configuration — it always talks to the
NestJS API, which proxies Strapi server-side when configured. See
`server/.env.example` for `STRAPI_URL`/`STRAPI_API_TOKEN`.

## Project structure

```
src/
├── admin/                Admin dashboard — auth, layout, vehicle/hire-vehicle
│                          CRUD forms, submitted-requests viewer (separate
│                          from the public site's design system)
├── assets/            Static assets, including the Lycie Investment logo
├── components/
│   ├── common/         Shared building blocks (Hero, Seo, CtaBand, etc.)
│   ├── layout/          Navbar, Footer, page Layout
│   ├── vehicles/         Vehicle cards, gallery, specs, filters
│   ├── services/          Service cards/section
│   └── forms/             All request/inquiry forms + shared form fields
├── config/               siteConfig.ts — fallback defaults only; live
│                          content is edited via /admin and stored in the DB
├── context/               SiteContentContext — fetches live editable content
├── pages/               One folder per public route
├── hooks/                useAsyncData, useFormSubmission
├── services/              API client (http.ts) and per-resource service
│                           functions (vehicles.service.ts, inquiries.service.ts,
│                           cms.service.ts for testimonials/FAQ/blog/SEO)
├── types/                 Domain types (Vehicle, HireVehicle, request types)
├── utils/                  Formatting and filter helpers
├── styles/                 Design tokens, reset, global styles
├── routes/                 Route definitions (public + /admin/*)
├── App.tsx
└── main.tsx
```

## Design system

Color, type, spacing, and radius values are defined as CSS variables in
`src/styles/variables.css`. The palette is sourced from the actual Lycie
Investment logo:

- `--color-primary` (`#19406C`) and `--color-primary-dark` — the logo's navy,
  used for primary buttons, headings, and the footer background
- `--color-accent` (`#76CAE9`) — the logo's sky blue, used for decorative
  fills and text/icons on the dark navy background, where it has enough
  contrast
- `--color-accent-dark` (`#2E7A9C`) — a darker blue derived from the brand
  color, used anywhere the raw sky blue would fail WCAG contrast on a light
  background (buttons, links, icons, focus rings)

The logo image itself is at `src/assets/logo.png` and is used in the Navbar
and as the favicon. It has an opaque white background rather than
transparency, so the Footer (which has a dark background) uses a styled text
wordmark instead of the image — swap this for the logo if you get a
transparent-background version.

## Sample data

Vehicle and hire-vehicle listings, plus default site content (contact info,
About copy, social links), come from the database via `server/prisma/seed.ts`
— not from local frontend files. To change what's displayed, either edit it
live via `/admin`, or edit the seed script and re-run `npm run prisma:seed`
(safe to re-run — it only fills in missing content, never overwrites edits
already made through the dashboard). No frontend code needs to change
either way, since components read through `src/services/vehicles.service.ts`
and `src/context/SiteContentContext.tsx`.

## Admin dashboard

Visit `/admin` (e.g. `http://localhost:5173/admin`) to manage vehicle and
hire-vehicle listings, edit site content (contact info, social links, About
page copy — no redeploy needed), manage site-wide notices (color-coded
banners and popups for announcements or special offers), manage other admin
accounts (Owner/Manager/Viewer roles), and view submitted form requests, all
without touching the database directly. See `server/README.md` for how to
bootstrap your first login — nothing works until `ADMIN_EMAIL`,
`ADMIN_PASSWORD_HASH`, and `JWT_SECRET` are set in `server/.env` and
`npm run prisma:seed` has been run.

Admin sessions expire after 2 hours, and auto-logout after 5 minutes of
inactivity — both configurable in `server/.env` (`JWT_EXPIRES_IN`) and
`src/admin/components/AdminLayout.tsx` (`IDLE_TIMEOUT_MS`) respectively.

## Deployment

See `DEPLOYMENT.md` for step-by-step instructions to get this off localhost
(frontend + API + Postgres + image storage on real hosting).

## Verification

The frontend and backend build successfully, the Prisma schema validates, and
the committed migrations are applied with `prisma migrate deploy`. Browser
tests are not currently part of the repository; use the build and API checks
above as the baseline verification commands.
