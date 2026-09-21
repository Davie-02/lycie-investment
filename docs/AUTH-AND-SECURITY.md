# Sign-in, sessions and security

Everything about how people (customers and admins) prove who they are, how that
stays working on every browser and device, and what protects the accounts.

## The two kinds of account

| | Customers | Admins |
| --- | --- | --- |
| Table | `CustomerUser` | `AdminUser` |
| Sign-in page | `/account/login`, `/account/register` | `/admin/login` |
| API | `/api/customers/*` | `/api/auth/*` |
| Cookie | `lycie_customer_session` | `lycie_admin_session` |
| Roles | `CUSTOMER` | `OWNER`, `MANAGER`, `VIEWER` |
| Extras | Google/Facebook sign-in, email confirmation | Optional two-step verification (authenticator app) |

They are completely separate systems so an admin session and a customer session can
never be confused, even in the same browser.

## What a "session" is

Signing in produces a **signed token** (a JWT) that says who you are and your role.
The API accepts that token in either of two ways:

1. **A cookie** the API sets (`HttpOnly`, so page scripts can never read it). This is
   the normal, safest way.
2. **An `Authorization: Bearer <token>` header** — the automatic fallback below.

Code: `server/src/auth/session.service.ts` (creates tokens), `jwt-auth.guard.ts` (checks
them), `session-cookie.ts` (cookie settings and lifetimes).

## Why logins used to fail on some phones, and the fix

The website (`*.vercel.app`) and the API (`*.onrender.com`) are different domains, so
the browser treats the session cookie as a **third-party cookie**. Safari, Firefox in
strict mode, many in-app browsers, and Chrome in some privacy modes refuse those. Login
looked successful, then every request behaved as logged-out. The old CSRF cookie failed
the same way ("A valid CSRF token is required").

Two independent fixes are in place:

### 1. Cookie-free fallback (automatic, needs no setup)

`src/services/sessionToken.ts`. Right after a successful sign-in the browser asks the
API "who am I?" using **only** the cookie (`GET /customers/session` or `/auth/session`):

- **Answer: you're signed in** → cookies work; nothing else is stored.
- **Answer: 401** → this browser blocked the cookie. The token the API also returned in
  the sign-in response is kept (`localStorage` if "Keep me signed in" was ticked,
  otherwise `sessionStorage`) and every request from then on carries it in an
  `Authorization` header (`authHeader()` is added by `http.ts`, `customer.service.ts`
  and `adminApi.ts`).

Trade-off: a token held by page scripts could be stolen by malicious script, so it is
used only when cookies demonstrably do not work.

### 2. Stateless CSRF tokens

`server/src/auth/csrf.ts`. CSRF protection needs a secret the attacker's page can't
obtain. It used to be "cookie must equal header", which needs the (blocked) cookie.
Now the token is **signed**: `nonce.expiry.HMAC(JWT_SECRET)`. The API just checks the
signature — no cookie involved. Requests using a Bearer header skip CSRF (a forged
cross-site request cannot set that header).

### Same-domain API (enabled)

The production site now talks to the API through **its own address**, so the session
cookie is first-party and works in every browser; the token fallback above stays as a
safety net for anything unusual.

How it is wired:

- `vercel.json` forwards `/api/*` and `/uploads/*` on the website to
  `https://lycie-investment-api.onrender.com` (before the catch-all page rule).
- `vite.config.ts`: when building on Vercel, `VITE_API_BASE_URL` becomes `/api`
  automatically — no Vercel dashboard change needed. Set **`VITE_DIRECT_API=true`** in
  Vercel to switch back to calling the API's own address.
- Two long-lived anonymous streams (live updates, Lycie's typing answers) deliberately
  still call the API directly (`VITE_STREAM_BASE_URL`, set by the same build step).
- `render.yaml` sets `TRUST_PROXY=2`: requests now pass through Vercel *and* Render, and
  the API must skip both proxies to see each visitor's real address. With `1`, every
  visitor would look like Vercel's servers and the per-visitor rate limits (login,
  forms, chat) would throttle everyone together. **If you switch the same-domain setup
  off, set it back to `1`.**
- Trade-off worth knowing: with two trusted proxies, someone who calls the API's Render
  address directly (not through your site) can forge their address and slip past the
  per-IP rate limits. Account lockout (5 wrong passwords), strong passwords and optional
  two-step verification still protect sign-in.
- If the API's Render address ever changes, update the two destinations in `vercel.json`.

Check it works: open `https://<your-site>/api/health` — it should answer
`{"status":"ok"}` from your own domain. After signing in, browser dev tools →
Application → Cookies should list `lycie_customer_session` (or `lycie_admin_session`)
under **your site's** domain, and `localStorage` should have no `lycie_*_token`.

## "Keep me signed in"

A checkbox on every sign-in page.

| | Not ticked | Ticked |
| --- | --- | --- |
| Session length | 2 hours (`JWT_EXPIRES_IN`) | 30 days (`REMEMBER_ME_EXPIRES_IN`) |
| Cookie | browser-session cookie (gone when the browser closes) | persistent cookie |
| Idle auto-logout | customers 30 min, admins 5 min | off (only meant for a personal device) |

The choice is stored with the token (`remember` claim) so re-issued sessions (after a
password change) keep the same length. Frontend flag: `lycie_customer_remember` /
`lycie_admin_remember` in `localStorage`.

## Passwords

**Rules** (`server/src/security/password-policy.ts`, mirrored for live feedback in
`src/utils/password.ts`): at least 10 characters, at most 72, a lowercase letter, an
uppercase letter, a number, not a common password (even disguised as `Password123!`),
and not containing the person's own name or email. Enforced on the **server** at
sign-up, reset, change-password and admin-account creation. **Not** enforced at
sign-in, so people with older, shorter passwords can still get in.

**What people see** (`components/forms/NewPasswordField.tsx`): a strength meter, a
checklist that ticks off as they type, and **Suggest a strong password** (16 random
characters from the browser's cryptographic generator; fills the confirm box too;
reveals it and offers Copy).

**Show / hide:** every `type="password"` input rendered through `FormField` gets an eye
button automatically (`FormField.tsx`).

**Save-password prompts:** forms use `name`, `autocomplete="username"`,
`current-password` and `new-password` (plus Safari's `passwordrules`) so browser and
phone password managers offer to generate/save/update. After sign-in, sign-up and
password change `utils/credentials.ts` also asks Chromium browsers to show the save
prompt (single-page sites otherwise sometimes skip it).

**Storage:** bcrypt, 12 rounds; hashes never leave the API.

## Email checks

- **Browser** (`src/utils/email.ts`, `EmailField.tsx`): proper format check, and a
  "Did you mean gmail.com?" hint for typos of common providers.
- **API** (`server/src/security/email-check.ts`): the address's domain must exist and
  accept mail (MX/A record lookup, cached 10 min; if DNS itself is down the check
  *passes* so a network hiccup never blocks a real customer) and must not be a
  throwaway-inbox domain. Applied at sign-up, profile email change, and on the public
  forms (contact, inquiry, import, clearing, hire).
- **Confirmation email** after sign-up (`/account/verify-email?token=…`). Unconfirmed
  customers can still use the site; a banner on their account page offers to resend.
  Google/Facebook sign-ups count as confirmed.

## Protection against guessing and misuse

| Protection | Where | Detail |
| --- | --- | --- |
| Rate limits | `@Throttle` on login/register/reset routes | 5 tries/minute/IP (10 for 2FA and social) |
| Account lockout | `security/lockout.ts` | 5 wrong passwords → locked 15 minutes; a password reset unlocks |
| No account enumeration | `auth.service.ts`, `customers.service.ts` | same "Invalid email or password" for every failure; unknown emails still cost a bcrypt compare so timing doesn't leak; reset requests always answer the same |
| Sessions re-checked | `SessionService.assertStillValid` | deactivated accounts and tokens older than the last password change are refused (cached ≤15 s) |
| Change/reset password | | signs out every other device, unlocks the account, emails a notice |
| Secure cookies | `session-cookie.ts` | `HttpOnly`, `Secure` in production, `SameSite=None` (or `lax` with same-domain setup) |
| Security headers | `main.ts` (helmet), `vercel.json` | |
| Input validation | global `ValidationPipe` | unknown fields rejected |

## Two-step verification (admins)

Admin → **My Security**. An authenticator app (Google/Microsoft Authenticator, Authy,
1Password…) supplies a 6-digit code that changes every 30 seconds
(`server/src/security/totp.ts`, standard RFC 6238, verified against the RFC's published
test vectors).

- **Set up:** *Set up two-step verification* → scan the QR code (drawn in the browser;
  the secret never goes to a QR service) → type a code → save the 8 one-time **recovery
  codes** shown once.
- **Sign in:** password → then the code (or a recovery code, each usable once). Between
  the two steps the browser holds a 5-minute *challenge* token which **cannot** be used
  as a login (`JwtAuthGuard` only accepts real session roles).
- **Turn off:** needs the password *and* a current code.
- **Lost phone:** use a recovery code, or an Owner opens **Admin Users → Edit** and ticks
  *Reset their two-step verification*.

## Sign in with Google / Facebook (customers)

Buttons appear on `/account/login` and `/account/register` **only when configured**;
until then the site behaves exactly as before. The API tells the page what is set up
(`GET /api/auth/providers`).

How it stays safe: the browser gets a signed proof from Google/Facebook and sends it
to us; the API verifies it itself (`server/src/auth/social-identity.ts`) — Google's ID
token signature against Google's published keys, that it was issued **to this website**,
and not expired; Facebook's token against Facebook's Graph API. Then
`CustomersService.signInWithIdentity`:

1. account already linked to that provider id → sign in;
2. else account with the same email → link it, **only if the provider confirms the email**;
3. else create an account (random unusable password; can set one via *Forgot password*).

### Set up Google

1. <https://console.cloud.google.com> → create/select a project → *APIs & Services* →
   *OAuth consent screen* (External; add your logo, name, support email).
2. *Credentials* → *Create credentials* → *OAuth client ID* → type **Web application**.
3. *Authorised JavaScript origins*: your site (`https://your-site.vercel.app`, and your
   custom domain if any; `http://localhost:5173` for local testing). No redirect URI needed.
4. Copy the **Client ID** into Render as `GOOGLE_CLIENT_ID`, redeploy. Done — the
   "Continue with Google" button appears.
5. Before launch, click *Publish app* on the consent screen so anyone (not just test
   users) can sign in.

### Set up Facebook

1. <https://developers.facebook.com> → *Create app* (type "Consumer"/"Authenticate") →
   add the **Facebook Login** product.
2. *Settings → Basic*: copy **App ID** and **App Secret**; add your site domain to *App
   domains*, plus a privacy-policy URL.
3. In Render set `FACEBOOK_APP_ID` and `FACEBOOK_APP_SECRET`, redeploy.
4. Switch the app from *Development* to *Live* when ready.

> Not implemented: Apple and Microsoft sign-in (Apple needs a paid developer account).
> They would slot in next to Google/Facebook in `social-identity.ts` and
> `SocialSignIn.tsx`.

## Environment variables (auth-related)

| Variable | Default | Purpose |
| --- | --- | --- |
| `JWT_SECRET` | *(required)* | signs sessions **and** CSRF tokens; changing it signs everyone out |
| `JWT_EXPIRES_IN` | `2h` | normal session length |
| `REMEMBER_ME_EXPIRES_IN` | `30d` | "Keep me signed in" length |
| `COOKIE_SAMESITE` | `none` in production, `lax` in dev | optional; the default works for the same-domain setup too |
| `FRONTEND_URL` | `http://localhost:5173` | the only origin CORS allows; used in email links |
| `TRUST_PROXY` | `2` on Render | number of proxies in front of the API (Vercel + Render); see above |
| `VITE_DIRECT_API` (Vercel) | unset | `true` = call the API directly instead of through the site's domain |
| `GOOGLE_CLIENT_ID` | unset | enables Google button |
| `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET` | unset | enables Facebook button |
| `EMAIL_*`, `RESEND_API_KEY` / `BREVO_API_KEY` | unset | confirmation and reset emails (see DEPLOYMENT.md) |

## Troubleshooting

| Symptom | Likely cause → fix |
| --- | --- |
| Sign-in "works" but every page acts logged out | Browser blocks cross-site cookies **and** the fallback can't store a token (storage blocked, e.g. private mode). Use a normal window, or set up the same-domain option above. Check `NODE_ENV=production` on Render |
| "A valid CSRF token is required" | Token expired (2 h) or `JWT_SECRET` changed. The site retries once automatically; a refresh always fixes it. If constant: check `VITE_API_BASE_URL` points at the API and `FRONTEND_URL` matches the site exactly (no trailing slash) |
| CORS error in the browser console | `FRONTEND_URL` on Render doesn't exactly match the site's address |
| "Too many failed sign-in attempts…" | Lockout: wait 15 minutes, or reset the password (which unlocks) |
| Confirmation/reset emails never arrive | Email provider not configured — Admin → Contact tools shows status; see DEPLOYMENT.md §2d. Check spam |
| No Google/Facebook button | `GOOGLE_CLIENT_ID` (etc.) not set on Render, or the site's address is not in the provider's authorised origins. Open `/api/auth/providers` — it should list the provider |
| Google says "origin not allowed" | Add the exact site address to *Authorised JavaScript origins* |
| Admin locked out of 2FA | Recovery code, or an Owner resets it in Admin Users |
| Everyone got signed out after a deploy | `JWT_SECRET` regenerated (Render `generateValue`) — set a fixed value |
| Sessions end unexpectedly | Password was changed (signs out other devices), account deactivated, or session length reached |
