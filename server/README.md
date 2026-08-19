# Lycie Investment — API

NestJS + Prisma + PostgreSQL backend for the Lycie Investment website. Serves
vehicle/hire-vehicle listings and accepts the site's inquiry, import, clearing,
hire, and contact form submissions.

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

3. Generate the Prisma client and run the initial migration:

   ```bash
   npx prisma migrate dev --name init
   ```

4. Seed sample vehicle and hire-vehicle data:

   ```bash
   npm run prisma:seed
   ```

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
| GET    | `/api/vehicles`           | Public             | List vehicles (`?featured=true&limit=3`) |
| GET    | `/api/vehicles/:slug`     | Public             | Vehicle detail                           |
| POST   | `/api/vehicles`           | Owner/Manager      | Create a vehicle                         |
| PATCH  | `/api/vehicles/:id`       | Owner/Manager      | Update a vehicle                         |
| DELETE | `/api/vehicles/:id`       | Owner/Manager      | Delete a vehicle                         |
| GET    | `/api/hire-vehicles`      | Public             | List hire vehicles                       |
| POST   | `/api/hire-vehicles`      | Owner/Manager      | Create a hire vehicle                    |
| PATCH  | `/api/hire-vehicles/:id`  | Owner/Manager      | Update a hire vehicle                    |
| DELETE | `/api/hire-vehicles/:id`  | Owner/Manager      | Delete a hire vehicle                    |
| POST   | `/api/inquiries`          | Public             | Submit a vehicle inquiry                 |
| GET    | `/api/inquiries`          | Any admin role     | List submitted inquiries                 |
| POST   | `/api/import-requests`    | Public             | Submit an import request                 |
| GET    | `/api/import-requests`    | Any admin role     | List submitted import requests           |
| POST   | `/api/clearing-requests`  | Public             | Submit a clearing request                |
| GET    | `/api/clearing-requests`  | Any admin role     | List submitted clearing requests         |
| POST   | `/api/hire-requests`      | Public             | Submit a hire request                    |
| GET    | `/api/hire-requests`      | Any admin role     | List submitted hire requests             |
| POST   | `/api/contact-messages`   | Public             | Submit a contact form message            |
| GET    | `/api/contact-messages`   | Any admin role     | List submitted contact messages          |
| POST   | `/api/auth/login`         | Public             | Admin login, returns a JWT + user profile |
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

Admin routes require an `Authorization: Bearer <token>` header, using the
token returned from `/api/auth/login`. Role checks happen server-side via
`RolesGuard` (`src/auth/roles.guard.ts`) — the frontend also hides
unavailable actions in the UI, but that's a UX nicety, not the actual
security boundary.

All POST endpoints validate their body with `class-validator` and reject
unknown fields (`forbidNonWhitelisted`). Malformed submissions return a `400`
with details of what failed — the frontend surfaces these as real form errors
rather than a generic failure message.

## Data model

Defined in `prisma/schema.prisma`. Deliberately kept flat: request/inquiry
records store their own contact details directly rather than through a
normalized `Customer` table, since nothing yet needs that level of structure
(see the project brief's "don't overengineer" guidance). `Vehicle` and
`HireVehicle` store `features`/`images` as native PostgreSQL arrays rather
than separate tables, for the same reason.

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

## What's not here

- Password reset / "forgot password" self-service flow — an Owner can reset
  anyone's password via **Admin Users** in the dashboard, but there's no
  email-based reset link flow yet.

## Rate limiting

All endpoints are rate-limited globally to 20 requests per 60 seconds per IP
(`@nestjs/throttler`, see `AppModule`). This is meant to blunt scripted spam
on the public POST endpoints (forms), not to restrict normal browsing —
adjust the limit in `app.module.ts` if it turns out too tight or too loose
in practice.

## Note on this build

This backend was written in an environment without internet or database
access, so it hasn't been run, migrated, or seeded here. Please treat your
first `npm install && npx prisma migrate dev` as the real verification step
and report back anything that doesn't work as expected.
