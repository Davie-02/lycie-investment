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

**Private bucket (no public access needed):** some providers charge or ask for
a card only for *public* buckets (Backblaze B2, for example). Set
`S3_PRIVATE_BUCKET="true"`, keep the bucket private, and leave
`S3_PUBLIC_URL_BASE` unset. Uploads are then stored privately and served by the
API at `/api/media/<uuid>.webp` (`src/uploads/media.controller.ts`): only names
the app generated are served, responses are cached by browsers for a year, and
the route is exempt from rate limiting. Trade-off: image bytes flow through the
API server instead of directly from the storage provider.

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
| GET    | `/api/auth/csrf`          | Public             | A fresh signed CSRF token (send it back as `x-csrf-token`) |
| GET    | `/api/auth/providers`     | Public             | Which social sign-in providers are configured |
| POST   | `/api/auth/login`         | Public             | Admin login (email, password, `remember`). Returns the session, or `{requiresTwoFactor, challenge}` when 2FA is on |
| POST   | `/api/auth/login/2fa`     | Public (challenge) | Second step: authenticator or recovery code |
| GET    | `/api/auth/session`       | Admin              | Who is signed in (also confirms the cookie works) |
| POST   | `/api/auth/change-password` | Admin            | Change own password; signs out other devices |
| POST   | `/api/auth/2fa/setup`, `/2fa/enable`, `/2fa/disable` | Admin | Two-step verification management |
| POST   | `/api/customers/social/google`, `/social/facebook` | Public | Sign in / sign up with a provider's verified proof |
| GET    | `/api/customers/session`  | Customer           | Who is signed in (also confirms the cookie works) |
| POST   | `/api/customers/verify-email`, `/me/resend-verification` | Public / Customer | Confirm email address |
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
- **CSRF protection** — signed, stateless tokens (`src/auth/csrf.ts`): the frontend
  fetches a token from `GET /api/auth/csrf` and sends it back as an `x-csrf-token`
  header on state-changing requests. The token is `nonce.expiry.HMAC(JWT_SECRET)`, so
  the API verifies it with no cookie at all (a cookie-based scheme fails on browsers
  that block third-party cookies). The old cookie-equals-header form is still accepted
  for pages loaded before the change. Requests using an `Authorization: Bearer` header
  are exempt — a forged cross-site request can't set that header.
- **Account lockout, password policy, email checks, 2FA, social sign-in** — see
  `../docs/AUTH-AND-SECURITY.md`; code in `src/security/` and `src/auth/`.
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

## Login and logout — how each works

Two independent login systems, both going through the same guard
(`JwtAuthGuard`) and the same CSRF protection, issuing separate cookies so an
admin session and a customer session never get confused with each other. The full
explanation (cookies vs. the header fallback, "keep me signed in", lockout, 2FA,
Google/Facebook, troubleshooting) is in [`../docs/AUTH-AND-SECURITY.md`](../docs/AUTH-AND-SECURITY.md).
Short version:

- **Admin** (`/api/auth/*`): email + password → optional authenticator code → a signed
  JWT, set as the httpOnly cookie `lycie_admin_session` and also returned in the response
  body for the cookie-free fallback. `GET /api/auth/session` says who is signed in.
- **Customer** (`/api/customers/*`): same shape with `lycie_customer_session`; also
  `/social/google`, `/social/facebook`, `/verify-email`, `/session`.
- **The guard** reads `Authorization: Bearer` first, then the admin cookie, then the
  customer cookie; rejects tokens whose role isn't a real session role (the 2FA
  challenge token); and re-checks the account is still active and the password hasn't
  changed since the token was issued (`SessionService.assertStillValid`).
- **Lifetimes:** `JWT_EXPIRES_IN` (2h, browser-session cookie) or
  `REMEMBER_ME_EXPIRES_IN` (30d, persistent cookie) when "Keep me signed in" is ticked.

**How this was verified:** unit tests (`npm test`) cover the guard, CSRF tokens, lockout,
password policy, email checks, TOTP (RFC 6238 vectors) and Google token verification;
the flows were also exercised against a real running API and database — registration
rules, bearer-only sessions, remember-me cookie lifetimes, 2FA with recovery codes,
the challenge token being refused as a login, and sessions ending after a password change
or deactivation. **Still to confirm on your deployment:** the Google and Facebook
buttons (they need your own client IDs), and sign-in from Safari/iOS against the
live Vercel + Render domains.

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

## Content control, live updates, likes, contact tools, admin tools

| Area | Endpoints (all admin routes are Owner/Manager unless noted) |
| --- | --- |
| Content states | `GET /api/content-admin/:type` (`state`, `q`, `page`) · `POST /api/content-admin/:type/bulk` (`publish\|unpublish\|archive\|restore\|delete`) · `POST /api/content-admin/:type/:id/duplicate`. Types: vehicles, hire-vehicles, testimonials, faq, blog-posts, notices. Public reads only ever return live items (`src/content-admin/content-state.ts` is the single source of truth). |
| Live updates | `GET /api/events` (public SSE, topic names only). Every successful write is mapped to topics by `src/events/topics.ts`. Public reads use `Cache-Control: public, no-cache` + ETag so changes show on the next request. |
| Likes | `POST /api/likes` (public, 60/min) · `GET /api/likes/counts?kind=&ids=`. Keyed by a browser-generated visitor id — a popularity signal, not a vote. |
| Contact | `GET/POST /api/contact-admin/:type/:id[/log\|/email\|/message]`, `GET /api/contact-admin/email-status`, `POST /api/contact-admin/test-email` (Owner). Recipient addresses always come from the stored request. Customer inbox: `GET /api/customers/me/messages`, `POST …/read`. |
| Admin tools | `GET /api/admin-tools/overview` · `…/search?q=` · `…/export/:type` (CSV) · `…/activity` (Owner). Every admin write is recorded (action + target only) by `ActivityInterceptor`. |
| Lycie extras | `POST /api/lycie/chat/stream` (NDJSON stream) · `POST /api/lycie/documents` (file learning) · `POST /api/lycie/write` (AI writer) · `…/testimonial-ideas[/scan\|/:id/publish\|/:id/dismiss]`. |

Images are stored at up to 2000px plus 480px and 960px copies (`…-w480.webp`,
`…-w960.webp`) so pages load only the pixels they need.

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
