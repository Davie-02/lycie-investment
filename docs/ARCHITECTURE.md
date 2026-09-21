# Site structure

How the Lycie Investments site is put together, where everything lives, and how
the pieces talk to each other. Read this first; the other guides go deeper:

- [FEATURES.md](FEATURES.md) — every feature: how it works, what it is wired to, how to fix it
- [AUTH-AND-SECURITY.md](AUTH-AND-SECURITY.md) — sign-in, sessions, cookies, 2FA, Google/Facebook
- [../DEPLOYMENT.md](../DEPLOYMENT.md) — putting it online (Neon, Render, Vercel)
- [../server/README.md](../server/README.md) — the API in detail (endpoints, data model)

## The big picture

```
 Visitor's browser                                   Your services
┌────────────────────────┐   HTTPS + JSON    ┌───────────────────────┐    ┌──────────────┐
│  React website (Vite)  │ ────────────────▶ │  NestJS API (server/) │ ─▶ │  Postgres    │
│  src/                  │ ◀──────────────── │  Render               │    │  (Neon)      │
│  Vercel                │   live updates    │                       │ ─▶ │  Image store │
└────────────────────────┘   (SSE stream)    └───────────────────────┘    │  (S3/B2/R2)  │
                                                  │      │                └──────────────┘
                                                  │      └─▶ Email (Resend / Brevo)
                                                  └─▶ Google Gemini (the "Lycie" assistant)
```

Two separate programs live in this one repository:

| Part | Folder | What it is | Runs on |
| --- | --- | --- | --- |
| **Website + admin CMS** | `src/` (built by Vite) | One React single-page app. The public site AND the admin dashboard (`/admin`) are the same app | Vercel |
| **API** | `server/` | NestJS + Prisma. All data, sign-in, uploads, email, AI | Render |

They are deliberately independent: the website only knows the API's address
(`VITE_API_BASE_URL`), and the API only knows the website's address
(`FRONTEND_URL`, used for CORS and for links in emails).

## Repository layout

```
lycie-investment/
├── src/                     ← the website (React + TypeScript)
│   ├── main.tsx             entry point: mounts <App/> inside the providers
│   ├── App.tsx              wraps the app in the context providers + router
│   ├── routes/AppRoutes.tsx EVERY page URL is declared here (public + /admin/*)
│   ├── pages/               one folder per public page (Home, Vehicles, Contact, Customer…)
│   ├── components/          reusable pieces, grouped by area (see below)
│   ├── admin/               the admin dashboard (its own pages, layout, API client, auth)
│   ├── context/             app-wide state (customer login, site content, likes, notices…)
│   ├── services/            functions that call the API (one file per area)
│   ├── hooks/               small reusable React hooks
│   ├── utils/               pure helper functions (+ their tests)
│   ├── config/siteConfig.ts default site text used until the API answers
│   ├── types/               TypeScript shapes of API data
│   └── styles/              global CSS: variables (colours, spacing), reset, globals
├── server/                  ← the API (NestJS + Prisma)
│   ├── src/main.ts          startup: CORS, security headers, CSRF check, caching rules
│   ├── src/app.module.ts    lists every feature module
│   ├── src/<feature>/       one folder per feature (controller = URLs, service = logic, dto = allowed input)
│   ├── src/security/        password policy, email checks, lockout, two-factor codes
│   └── prisma/              database: schema.prisma, migrations/, seed.ts
├── docs/                    ← these guides
├── DEPLOYMENT.md            how to put everything online
├── vercel.json              website hosting rules (page fallback, security headers)
└── render.yaml              API hosting recipe (all environment variables listed)
```

### `src/components/` by area

| Folder | Contains |
| --- | --- |
| `layout/` | `Layout` (page frame), `Navbar`, `Footer` |
| `common/` | Hero, the homepage `VehicleCarousel`, **`ImageSlider`** (swipeable photos), `Img` (responsive images), `Seo`, `Reveal` (scroll animation), notices, FAQ/testimonial sections |
| `vehicles/` | `VehicleCard`, `HireVehicleCard`, `VehicleGallery`, filters, save button |
| `forms/` | `FormField` (all inputs, incl. password show/hide), `NewPasswordField`, `EmailField`, `RememberMe`, `SocialSignIn`, the request/inquiry/contact forms |
| `company/` | Team, clients, fleet, trust strip, contact cards, **`MapEmbed`** |
| `reviews/`, `faq/`, `lycie/`, `customer/`, `services/` | Their namesake features |

## How a page gets its content

There are two kinds of content, and knowing which is which tells you where to fix things:

1. **Site text** (headings, contact details, about story, footer…) — stored in the
   database table `SiteContent` as one JSON row per *section* (`hero`, `contact`,
   `footer`, `pageHeadings`…). Edited in **Admin → Site Content**. The website
   loads all sections in one request (`GET /api/site-content`) in
   `src/context/SiteContentContext.tsx` and merges them over the defaults in
   `src/config/siteConfig.ts`, so a missing section never leaves a blank.
   Components read it with `const { content } = useSiteContent()`.
2. **Records** (vehicles, hire vehicles, blog posts, FAQ, testimonials, notices,
   reviews) — their own database tables, each with an admin page
   (`src/admin/pages/Admin*.tsx`) and a public endpoint.

**Adding a new editable text:** add the field to the type in `src/types/siteContent.ts`,
its default in `src/config/siteConfig.ts`, read it in the component, and add an input
to the matching editor in `src/admin/pages/AdminSiteContent.tsx`. No server change is
needed — the API stores any section key as JSON.

### Live updates

When an admin saves something, the API announces it on a Server-Sent-Events stream
(`GET /api/events`, `server/src/events/`). Open browsers listen
(`src/services/liveContent.ts`) and refetch just what changed, so visitors see edits
without reloading. If live updates ever stop, the site still works — pages just show
the change on the next load.

## Request life-cycle (what happens when a page loads)

1. Browser loads the static site from Vercel. `vercel.json` sends every URL to
   `index.html` so deep links (`/vehicles/toyota-hilux-2022`) work.
2. React starts, `SiteContentProvider` fetches site text; the page component fetches
   its own data through a function in `src/services/`.
3. Every API call goes through one of three small clients, which all add the same
   things (credentials, CSRF token, cookie-free-fallback header):
   - `src/services/http.ts` — public calls (forms, reading vehicles)
   - `src/services/customer.service.ts` — the signed-in customer
   - `src/admin/adminApi.ts` — the admin dashboard
4. In the API, `main.ts` runs shared middleware (CORS → security headers → caching
   rules → CSRF check), then Nest routes the request to a controller. Protected routes
   run `JwtAuthGuard` (who are you?) then `RolesGuard` (are you allowed?). Input is
   validated by the DTO classes; anything not declared in a DTO is rejected.

## Database (Postgres via Prisma)

Defined in `server/prisma/schema.prisma`; each change is a folder in
`server/prisma/migrations/`. Main tables:

| Area | Tables |
| --- | --- |
| People | `AdminUser`, `CustomerUser`, `AdminPasswordResetToken`, `PasswordResetToken`, `EmailVerificationToken` |
| Catalogue | `Vehicle` (has `images[]`), `HireVehicle` (has `image` cover + `images[]` gallery), `SavedVehicle`, `ContentLike` |
| Customer requests | `Inquiry`, `ImportRequest`, `ClearingRequest`, `HireRequest`, `ContactMessage`, `CustomerCase(+Update)`, `CustomerMessage` |
| Money | `Account`, `FinancialTransaction`, `PaymentSubmission` |
| Content | `SiteContent`, `Notice`, `Testimonial`, `Faq`, `BlogPost`, `Review` |
| Lycie AI | `KnowledgeEntry`, `KnowledgeDocument`, `LycieChatLog`, `VisitorSubmission`, `FaqSuggestion`, `TestimonialIdea` |
| Admin | `AuditLog`, `AdminActivity`, `ContactLog`, `VehicleViewStat` |

After editing `schema.prisma` create a migration and commit it; Render applies pending
migrations automatically on deploy (`prisma migrate deploy` in the start command).

## Where do things go? (cheat sheet)

| I want to… | Edit |
| --- | --- |
| Add a public page | `src/pages/<Name>/`, then a `<Route>` in `src/routes/AppRoutes.tsx`, then a nav link in `components/layout/Navbar.tsx` |
| Add an admin page | `src/admin/pages/`, a `<Route>` inside the admin block of `AppRoutes.tsx`, a link in `admin/components/AdminLayout.tsx` |
| Change colours / spacing / fonts | `src/styles/variables.css` (everything reads these) |
| Add an API endpoint | the feature's `*.controller.ts` (URL) + `*.service.ts` (logic) + a DTO in `dto/` |
| Change who can do what | `@Roles(...)` on the controller method (`OWNER`, `MANAGER`, `VIEWER`, `CUSTOMER`) |
| Add an environment variable | read it in code, list it in `server/.env.example`, `render.yaml` and DEPLOYMENT.md |

## Roles

| Role | Can |
| --- | --- |
| `OWNER` | everything, including Admin Users and the Activity log |
| `MANAGER` | vehicles, hire vehicles, requests, payments, all site content, Lycie |
| `VIEWER` | read submitted requests only |
| `CUSTOMER` | their own account, requests, saved vehicles, messages |

## Conventions used in the code

- **Comments explain *why***, and every file starts with what it is for. New code follows
  the same style.
- **No design in TypeScript.** Colours, spacing and fonts come from CSS variables in
  `src/styles/variables.css`; component CSS sits next to the component.
- **Mobile first.** Base CSS targets phones; `@media (min-width: …)` adds larger layouts.
  Grid columns that must be allowed to shrink use `minmax(0, 1fr)` (plain `1fr` can
  refuse to shrink and push the page wider than a small screen).
- **Server is the authority.** The browser repeats some rules (password strength, email
  format) only to give instant feedback; the API always re-checks.
