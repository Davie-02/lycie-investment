# Lycie Investment — API

NestJS + Prisma + PostgreSQL backend for the Lycie Investment website. It
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
`http://localhost:5173/admin`) for managing vehicles, hire vehicles, and
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
| GET    | `/api/customers/me/cases` | Customer           | View staff-managed vehicle/order updates |
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
| Booking marked returned | Customer | "Thanks for hiring with Lycie Investment" |
| Confirmed booking due back tomorrow | Customer | Reminder (once per booking — see below) |
| Confirmed booking overdue | Customer | Overdue notice (once per booking — see below) |

Reverting a booking to "pending" doesn't send anything — that's treated as
an internal admin correction, not something the customer needs to hear
about.

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

## Rate limiting

All endpoints are rate-limited globally to 20 requests per 60 seconds per IP
(`@nestjs/throttler`, see `AppModule`). This is meant to blunt scripted spam
on the public POST endpoints (forms), not to restrict normal browsing —
adjust the limit in `app.module.ts` if it turns out too tight or too loose
in practice.

## Verification

Run `npm run build`, `npm run lint`, and `npx prisma validate` before deploying.
For a database-backed environment, also run `npm run prisma:deploy` and check
`npx prisma migrate status`. Do not use `prisma migrate dev` against a shared
or production database.
