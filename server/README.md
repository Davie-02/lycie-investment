# Lycie Investments — API

NestJS + Prisma + PostgreSQL backend for the Lycie Investments website. It
serves vehicle and hire-vehicle listings, accepts public requests, and provides
staff and customer authentication.

## Requirements

- Node.js 18+
- npm
- A running PostgreSQL instance (local, Docker, or hosted)

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy the env file and point it at your database:

   ```bash
   cp .env.example .env
   ```

   Edit `DATABASE_URL` in `.env` to match your PostgreSQL instance. If you
   don't have one running locally, the quickest option is:

   ```bash
   docker run --name lycie-db -e POSTGRES_USER=lycie -e POSTGRES_PASSWORD=lycie \
     -e POSTGRES_DB=lycie_investment -p 5432:5432 -d postgres:16
   ```

3. Generate the Prisma client and apply the committed migrations:

   ```bash
   npm run prisma:generate
   npm run prisma:deploy
   ```

4. Seed sample vehicle and hire-vehicle data:

   ```bash
   npm run prisma:seed
   ```

Use `prisma migrate deploy` for an existing database. Use `prisma migrate dev`
only when creating a migration during development, and never accept a schema
reset for a database containing real data.

## Development

```bash
npm run start:dev
```

The API listens on `http://localhost:3001/api` by default (see `PORT` in
`.env`). CORS is restricted to `FRONTEND_URL` (defaults to the Vite dev
server at `http://localhost:5173`).

## Admin dashboard

The site has an admin dashboard at `/admin` on the frontend (e.g.
`http://localhost:5173/admin`) for managing vehicles, hire vehicles,
bookings, payments, site content, notices, testimonials, FAQ, the blog, and
viewing submitted form requests — without touching the database directly.

### Roles

There are three roles, checked on every admin request server-side (not just
hidden in the UI):

| Role | Can do |
| --- | --- |
| **Owner** | Everything, including adding/editing/removing other admin accounts |
| **Manager** | Manage vehicles, hire vehicles, and view submitted requests — not user management |
| **Viewer** | Read-only access to submitted requests |

### First-time setup

Multiple admins live in the database (the `AdminUser` table), but you need
one account to start with. Generate a bcrypt hash of your chosen password:

```bash
node -e "console.log(require('bcryptjs').hashSync('your-password-here', 10))"
```

Set in `server/.env`:

```
ADMIN_NAME="Your Name"
ADMIN_EMAIL="you@example.com"
ADMIN_PASSWORD_HASH="<the hash you just generated>"
JWT_SECRET="<a long random string, e.g. from: openssl rand -hex 32>"
```

Then run:

```bash
npm run prisma:seed
```

This creates one Owner account from those values — but **only if no admin
users exist yet**, so it's safe to leave those env vars in place afterward.
Once you've logged in as that Owner, add further accounts (Manager/Viewer)
through **Admin Users** in the dashboard itself rather than editing `.env`
again.

**Uploaded vehicle images** are stored on local disk in `server/uploads/` by
default and served at `/uploads/<filename>`. This works fine for local
development but **not for production** on most hosts — see "Image storage in
production" below.

Uploads are limited to 5 MB and accepted only as JPEG, PNG, or WebP. The API
resizes them to fit within 2000 × 1400 pixels and stores them as WebP at a
quality setting of 82, so new uploads are smaller and consistent regardless of
the original format.

## Image storage in production

Local disk storage doesn't survive a redeploy on most hosting platforms
(Render, Railway, Fly.io, etc. all use ephemeral filesystems on their
free/cheap tiers) — every deploy would wipe every vehicle photo. Before
deploying, configure S3-compatible object storage instead. Nothing else in
the app needs to change — `UploadsService` picks whichever backend is
configured, and the frontend just displays whatever URL comes back.

**Recommended: Cloudflare R2** (S3-compatible, free tier, no egress fees):

1. Create a bucket at [dash.cloudflare.com](https://dash.cloudflare.com) → R2.
2. Enable public access on the bucket (R2 → your bucket → Settings → Public
   Access), and note the public URL it gives you.
3. Create an API token (R2 → Manage API Tokens) with read/write access to
   the bucket — this gives you an Access Key ID and Secret Access Key.
4. Set in `.env`:
   ```
   S3_BUCKET="your-bucket-name"
   S3_REGION="auto"
   S3_ACCESS_KEY_ID="..."
   S3_SECRET_ACCESS_KEY="..."
   S3_ENDPOINT="https://<account-id>.r2.cloudflarestorage.com"
   S3_FORCE_PATH_STYLE="true"
   S3_PUBLIC_URL_BASE="https://<your-public-bucket-url>"
   ```

**Alternative: real AWS S3** — create a bucket, an IAM user with
`s3:PutObject` on it, and set `S3_BUCKET`, `S3_REGION` (e.g. `us-east-1`),
`S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`. Leave `S3_ENDPOINT` and
`S3_PUBLIC_URL_BASE` unset — the app falls back to the standard
`https://<bucket>.s3.<region>.amazonaws.com/<file>` URL pattern. Make sure
the bucket (or a CloudFront distribution in front of it) allows public reads
for vehicle photos to actually display.

**Alternative: self-hosted MinIO** — same idea as R2: set `S3_ENDPOINT` to
your MinIO server, `S3_FORCE_PATH_STYLE="true"`, and `S3_PUBLIC_URL_BASE` to
wherever MinIO serves public reads from.

## Endpoints

| Method | Path                      | Auth              | Purpose                                  |
| ------ | ------------------------- | ------------------ | ----------------------------------------- |
| GET    | `/api/health`             | Public             | Health check                             |
| GET    | `/api/vehicles`           | Public             | List vehicles (`?page=1&pageSize=24`) |
| GET    | `/api/vehicles/:slug`     | Public             | Vehicle detail                           |
| POST   | `/api/vehicles`           | Owner/Manager      | Create a vehicle                         |
| PATCH  | `/api/vehicles/:id`       | Owner/Manager      | Update a vehicle                         |
| DELETE | `/api/vehicles/:id`       | Owner/Manager      | Delete a vehicle                         |
| GET    | `/api/hire-vehicles`      | Public             | List hire vehicles (`?page=1&pageSize=24`) |
| POST   | `/api/hire-vehicles`      | Owner/Manager      | Create a hire vehicle                    |
| PATCH  | `/api/hire-vehicles/:id`  | Owner/Manager      | Update a hire vehicle                    |
| DELETE | `/api/hire-vehicles/:id`  | Owner/Manager      | Delete a hire vehicle                    |
| POST   | `/api/inquiries`          | Public             | Submit a vehicle inquiry                 |
| GET    | `/api/inquiries`          | Any admin role     | List submitted inquiries                 |
| PATCH  | `/api/inquiries/:id/status` | Owner/Manager    | Mark new/contacted/closed                |
| POST   | `/api/import-requests`    | Public             | Submit an import request                 |
| GET    | `/api/import-requests`    | Any admin role     | List submitted import requests           |
| PATCH  | `/api/import-requests/:id/status` | Owner/Manager | Mark new/contacted/closed           |
| POST   | `/api/clearing-requests`  | Public             | Submit a clearing request                |
| GET    | `/api/clearing-requests`  | Any admin role     | List submitted clearing requests         |
| PATCH  | `/api/clearing-requests/:id/status` | Owner/Manager | Mark new/contacted/closed          |
| POST   | `/api/hire-requests`      | Public             | Submit a hire request                    |
| GET    | `/api/hire-requests`      | Any admin role     | List submitted hire requests             |
| GET    | `/api/hire-requests/bookings` | Any admin role | List confirmed bookings not yet marked returned (includes overdue) |
| GET    | `/api/hire-requests/:id`  | Any admin role     | Get a single hire request/booking        |
| PATCH  | `/api/hire-requests/:id/status` | Owner/Manager | Confirm, cancel, complete, or revert a booking |
| POST   | `/api/contact-messages`   | Public             | Submit a contact form message            |
| GET    | `/api/contact-messages`   | Any admin role     | List submitted contact messages          |
| PATCH  | `/api/contact-messages/:id/status` | Owner/Manager | Mark new/contacted/closed           |
| POST   | `/api/auth/login`         | Public             | Admin login, returns a JWT + user profile |
| POST   | `/api/customers/register` | Public             | Create a customer and account       |
| POST   | `/api/customers/login`    | Public             | Customer login, returns a JWT + profile |
| POST   | `/api/customers/logout`   | Public             | Clear the customer session cookie   |
| POST   | `/api/customers/forgot-password` | Public      | Email a password reset link if the address has an account (same response either way) |
| POST   | `/api/customers/reset-password` | Public       | Set a new password using a valid, unexpired reset token |
| PATCH  | `/api/customers/me`       | Customer           | Update name and/or email            |
| POST   | `/api/customers/me/change-password` | Customer | Change password (requires current password) |
| GET    | `/api/customers/me/cases` | Customer           | View staff-managed vehicle/order updates |
| GET    | `/api/customers/me/requests` | Customer        | Unified history of inquiries/import/clearing/hire requests and contact messages submitted while signed in |
| GET    | `/api/financial/me`       | Customer           | Get balance and paginated history   |
| POST   | `/api/financial/me/payment-submissions` | Customer | Submit amount and proof for review |
| GET    | `/api/financial/payments` | Owner/Manager      | List payment submissions to review  |
| POST   | `/api/financial/payments/:id/approve` | Owner/Manager | Approve and credit a payment |
| POST   | `/api/financial/payments/:id/reject` | Owner/Manager | Reject a payment submission |
| POST   | `/api/customer-cases` | Owner/Manager      | Create a customer vehicle/order case |
| POST   | `/api/customer-cases/:id/updates` | Owner/Manager | Add a customer status update |
| POST   | `/api/uploads`            | Owner/Manager      | Upload an image, returns its URL         |
| GET    | `/api/site-content`       | Public             | Get all editable site content sections   |
| PATCH  | `/api/site-content/:key`  | Owner/Manager      | Update one content section (contact/social/about) |
| GET    | `/api/notices`            | Public             | List active notices (banners + popups)   |
| GET    | `/api/notices/all`        | Owner/Manager      | List all notices, including inactive     |
| POST   | `/api/notices`            | Owner/Manager      | Create a notice                          |
| PATCH  | `/api/notices/:id`        | Owner/Manager      | Update a notice (including on/off toggle)|
| DELETE | `/api/notices/:id`        | Owner/Manager      | Delete a notice                          |
| GET    | `/api/admin-users`        | Owner only         | List admin accounts                      |
| POST   | `/api/admin-users`        | Owner only         | Create an admin account                  |
| PATCH  | `/api/admin-users/:id`    | Owner only         | Update role, active status, or password  |
| DELETE | `/api/admin-users/:id`    | Owner only         | Delete an admin account                  |
| GET    | `/api/testimonials`       | Public             | List testimonials (`?page=1&pageSize=100`) |
| POST   | `/api/testimonials`       | Owner/Manager      | Create a testimonial                     |
| PATCH  | `/api/testimonials/:id`   | Owner/Manager      | Update a testimonial                     |
| DELETE | `/api/testimonials/:id`   | Owner/Manager      | Delete a testimonial                     |
| GET    | `/api/faq`                | Public             | List FAQ entries (`?page=1&pageSize=100`) |
| POST   | `/api/faq`                | Owner/Manager      | Create an FAQ entry                      |
| PATCH  | `/api/faq/:id`            | Owner/Manager      | Update an FAQ entry                      |
| DELETE | `/api/faq/:id`            | Owner/Manager      | Delete an FAQ entry                      |
| GET    | `/api/blog-posts`         | Public             | List published blog posts                |
| GET    | `/api/blog-posts/all`     | Owner/Manager      | List all blog posts, including drafts (`?page=1&pageSize=20`) |
| GET    | `/api/blog-posts/:slug`   | Public             | Get a single published blog post         |
| POST   | `/api/blog-posts`         | Owner/Manager      | Create a blog post (draft or published)  |
| PATCH  | `/api/blog-posts/:id`     | Owner/Manager      | Update a blog post, including publish/unpublish |
| DELETE | `/api/blog-posts/:id`     | Owner/Manager      | Delete a blog post                       |

Payment review is available in the admin dashboard at `/admin/payments` for
Owners and Managers. A customer submission remains pending until staff checks
the uploaded proof. Only approval creates a financial transaction and changes
the account balance.

Admin and customer browser sessions use secure HTTP-only cookies set by the
login endpoints. The frontend sends them with credentialed requests, so JWTs
are not exposed to JavaScript or stored in browser storage. Bearer headers are
still accepted for non-browser API clients. Role checks happen server-side via
`RolesGuard` (`src/auth/roles.guard.ts`) — the frontend also hides
unavailable actions in the UI, but that's a UX nicety, not the actual
security boundary.

All POST endpoints validate their body with `class-validator` and reject
unknown fields (`forbidNonWhitelisted`). Malformed submissions return a `400`
with details of what failed — the frontend surfaces these as real form errors
rather than a generic failure message.

Public vehicle and hire-vehicle listings are paginated. Each response contains
`items`, `total`, `page`, and `pageSize`; page sizes are capped at 100. Public
read-only content is cacheable for one minute and can be served stale for up to
five minutes while revalidating. Other API responses are marked `no-store`.
Responses are compressed with gzip or deflate when the client supports it.

## Marketing content (testimonials, FAQ, blog)

This was originally going to be a separate Strapi CMS so non-technical
staff could publish marketing content without a deploy. That didn't pan
out: Strapi 5 (checked at 5.52.3 and the latest 5.54.0) fails to boot at
all under Node 20+, including the Node 24 this project runs on — it
crashes immediately with `ERR_UNSUPPORTED_DIR_IMPORT` on a `lodash/fp`
import inside Strapi's own compiled output. This is a known, open,
unresolved upstream issue ([strapi/strapi#25993](https://github.com/strapi/strapi/issues/25993)),
not something fixable from this project's side, and the pattern recurs
across dozens of files in `@strapi/core`/`@strapi/utils` — not something
safe to hand-patch either.

So testimonials, FAQ, and the blog are managed the same way as
notices and site content: real Prisma models (`Testimonial`, `Faq`,
`BlogPost`), admin-only CRUD (`src/testimonials`, `src/faq`,
`src/blog-posts`), public read endpoints, and dashboard pages at
`/admin/testimonials`, `/admin/faq`, and `/admin/blog`. Blog posts have a
draft/published state (`publishedAt: null` = draft, hidden from
`GET /blog-posts` and `GET /blog-posts/:slug`, but visible to admins via
`GET /blog-posts/all`). SEO defaults (site name, meta description,
Facebook App ID) are just a fourth `SiteContent` key (`"seo"`, alongside
`contact`/`social`/`about`), editable from the same "Site Content" admin
page — see `src/types/siteContent.ts` on the frontend.

The three admin tables (`/admin/testimonials`, `/admin/faq`, `/admin/blog`)
are paginated — 20 rows per page, with Previous/Next controls
(`src/admin/components/AdminPagination.tsx`) — rather than fetching
everything at once. Deleting the last item on a page falls back a page
automatically instead of showing a blank table.

## Data model

Defined in `prisma/schema.prisma`. Public request/inquiry records keep their
submitted contact details directly. Authenticated customers use a separate
`CustomerUser` identity, one `Account`, and an append-only
`FinancialTransaction` ledger. `AuditLog` records customer and transaction
creation events. `Vehicle` and `HireVehicle` store `features`/`images` as
native PostgreSQL arrays because they do not need independent image records.

Financial writes update the balance and create the ledger entry in one Prisma
transaction. History queries resolve the account from the authenticated JWT
subject rather than a name or client-supplied user ID.

Customers cannot create ledger transactions or change their balance directly.
They submit a payment amount and an image of the proof of payment. Every
submission starts as `PENDING`. An Owner or Manager must review it and approve
it before the account balance and append-only ledger change. Rejections leave
the balance unchanged. Customer-facing sessions expire after 30 minutes of
inactivity, in addition to the two-hour JWT expiry configured by the server.
Production cookies use `Secure` and `SameSite=None` because the frontend and
API are deployed on separate domains. `FRONTEND_URL` is required in production
and CORS allows only that exact origin. State-changing cookie requests also
require the CSRF token issued by `/api/auth/csrf`.

## Hire pricing

`HireRequest.days` and `.totalCost` are computed automatically in
`src/hire-requests/hire-pricing.util.ts` from the hire vehicle's daily/weekly
rates and the requested pickup/return dates — never accepted from the
client, so a submitted request can't be tampered with to claim a lower
price. The algorithm picks whichever is cheaper: plain daily rate × days, or
full weeks at the weekly rate plus remaining days at the daily rate — the
same logic real vehicle hire pricing uses, applied automatically rather than
requiring the customer to ask for a weekly discount.

The frontend (`src/utils/hirePricing.ts`) has an identical copy of this
function for showing a live estimate while filling out the hire form —
intentionally duplicated rather than shared via a package, since it's one
small pure function and the actual charge is always recomputed here on the
server regardless of what the frontend estimated.

Currently day-granularity only, matching the rates that exist on
`HireVehicle` today (daily/weekly). Adding hourly pricing later would mean
adding an hourly rate field and extending this function — the shape of the
calculation wouldn't need to change.

## Follow-up status tracking

Inquiries, import requests, clearing requests, and contact messages each
have a `status`: `new` → `contacted` → `closed` (defaults to `new` on
submission). This is a simple three-state model, not a full CRM pipeline —
the admin UI lets Owner/Manager cycle a submission through the three states
with one click, so it's obvious at a glance what still needs following up.
Hire requests use a different, richer status model (`pending` →
`confirmed`/`cancelled`/`completed`) since a hire request becomes an actual
vehicle booking — see "Bookings" below.

## Bookings

A hire request only becomes a real "booking" once an admin **confirms** it
(`PATCH /api/hire-requests/:id/status`) — until then it's just a submission
sitting under Submitted Requests → Hire Requests, same as any other
inquiry. Confirming checks for overlapping confirmed bookings on the same
vehicle first and rejects with a `409` if found, so two customers can't end
up confirmed for the same car on overlapping dates.

`GET /api/hire-requests/bookings` returns every **confirmed** booking that
hasn't been marked returned yet — including ones whose return date has
already passed. The frontend derives the actual display phase (Upcoming /
Active / Overdue) from the current date vs. the booking's pickup/return
dates; "Overdue" is not the same as "Completed" — an admin has to explicitly
mark a booking **Mark as Returned** for it to become `completed` and drop
off the Bookings list. This distinction matters: without it, a vehicle that
was never actually brought back would silently look "done" once its return
date passed.

## Email notifications

Emails are sent via [Resend](https://resend.com)'s REST API, called
directly with `fetch` (see `src/email/email.service.ts`) rather than adding
their SDK as a dependency — this project only sends a handful of simple
transactional emails.

**If `RESEND_API_KEY` isn't set, sending is skipped and logged as a
warning** rather than the app crashing — so local development works without
a real email account. To enable it:

1. Sign up free at [resend.com](https://resend.com) (3,000 emails/month,
   100/day, no credit card — verify current terms before relying on this
   long-term, free tiers change).
2. Verify a sending domain (or use `onboarding@resend.dev` for testing).
3. Set `RESEND_API_KEY`, `EMAIL_FROM`, and `ADMIN_NOTIFICATION_EMAIL` in
   `.env`.

**What triggers an email:**

| Event | Recipient | Email |
| --- | --- | --- |
| Any form submitted (inquiry, import, clearing, hire, contact) | Admin (`ADMIN_NOTIFICATION_EMAIL`) | "New \[type\] submission" with a summary |
| Hire request submitted | Customer | "We've received your hire request" |
| Booking confirmed | Customer | "Your hire booking is confirmed" |
| Booking cancelled | Customer | "Your hire booking has been cancelled" |
| Booking marked returned | Customer | "Thanks for hiring with Lycie Investments" |
| Confirmed booking due back tomorrow | Customer | Reminder (once per booking — see below) |
| Confirmed booking overdue | Customer | Overdue notice (once per booking — see below) |
| Password reset requested | Customer | Reset link, expires in 1 hour |

Reverting a booking to "pending" doesn't send anything — that's treated as
an internal admin correction, not something the customer needs to hear
about.

**Password reset specifically needs `RESEND_API_KEY` set to actually work**
in a way the other notifications don't: those are all "nice to have"
confirmations, but if email sending is skipped, `POST
/customers/forgot-password` still returns its generic success response (by
design — it never reveals whether an account exists) while silently sending
nothing, leaving a customer with no way to know the reset link never
arrived. Don't deploy without `RESEND_API_KEY` configured if customer
self-service password reset needs to actually work.

## Due/overdue reminders

`src/hire-requests/hire-reminders.cron.ts` runs once a day
(`@nestjs/schedule`, 8am server time) and checks confirmed bookings for two
things: return date is tomorrow (sends a "due back soon" reminder), or
return date has already passed (sends an overdue notice). Each booking only
ever gets one of each — `dueReminderSentAt` / `overdueReminderSentAt` on
`HireRequest` track whether it's already been sent, so the same booking
doesn't get emailed every single day once it's overdue.

This requires the Node process to actually stay running continuously (cron
jobs don't fire if the server is asleep) — worth keeping in mind if you're
on a hosting tier that spins down on inactivity (see `DEPLOYMENT.md`).

## What's not here

- Password reset / "forgot password" self-service flow — an Owner can reset
  anyone's password via **Admin Users** in the dashboard, but there's no
  email-based reset link flow yet.
- Reliable cron on a spin-down-after-inactivity host — Render's free web
  service tier sleeps after 15 minutes with no traffic, and a sleeping
  process doesn't run scheduled jobs. The daily due/overdue reminder cron
  will silently stop firing on a quiet site with no visitors around 8am.
  Options: upgrade to Render's always-on Starter tier, or ping the API
  periodically from an external uptime monitor to keep it awake.

## Security

A summary of what's in place, and why, for anyone auditing this before a
production launch:

- **Password hashing** — bcrypt (10 rounds for admins, 12 for customers),
  never returned by any API response (`SAFE_SELECT`/`CUSTOMER_SELECT`
  constants exclude `passwordHash` explicitly).
- **HTTP security headers** — `helmet` (see `main.ts`). Content-Security-Policy
  is deliberately disabled since this server only ever returns JSON and
  images, never HTML for a browser to render — CSP protects against
  malicious *scripts* on a page, which doesn't apply here.
  `crossOriginResourcePolicy` is set to `cross-origin` rather than helmet's
  default, because the default would block the frontend from loading
  vehicle photos served from this API (a different origin).
- **CSRF protection** — a double-submit-cookie pattern (`src/auth/csrf.ts`):
  the frontend fetches a token from `GET /api/auth/csrf`, then must send it
  back as an `x-csrf-token` header on every state-changing request. This
  matters because admin and customer sessions use httpOnly cookies (not
  bearer tokens), and cookies are sent automatically by browsers on
  cross-site requests unless something stops it. Requests using a
  `Authorization: Bearer` header are exempt, since that pattern isn't
  vulnerable to CSRF the same way.
- **Rate limiting** — a generous global default (100 requests/60s per IP,
  `@nestjs/throttler`) so normal browsing never hits it, plus a much
  stricter limit specifically on login/register endpoints (5 attempts/60s)
  to make password brute-forcing impractical. See `AppModule`,
  `auth.controller.ts`, `customers.controller.ts`.
- **Concurrency-safe money and booking operations** — payment approval,
  hire booking confirmation, and admin-account changes that could strand
  the system with no Owner all run inside Serializable-isolation database
  transactions (`src/common/run-serializable.ts`), so two simultaneous
  requests can't both succeed and corrupt data (e.g. double-crediting a
  payment, double-booking a vehicle).
- **No name-based or user-supplied-ID-based identity** — every endpoint
  that returns "your own" data derives who "you" are from the verified JWT
  (`@CurrentUser()`), never from a client-supplied ID in the request body
  or query string.
- **Input validation** — every DTO uses `class-validator` with
  `whitelist: true, forbidNonWhitelisted: true` globally, so unexpected
  fields in a request body are rejected rather than silently accepted.

**Known, accepted limitation:** `customers.service.ts`'s login doesn't do a
dummy password comparison when the email doesn't exist, so there's a
theoretical timing difference between "no such account" and "wrong
password." This is a real, low-severity technique some threat models care
about; for this application's scale it wasn't judged worth the added
complexity, but it's a one-line fix if that changes.

## Login and logout — how each works

Two independent login systems, both going through the same guard
(`JwtAuthGuard`) and the same CSRF protection, but issuing separate cookies
so an admin session and a customer session never get confused with each
other:

**Admin** (`/api/auth/*`): login checks the submitted email/password against
the `AdminUser` table, and on success sets an httpOnly cookie
(`lycie_admin_session`) containing a signed JWT. Logout clears that cookie.
The frontend never sees or stores the token itself — `src/admin/adminApi.ts`
relies entirely on the cookie being sent automatically (`credentials:
"include"`) and reacts to a `401` by clearing local UI state and redirecting
to `/admin/login`.

**Customer** (`/api/customers/*`): same shape, different cookie
(`lycie_customer_session`), different table (`CustomerUser`), and the JWT
payload's `role` is fixed to `"CUSTOMER"` rather than one of the admin
roles — this is what makes `@Roles("CUSTOMER")` vs `@Roles("OWNER",
"MANAGER")` guards work correctly on shared route patterns like
`/api/financial/me`.

**What I verified by reading the code** (both directions of each flow):
registering/logging in issues a valid session cookie; logging out clears it;
`JwtAuthGuard` correctly reads the token from either an admin or a customer
cookie (or a bearer header, for API-style access); role guards correctly
separate what an admin token vs. a customer token can access; a wrong
password is rejected with a generic "invalid email or password" (not
"wrong password", which would let someone enumerate valid emails).

**What I could not verify without a running database** (be sure to check
these yourself before go-live): actually registering a customer end-to-end
in a browser and confirming the cookie appears with the right flags in dev
tools; confirming the CSRF flow works across your real deployed frontend
and backend domains, not just localhost; confirming session expiry
(`JWT_EXPIRES_IN`) actually forces a re-login rather than silently failing
requests.

## Reviews, insights and the Lycie assistant

**Reviews** (`/api/reviews`): public submission (5/min, optionally tied to a
logged-in customer), public list of *approved* reviews only, admin moderation
(`/reviews/all`, `/reviews/:id/status`, delete — Owner/Manager). Sentiment is
computed offline (`src/insights/sentiment.util.ts`: word lexicon with
negation/intensifiers, blended with the star rating) — no external service.

**Insights** (`GET /api/insights/overview`, Owner/Manager): KPIs, sentiment
split, weekly volume, vehicle demand (saves, anonymous per-day view counts,
inquiries) and rule-based recommendations (`recommendations.util.ts`).
`POST /api/insights/vehicle-views/:vehicleId` is a throttled public counter that
stores only `(vehicle, day, count)` — no visitor identifiers.

**Lycie** (`src/lycie/`, Google Gemini REST API, key in `GEMINI_API_KEY`):

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/api/lycie/status` | Public | `{enabled}` — widget hides itself without a key |
| POST | `/api/lycie/chat` | Public, 10/min | Ask a question (`message` ≤ 500 chars, ≤ 6 history turns) |
| POST | `/api/lycie/feedback` | Public, 30/min | 👍/👎 on an answer (by unguessable log id) |
| POST | `/api/lycie/submissions` | Public, 5/min | Anonymous "Ask us" question/comment from `/faq` |
| GET/POST/PATCH/DELETE | `/api/lycie/knowledge[/:id]` | Owner/Manager | Admin-fed knowledge notes |
| GET | `/api/lycie/analytics` | Owner/Manager | Outcomes, helpful votes, gaps, recent chats |
| GET/PATCH/DELETE | `/api/lycie/submissions[/:id]` | Owner/Manager | Visitor messages inbox |
| GET | `/api/lycie/top-questions` | Owner/Manager | Most-asked topics (last 30 days) + whether the FAQ covers them |
| GET | `/api/lycie/suggestions` | Owner/Manager | AI-drafted FAQ entries (`?status=pending|published|rejected`) |
| POST | `/api/lycie/suggestions/generate` | Owner/Manager, 3/min | Analyse questions and draft entries (max 5 AI calls) |
| PATCH / POST | `/api/lycie/suggestions/:id[/publish|/reject]` | Owner/Manager | Edit, publish to the FAQ, or reject |

How a chat request flows: validate → redact PII → per-IP and daily caps →
build the prompt from the *live database* (contact/about/services from
`SiteContent`, ≤ 40 vehicles, hire fleet, FAQ, active knowledge notes; cached
45 s, cleared on knowledge/FAQ edits) → Gemini with an ordered model fallback
chain (`gemini.client.ts`: per-model cooldowns for quota/overload/404, 10 s
per attempt, 25 s total) → parse the reply (`[[NO_INFO]]` marks a knowledge
gap; `[[vehicle:slug]]` markers are only honoured for real vehicles) → log the
redacted question/answer → respond. If every model fails, the reply is the
company's contact details. Knowledge beyond `LYCIE_KNOWLEDGE_CHARS` is
narrowed with Postgres full-text search (`websearch_to_tsquery`, GIN index in
the migration) then keyword overlap.

Safety properties, each covered by unit tests where marked ✓: customer text and
admin-authored notes are wrapped in delimited data blocks and delimiter
look-alikes are stripped ✓; the chat has no tools/actions; PII redaction runs
before sending and before logging ✓; the API key is sent in a header, never a
URL ✓; vehicle cards can only reference real inventory ✓; learning is
human-in-the-loop — raw chats never change behaviour, an admin promotes gaps to
knowledge or approves FAQ drafts.

**FAQ suggestions:** questions from chat logs and visitor submissions are
grouped by shared topic words (`question-clusters.util.ts`, no AI, ✓). For
popular topics (asked ≥ `LYCIE_SUGGEST_MIN_ASKS`, default 2) that neither the FAQ
nor an earlier draft covers, Lycie drafts a Q&A from company data only; if the
data doesn't cover it the draft is flagged `needsInput` and can't be published
until an admin writes the answer. Runs weekly (Mon 06:00) and on demand.
Rejected topics are never re-suggested. Chat logs and visitor messages are
purged after `LYCIE_LOG_RETENTION_DAYS` (daily 03:00 job).

## Rate limiting

See the Security section above. Behind a reverse proxy (Render, Nginx…) set
`TRUST_PROXY=1`, otherwise `request.ip` is the proxy's address and every visitor
shares one limit. Lycie's hourly per-IP and daily caps are in-memory (single
instance) — see `DEPLOYMENT.md`.

## Verification

Run `npm run build`, `npm run lint`, and `npx prisma validate` before deploying.
For a database-backed environment, also run `npm run prisma:deploy` and check
`npx prisma migrate status`. Do not use `prisma migrate dev` against a shared
or production database.
