# Lycie Investment — Website

A corporate website for Lycie Investment, covering vehicle sourcing, importing,
dealership, hire, and clearing services.

This repo has two parts:

```
lycie-investment/       Frontend (React + TypeScript + Vite) — this folder
server/                 Backend API (NestJS + Prisma + PostgreSQL)
```

## Project status

Phases 1–5 of the build plan are complete: the full UI, all forms, and a real
backend with a database are in place. Vehicle/hire listings are served from
PostgreSQL, and form submissions are persisted through the API rather than
simulated.

## Features

- Home, About, Vehicles (with filters + search), Vehicle Details, Import,
  Clearing, Hire, and Contact pages
- Vehicle inquiry, import request, clearing request, hire request, and contact
  forms — validated on the client and again on the server, with real
  loading/success/error states throughout
- Responsive, mobile-first layout
- Semantic HTML, keyboard-navigable, labeled forms, visible focus states
- Per-page SEO (title, meta description)
- Branding pulled from the actual Lycie Investment logo (navy `#19406C` /
  sky blue `#76CAE9`) — see "Design system" below

## Tech stack

**Frontend:** React 18, TypeScript, Vite, React Router
**Backend:** NestJS, Prisma, PostgreSQL — see `server/README.md`

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
npx prisma migrate dev --name init
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

## Preview a production build

```bash
npm run preview
```

## Lint

```bash
npm run lint
```

## Environment variables

`VITE_API_BASE_URL` — base URL of the backend API. Defaults to
`http://localhost:3001/api` if unset. See `.env.example`.

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
│                           functions (vehicles.service.ts, inquiries.service.ts)
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

## Not yet built

- Payments, CMS
- Multiple admin accounts / roles — there's one admin login, configured via
  environment variables

## Note on this build

This project was built in an environment without internet or database
access, so the backend in particular has not been run, migrated, or seeded
here, and the frontend hasn't been re-verified against a live API. The
previous frontend-only pass was confirmed working locally by the project
owner; please treat connecting the two as the next real verification step
and report back anything that doesn't work as expected.
