# Deploying Lycie Investments

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

This spin-down also means the scheduled jobs — the daily hire-reminder
emails, the daily 03:00 chat-log cleanup and Lycie's Monday 06:00 FAQ
analysis (see `server/README.md`) — won't fire if nobody's visited the site
around when they're scheduled to run. (The FAQ analysis can also be run any
time from the admin's **Lycie AI → FAQ suggestions** tab, and the log cleanup
just catches up on the next day it's awake.) To avoid the sleep (and the 30–60 s wake-up), follow "Keep the API awake"
below — free — or upgrade to Starter.

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
   definition from it. It asks you for `DATABASE_URL` — paste your Neon
   string (the blueprint deliberately does not create a Render database).

   If you'd rather set it up manually instead of using the blueprint:
   **New → Web Service** → select the repo → set:
   - **Root Directory:** `server`
   - **Build Command:** `npm install --include=dev && npx prisma generate && npm run build`
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
   | `TRUST_PROXY` | `1` — **required behind Render** (the blueprint sets it). Render sits behind one reverse proxy; without this, every visitor looks like the same IP and the per-visitor rate limits (login, forms, Lycie chat) would apply to everyone at once. Never set it when the API is exposed directly to the internet — clients could then fake their IP. |
   | `GEMINI_API_KEY` | Optional but recommended — powers the Lycie chat assistant. See "Lycie AI assistant" below. |
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

## 2b. Lycie AI assistant (Google Gemini, free)

Lycie is the chat assistant on every public page. She answers from your live
vehicles, hire fleet, FAQ, site content and the notes you add under
**Admin → Lycie AI → Knowledge**. She is read-only: she can't place orders,
change prices or see anyone's account.

**Setup**

1. Create a free key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
   (no card needed) and set it as `GEMINI_API_KEY` on Render.
2. That's all. Without a key the chat button hides itself and the rest of the
   site works normally.

**Optional tuning** (all have sensible defaults — see `server/.env.example`)

| Key | Default | Meaning |
| --- | --- | --- |
| `LYCIE_CHAT_MODELS` | `gemini-3.8-flash,gemini-3.1-flash-lite,gemini-3.5-flash` | Tried in order. If a model is over quota, overloaded or unavailable to your key it is skipped for a while and the next is used. Model names change over time — if answers start failing, check the Render logs for `Gemini model … failed (model not available to this key)` and update this list from Google's current model list. |
| `LYCIE_DAILY_LIMIT` | `300` | Maximum AI answers per day, so the free quota is never exhausted by one busy day. Past it, visitors see your contact details instead. |
| `LYCIE_HOURLY_LIMIT_PER_IP` | `40` | Per-visitor questions per hour (there is also a 10/minute burst limit). |
| `LYCIE_KNOWLEDGE_CHARS` | `12000` | How much of your knowledge notes go into each prompt. |
| `LYCIE_LOG_RETENTION_DAYS` | `90` | Chat logs and visitor messages are deleted after this many days. |
| `LYCIE_AUTO_SUGGEST` | `true` | Weekly Monday FAQ analysis (max 5 AI calls). `false` = only when you press the button. |

**Privacy — worth knowing before you go live.** On Google's free tier, text
sent to the model may be used by Google to improve its products. To limit
this, Lycie strips email addresses, phone numbers, long ID/card-style numbers
and "my name is …" introductions from every message *before* it is sent or
stored, and the chat window tells visitors not to share personal details. This
is best-effort, not a guarantee. If that isn't acceptable for your customers,
upgrade the Google project to a paid plan (which excludes your data from
training) or leave `GEMINI_API_KEY` unset. Consider adding a line about the
assistant to your privacy policy.

**Free-tier limits.** Google's quotas are per model, per day and per minute,
and can change. The model chain, the daily cap and the friendly fallback
message exist so visitors are never shown an error. Check the quota usage in
Google AI Studio occasionally.

**Rate limits are per server instance** (kept in memory). That is correct on
Render's free plan (one instance). If you ever scale to several instances,
move the limiter to Redis.

**Teaching Lycie / growing the FAQ.** Every question asked in the chat, plus
the anonymous "Ask us" form on `/faq`, is grouped by topic. Under **Lycie AI**:

- *Conversations & gaps* — questions she couldn't answer or that visitors
  marked 👎. Use "Add to knowledge" to teach her the answer.
- *FAQ suggestions* — the most-asked topics, with drafts Lycie wrote **only from
  your company data**. Approve to publish to `/faq` (and to Lycie herself),
  edit first, or reject. Drafts marked "Needs your input" mean your data didn't
  cover that topic — write the answer yourself. **Nothing is ever published
  without your approval.**
- *Visitor messages* — the questions and comments sent through the form.

---

## 2c. Keep the API awake (free) — UptimeRobot

Render's free plan sleeps after 15 minutes without traffic. A free monitor that
requests the API every 5 minutes keeps it awake, so visitors never hit the
cold start and the scheduled jobs (hire reminders, weekly FAQ analysis, log
cleanup) run on time.

1. Sign up at [uptimerobot.com](https://uptimerobot.com) (free plan).
2. **Add New Monitor**
   - **Monitor type:** HTTP(s)
   - **Friendly name:** `Lycie API`
   - **URL:** `https://<your-render-service>.onrender.com/api/health`
   - **Monitoring interval:** 5 minutes (the free plan's minimum — well inside
     Render's 15-minute limit)
   - Add your email as an alert contact so you're told if the API goes down.
3. Save. Within 5 minutes the monitor should show **Up**.

Notes:

- `/api/health` deliberately does **not** touch the database. Neon's free plan
  has a monthly compute-hours allowance, and it pauses the database when idle;
  pinging a database-backed URL would keep it awake around the clock and use up
  that allowance. Don't point the monitor at a URL that queries the database.
- Render's free plan includes enough instance-hours (750/month) to run one
  service continuously, so this fits within the free tier — but verify the
  current limits, and don't run more than one free service this way.
- The first request after a fresh deploy can still be slow while the app
  starts (about a minute); the monitor then keeps it warm.
- The database may still take about a second to "wake" on the first
  database-backed request after a quiet period. That is normal and short.
- Upgrading to Render **Starter** (~$7/month) removes the need for the monitor.

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
5. `vercel.json` (already in the repo) makes every page route (e.g. `/faq`,
   `/admin/login`) load the app when opened directly or refreshed — without it
   Vercel returns 404 for anything except the homepage.
6. Deploy. Vercel gives you a URL like `https://lycie-investment.vercel.app`
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
- Open the "Ask Lycie" button (bottom-right), ask "What vehicles do you
  have?", and confirm she answers with your real vehicles. If the button is
  missing, `GEMINI_API_KEY` isn't set (or `/api/lycie/status` returns
  `{"enabled":false}`). If she replies with your phone number/email instead of
  an answer, check the Render logs for `Gemini model … failed`.
- Add a note under **Admin → Lycie AI → Knowledge**, ask her about it, and
  confirm it's used in her next answer.
- Submit a comment via the "Ask us" form at the bottom of `/faq` and confirm it
  appears under **Lycie AI → Visitor messages**.
- Submit a review on a vehicle page, approve it in `/admin/reviews`, and check
  it appears publicly and in `/admin/insights`.

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

---

## Image storage without a card (private bucket via Backblaze B2)

Public buckets on some providers need a payment card. A **private** bucket is
free, and the API can serve the images itself:

1. In Backblaze B2, create a bucket with **Files in Bucket: Private**, note its
   endpoint (`s3.<region>.backblazeb2.com`), and create an Application Key
   restricted to that bucket with Read and Write access.
2. In Render → Environment set: `S3_BUCKET` (bucket name), `S3_REGION` (the
   region in the endpoint, e.g. `us-west-004`), `S3_ENDPOINT`
   (`https://s3.<region>.backblazeb2.com`), `S3_ACCESS_KEY_ID` (keyID),
   `S3_SECRET_ACCESS_KEY` (applicationKey), `S3_FORCE_PATH_STYLE=true`, and
   **`S3_PRIVATE_BUCKET=true`**. Leave `S3_PUBLIC_URL_BASE` empty.
3. Upload a photo in `/admin`; its address will look like
   `https://<your-api>/api/media/<id>.webp`.

Images then travel bucket → API → visitor, cached by browsers for a year.
Keep the API awake (section 2c) so photos don't wait for a cold start.
