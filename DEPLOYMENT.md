# Deploying Lycie Investment

This gets the site off `localhost` onto real hosting: a database, the API,
and the frontend, each on its own service. Total cost: **$0/month** on the
tiers below, with the honest tradeoffs noted for each.

Recommended stack:

| Piece            | Service              | Why                                                             |
| ----------------- | --------------------- | ---------------------------------------------------------------- |
| Database          | [Neon](https://neon.tech) | Free Postgres tier that **never expires** (verified against Neon's current docs as of mid-2026) — unlike Render's free Postgres, which is deleted after 30 days. Not something you want happening to a live business's data. |
| Backend API       | [Render](https://render.com) | Free web service tier, git-based deploys, no credit card required. |
| Frontend          | [Vercel](https://vercel.com) | Built for exactly this (Vite/React SPA), free tier, git-based deploys. |
| Image storage     | Cloudflare R2         | Already covered in `server/README.md` — do this first if you haven't. |

**Known tradeoff to accept going in:** Render's free web services spin down
after 15 minutes of no traffic and take ~30–60 seconds to wake back up on
the next request. For a low-traffic small business site this is usually
fine — the first visitor after a quiet period just waits a bit longer. If
that's not acceptable, Render's paid "Starter" tier ($7/mo) keeps it always
on; nothing else about this guide changes if you upgrade later.

This spin-down also means the daily hire-reminder cron job (see
`server/README.md`) won't fire if nobody's visited the site around when it's
scheduled to run. If reminder emails matter to how you operate, either
upgrade to Starter or set up a free external uptime monitor (e.g.
UptimeRobot) pinging `/api/health` every few minutes to keep the service
awake.

Verify current pricing/limits yourself before relying on this long-term —
free tiers change. This guide was checked against each provider's docs
around the time it was written.

---

## 0. Prerequisites

- Your code is pushed to GitHub (already done)
- You've decided on image storage — at minimum, set up Cloudflare R2 per
  `server/README.md`'s "Image storage in production" section, and have your
  `S3_*` values ready. You'll paste them into Render in step 2.

---

## 1. Database — Neon

1. Sign up at [neon.tech](https://neon.tech) (GitHub login works).
2. Create a new project — name it `lycie-investment`.
3. On the project dashboard, copy the **connection string** (looks like
   `postgresql://user:password@ep-xxx.region.aws.neon.tech/dbname?sslmode=require`).
   Keep this — it's your `DATABASE_URL`.

That's the whole database step. No server to manage.

---

## 2. Backend API — Render

1. Sign up at [render.com](https://render.com) and connect your GitHub account.
2. Click **New → Blueprint**, and point it at your `lycie-investment` repo.
   Render will detect `render.yaml` at the repo root and read the service
   definition from it.

   If you'd rather set it up manually instead of using the blueprint:
   **New → Web Service** → select the repo → set:
   - **Root Directory:** `server`
   - **Build Command:** `npm install && npx prisma generate && npm run build`
   - **Start Command:** `npx prisma migrate deploy && npm run start:prod`
   - **Plan:** Free

3. Either way, before the first deploy, set these environment variables in
   Render's dashboard (Environment tab):

   | Key | Value |
   | --- | --- |
   | `DATABASE_URL` | The Neon connection string from step 1 |
   | `PORT` | `3001` |
   | `NODE_ENV` | `production` — **required**, not optional. Session cookies use different security settings in production vs. development, and the app refuses to start without `FRONTEND_URL` set when this is `production`. |
   | `FRONTEND_URL` | Leave as `http://localhost:5173` for now — you'll update this after step 3 |
   | `ADMIN_NAME` | Your name |
   | `ADMIN_EMAIL` | Your email — this becomes your Owner login |
   | `ADMIN_PASSWORD_HASH` | Generate with `node -e "console.log(require('bcryptjs').hashSync('your-password', 10))"` |
   | `JWT_SECRET` | If using the blueprint, Render generates this for you automatically |
   | `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_ENDPOINT`, `S3_FORCE_PATH_STYLE`, `S3_PUBLIC_URL_BASE` | Your R2 (or S3/MinIO) values from `server/README.md` |
   | `RESEND_API_KEY`, `EMAIL_FROM`, `ADMIN_NOTIFICATION_EMAIL` | Optional — leave blank to skip email notifications entirely, or see `server/README.md`'s email section |

4. Deploy. Watch the build logs — the start command runs
   `prisma migrate deploy`, which applies your committed migration to the
   fresh Neon database automatically.
5. Once live, note the URL Render gives you, e.g.
   `https://lycie-investment-api.onrender.com`. Test it:
   ```bash
   curl https://lycie-investment-api.onrender.com/api/health
   ```
   Should return `{"status":"ok","timestamp":"..."}`.
6. **Run the seed script — this step is required**, not optional. It's what
   creates your first Owner login (from `ADMIN_NAME`/`ADMIN_EMAIL`/
   `ADMIN_PASSWORD_HASH`), so there's no way into `/admin` without running it
   at least once. It also adds placeholder sample vehicles — safe to leave in
   place while you enter real inventory, or delete them via `/admin` once you
   do. Run it via Render's **Shell** tab (under your service):
   ```bash
   npm run prisma:seed
   ```

---

## 3. Frontend — Vercel

1. Sign up at [vercel.com](https://vercel.com), connect GitHub.
2. **Add New → Project**, select the `lycie-investment` repo.
3. Vercel should auto-detect Vite. Confirm:
   - **Framework Preset:** Vite
   - **Root Directory:** the repo root (leave default — the frontend lives
     there, `server/` is a subfolder Vercel ignores for this project)
   - **Build Command:** `npm run build` (default)
   - **Output Directory:** `dist` (default)
4. Add an environment variable:
   | Key | Value |
   | --- | --- |
   | `VITE_API_BASE_URL` | Your Render API URL + `/api`, e.g. `https://lycie-investment-api.onrender.com/api` |
5. Deploy. Vercel gives you a URL like `https://lycie-investment.vercel.app`
   (or connect a custom domain under Project Settings → Domains).

---

## 4. Connect them: fix CORS

Right now the backend only accepts requests from `http://localhost:5173`.
Go back to Render, update the `FRONTEND_URL` environment variable to your
real Vercel URL (e.g. `https://lycie-investment.vercel.app`), and redeploy
the backend (Render redeploys automatically when you save an env var
change, or trigger it manually).

**Why this matters for login specifically:** admin and customer logins use
session cookies, not tokens stored in the browser. Your frontend
(`*.vercel.app`) and backend (`*.onrender.com`) are on different domains,
which browsers treat as "cross-site" — by default, cookies aren't sent on
cross-site requests at all. With `NODE_ENV=production` set correctly (step
2), the app configures cookies with `SameSite=None; Secure`, which is the
one combination browsers allow for this cross-domain setup. If login
appears to succeed but every subsequent request acts logged-out, this is
almost always the cause — double check `NODE_ENV` is actually `production`
on Render, not left at its local-dev default.

---

## 5. Verify end-to-end

- Visit your Vercel URL. The homepage should load, including the vehicle
  carousel if any vehicles are marked available.
- Visit `/vehicles` — should show the seeded sample vehicles.
- Visit `/admin`, log in with the `ADMIN_EMAIL`/password you set, add a
  test vehicle with an image, confirm it appears on `/vehicles`.
- Submit a form (e.g. `/contact`) and confirm it succeeds — if you get a
  "CSRF token" error here, the frontend's CSRF fetch is likely being
  blocked by a CORS/cookie misconfiguration; recheck `FRONTEND_URL` and
  `NODE_ENV` above.
- Visit `/account/register`, create a test customer account, and confirm
  you land on `/account` logged in.
- On `/account`, confirm you can edit your name/email under Profile settings
  and change your password under Change Password.
- Log out (customer and admin) and confirm you're actually returned to the
  login screen and can't reach the account page by navigating back.
- From `/account/login`, click "Forgot your password?", request a reset for
  your test account, and confirm the email actually arrives (this needs
  `RESEND_API_KEY` set — see `server/README.md`'s Email notifications
  section) and that the link lets you set a new password and log in with it.
- Add a testimonial and an FAQ entry via `/admin/testimonials` and
  `/admin/faq`, and confirm they show up on the homepage and `/faq`.

If any step fails, check Render's **Logs** tab first — most issues at this
stage are a missing/mistyped environment variable.

---

## 6. Ongoing deploys

Both Render and Vercel redeploy automatically on every push to `main`.
Prisma migrations run automatically on each backend deploy via
`prisma migrate deploy` in the start command — if you change
`schema.prisma` locally, run `npx prisma migrate dev --name <description>`
to generate the migration file, commit it, and push; Render applies it on
the next deploy.
