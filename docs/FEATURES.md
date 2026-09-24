# Features: how each works, where it's wired, how to fix it

For every feature: **What it does**, **Where the code is** (frontend → API → database),
and **If it breaks** (the fastest checks first). File paths are relative to the
repository root. See [ARCHITECTURE.md](ARCHITECTURE.md) for the overall map and
[AUTH-AND-SECURITY.md](AUTH-AND-SECURITY.md) for sign-in.

First checks for *any* problem: open the browser's developer tools (F12) →
**Console** (red errors) and **Network** (find the failing `/api/...` request and read
its response — the API's messages are written to be human-readable).
`https://<your-api>/api/health` should answer `{"status":"ok"}`.

---

## 1. Editable site text ("Site Content")

**What:** almost all wording — hero, services, journey, contact details, footer,
page headings, about/company story, team, clients, fleet, SEO — is edited in
**Admin → Site Content** and goes live at once.

**Where:** admin editor `src/admin/pages/AdminSiteContent.tsx` (one form per section) →
`PATCH /api/site-content/:key` (`server/src/site-content/`) → table `SiteContent`
(one JSON row per key). The public site reads `GET /api/site-content` in
`src/context/SiteContentContext.tsx`, merged over defaults in `src/config/siteConfig.ts`;
components call `useSiteContent()`.

Sections: `hero`, `services`, `journey`, `whyChooseUs`, `importPage`, `clearingPage`,
`hirePage`, `contact` (phone, email, address, hours, WhatsApp, **map location**),
`footer`, `pageHeadings`, `homeSections`, `social`, `about`, `company`, `team`,
`clients`, `fleet`, `seo`.

**If it breaks:** an edit doesn't show → hard-refresh, then check the Network tab for the
`PATCH` (401 = signed out, 403 = your role can't edit content). A section looks empty →
it falls back to `siteConfig.ts` defaults; save it once in the admin. *Load company
profile* (Owner) refills the company sections.

---

## 2. Vehicles for sale

**What:** listing with search + filters, a detail page with a photo gallery, status
(available/reserved/sold), price, specs, features, like and save buttons.

**Where:** pages `src/pages/Vehicles/`, `src/pages/VehicleDetails/`; card
`src/components/vehicles/VehicleCard.tsx`; filters `VehicleFiltersPanel.tsx` +
`src/utils/vehicleFilters.ts`; data via `src/services/vehicles.service.ts` →
`/api/vehicles` (`server/src/vehicles/`) → table `Vehicle` (`images` is a list of URLs).
Admin: `AdminVehicles.tsx` + `VehicleForm.tsx` (uses `ImageUploader`).

**If it breaks:** empty list → the API returned nothing published (check Admin → Vehicles
that items are *Published*, not *Archived*). Wrong prices → `currency`/`price` on the
record. Filter oddities → `vehicleFilters.ts`.

---

## 3. Photo sliders (vehicles and hire vehicles)

**What:** wherever an item has several photos, visitors can **swipe** (phones), use
**arrows / dots / ← → keys** (desktop), or tap **thumbnails** (vehicle page). One photo
shows plainly. This is separate from the homepage's auto-playing crossfade carousel.

**Where:** `src/components/common/ImageSlider.tsx` + `ImageSlider.css`, used by
`VehicleCard`, `HireVehicleCard` and `VehicleGallery` (its thumbnails stay in sync). Built
on native scrolling with snap points, so it is smooth on low-end phones. Photos come
from `Vehicle.images[]` and `HireVehicle.images[]`.

**Hire vehicle photos:** `HireVehicle` keeps `image` (cover, always the first) and `images`
(gallery); `server/src/hire-vehicles/hire-vehicles.service.ts` keeps them in step. In
Admin → Hire Vehicles, upload several photos; the first is the cover.

**If it breaks:** slider not appearing → the record has only one photo (add more in the
admin). Photos not loading → see "Images" below. Dots but no movement → check console for
errors from `ImageSlider`.

---

## 4. Hire vehicles and hire requests

**What:** customers browse hire vehicles, pick dates, get a price estimate, submit a
request; admins confirm/cancel bookings; confirmation and reminder emails go out.

**Where:** `src/pages/Hire/Hire.tsx`, `HireVehicleCard.tsx`, `src/components/forms/HireRequestForm.tsx`,
price maths `src/utils/hirePricing.ts` (mirrored on the server in `server/src/hire-requests/`).
API `/api/hire-vehicles`, `/api/hire-requests`; tables `HireVehicle`, `HireRequest`.
Admin: `AdminHireVehicles.tsx`, `AdminBookings.tsx`, `AdminBookingDetail.tsx`.
A daily job sends due/overdue reminders (`@Cron` in the hire-requests module).

**If it breaks:** wrong total → the daily/weekly rate on the vehicle; the server
recomputes the price and is the authority. No emails → see §16.

---

## 5. Import, clearing, inquiry and contact forms

**What:** four public forms. Each is validated in the browser and again on the API, saved
for admins under **Submitted Requests**, and emails the team. If the visitor is signed in,
the request is linked to their account.

**Where:** `src/components/forms/*Form.tsx` → `src/services/*.service.ts` → `/api/import-requests`,
`/api/clearing-requests`, `/api/inquiries`, `/api/contact-messages` → tables `ImportRequest`,
`ClearingRequest`, `Inquiry`, `ContactMessage`. Rules live in `server/src/*/dto/*.dto.ts`.
The email field is also checked for deliverability (`@IsDeliverableEmail`).

**If it breaks:** "doesn't look deliverable" → the email's domain has no mail server
(typo); real cause is visible in the message. Nothing arrives in admin → check the Network
tab for the POST; 400 = a field failed validation, the response says which; 429 = too
many submissions from one IP (wait a minute).

---

## 6. Contact details, map and footer

**What:** email addresses open the mail app, phone numbers dial (several numbers are
supported), addresses open Google Maps, WhatsApp opens a chat. The Contact page shows an
interactive map with **Open in Google Maps** and **Get directions**. The footer copyright
is centered. All of it (phones, email, address, hours, WhatsApp, map location, footer
text) is edited in **Admin → Site Content**.

**Where:** links are built in `src/utils/contactLinks.ts` (`telUrl`, `mailtoLink`,
`whatsappUrl`, `mapsSearchUrl`, `mapsDirectionsUrl`, `mapsEmbedUrl`) and used by
`components/layout/Footer.tsx`, `pages/Contact/Contact.tsx`,
`components/company/ContactCards.tsx`, `PhoneLinks.tsx`. The map is
`components/company/MapEmbed.tsx` (Google's keyless embed, so no API key or billing).
Data: `SiteContent` key `contact` (`mapQuery`) and `footer`.

**Map location:** *Map location* in Site Content accepts an address, a place name
("Lilongwe City Mall") or coordinates (`-13.9626, 33.7741`). Blank uses the address.
Clear both to hide the map. **Tip:** coordinates are the most exact — right-click a
spot in Google Maps and click the numbers to copy them.

**If it breaks:** a number isn't clickable → it must be a real number (7+ digits);
placeholder text like "Contact our team" stays plain by design. Map shows the wrong place
→ set *Map location* precisely. Map blank → the browser or an ad-blocker blocks
`google.com/maps`; the two links below it still work.

---

## 7. Images (uploads, storage, responsive sizes)

**What:** admins upload photos; the API converts them to WebP in three sizes
(480/960/full) so phones download small files. Storage is local disk in development and an
S3-compatible bucket (Backblaze B2 / Cloudflare R2) in production, public or private.

**Where:** `src/admin/components/ImageUploader.tsx` → `POST /api/uploads`
(`server/src/uploads/`, `sharp` does the conversion). Display: `src/components/common/Img.tsx`
picks the right size (`srcset`) and falls back to the original if a size is missing;
`src/utils/resolveUploadUrl.ts` turns stored paths into full URLs. Private buckets are
served through `/api/media/<file>`.

**If it breaks:** photos vanish after a redeploy → production is still on local disk;
configure `S3_*` (DEPLOYMENT.md "Image storage"). Broken images on the live site only →
`S3_PRIVATE_BUCKET` / `S3_PUBLIC_URL_BASE` mismatch; open the image URL directly to see
the error.

---

## 8. Customer accounts

**What:** sign up / sign in (email, or Google/Facebook), confirm email, forgot/reset/change
password, edit profile, balance and transaction history, submit payment proofs, saved
vehicles, "My requests", vehicle updates from staff, Messages inbox.

**Where:** pages `src/pages/Customer/*`, state `src/context/CustomerAuthContext.tsx`, API
client `src/services/customer.service.ts`, API `/api/customers/*`, `/api/financial/me`
(`server/src/customers/`, `server/src/financial/`). Details in AUTH-AND-SECURITY.md.

**If it breaks:** see the troubleshooting table in AUTH-AND-SECURITY.md.

---

## 9. Payments (proof-of-payment ledger)

**What:** customers upload proof of a payment; staff approve/reject; approval credits the
customer's balance. No card/bank integration (by design).

**Where:** `CustomerAccount.tsx` (submit) → `POST /api/financial/me/payment-submissions`;
`src/admin/pages/AdminPayments.tsx` → `/api/financial/payments/:id/approve|reject`;
tables `PaymentSubmission`, `FinancialTransaction`, `Account`. Approval runs in a
Serializable database transaction so it can't double-credit.

**If it breaks:** a payment "stuck pending" → an Owner/Manager must review it in Admin →
Payments.

---

## 10. Reviews, sentiment and insights

**What:** visitors review the company or a vehicle; admins moderate; sentiment is scored and
the Insights page shows demand and recommendations.

**Where:** `src/components/reviews/`, `src/pages/Reviews/`; `/api/reviews`, `/api/insights`
(`server/src/reviews/`, `server/src/insights/`); `AdminReviews.tsx`, `AdminInsights.tsx`.

---

## 11. Lycie (AI assistant) and the self-improving FAQ

**What:** a chat widget on every public page. Answers come only from your live vehicles,
hire fleet, FAQ, site content, knowledge notes and uploaded documents. Personal details
are stripped before anything is sent or saved. Popular questions become **draft** FAQ
entries an admin approves.

**Where:** widget `src/components/lycie/`; API `/api/lycie/*` (`server/src/lycie/`); Google
Gemini through `gemini.client.ts` (tries several models, remembers rate limits); admin
`AdminLycie.tsx` (knowledge, documents, drafts, testimonial ideas, analytics). Env:
`GEMINI_API_KEY` and the `LYCIE_*` limits.

**If it breaks:** widget hidden → `GEMINI_API_KEY` missing (by design). "Busy" answers →
Gemini free-tier limit; she falls back to your contact details. Wrong facts → add or fix
knowledge in Admin → Lycie AI.

---

## 12. Notices, blog, FAQ, testimonials

**What:** site-wide banners/popups, blog posts, FAQ entries, testimonials — all managed in the
admin, all supporting publish / unpublish / archive / duplicate / bulk actions and instant
updates.

**Where:** `AdminNotices.tsx`, `AdminBlogPosts.tsx`, `AdminFaq.tsx`, `AdminTestimonials.tsx`;
shared list UI `src/admin/components/ContentManager.tsx`; API `/api/notices`, `/api/blog-posts`,
`/api/faq`, `/api/testimonials`, `/api/content-admin/*`. "What is public?" is decided in one
place: `server/src/content-admin/content-state.ts`.

**If it breaks:** a published item not visible → it may be scheduled/archived; check its state
in the admin list.

---

## 13. Likes and saved vehicles

**What:** anyone can like vehicles, hire vehicles and posts (no sign-in); signed-in customers
also save vehicles. Anonymous likes use a random visitor id in the browser's local storage.

**Where:** `src/context/LikesContext.tsx`, `components/common/LikeButton.tsx` → `/api/likes`;
`SavedVehiclesContext.tsx` → `/api/customers/me/saved-vehicles`.

---

## 14. Live updates

**What:** edits appear on visitors' open pages without a reload.

**Where:** `server/src/events/` (stream + which topics an edit touches) ↔
`src/services/liveContent.ts` (`subscribeLive([...topics], callback)`).

**If it breaks:** pages update only after reload → the stream is buffered or blocked by a
proxy; the site still works. Check `/api/events` stays open in the Network tab.

---

## 15. Admin dashboard extras

**What:** *Needs your attention* panel, global search (Ctrl/⌘ K), CSV export, activity log,
AI writing assistant, customer messaging (WhatsApp / call / email / in-app), Admin Users,
**My Security** (change password, two-step verification).

**Where:** `src/admin/`; API `/api/admin-tools/*`, `/api/contact-admin/*`, `/api/admin-users`,
`/api/auth/*`. Roles gate each route (`@Roles(...)`) and each page (`RequireRole`).

---

## 16. Email

**What:** password resets, email confirmation, hire confirmations/reminders, admin
notifications, replies to customers.

**Where:** `server/src/email/` (`email.service.ts` sends via Resend or Brevo over HTTPS;
`email-templates.ts` holds the wording). Configure `RESEND_API_KEY` or `BREVO_API_KEY`,
`EMAIL_FROM`, `EMAIL_REPLY_TO`, `ADMIN_NOTIFICATION_EMAIL`. Admin → Contact tools shows the
provider status and can send a test email.

**If it breaks:** nothing sends → no provider key (the API logs a warning and carries on).
Sends but not delivered → the sending address/domain isn't verified with the provider.

---

## 17. Search engines and social sharing

**What:** every public page can be found by Google/Bing and looks good when shared on WhatsApp,
Facebook, X or LinkedIn: a proper title and description, a preview picture, a canonical address,
structured data (so Google can show a car's price and a business's phone/address), a sitemap and a
robots.txt. Visitors can also share vehicles and posts with one tap.

**Why it needed special handling:** the site is a single-page app, so its own HTML is nearly empty until
JavaScript runs. Social networks and some search bots never run it and would see the same generic page
for every address. So:

1. `server/src/seo/` builds a complete HTML page for every public address (vehicles, blog posts, FAQ…)
   from the live database — `GET /api/seo/render?path=/vehicles/toyota-hilux-2022`.
2. `vercel.json` sends **only crawler user-agents** (Googlebot, Bing, Facebook, WhatsApp, X, LinkedIn,
   Telegram…) to that page. Real visitors always get the normal site. `/sitemap.xml` and `/robots.txt`
   are served from the API too, so the sitemap always lists the vehicles and posts that are live today.
3. In the browser `src/components/common/Seo.tsx` keeps the same tags up to date as visitors navigate
   (also used by Google's JavaScript-running crawler), and `src/utils/structuredData.ts` adds the JSON-LD.

**Managed in the CMS:** Site Content → SEO: site name, default description, sharing picture, X handle,
Google Search Console and Bing verification codes. Vehicle pages use their first photo; blog posts their
cover; private pages (sign-in, account) are marked `noindex`.

**Get listed (one-time, ~10 minutes):**
1. Set `SITE_URL` on Render to your website address, redeploy.
2. Google Search Console → Add property → URL prefix → choose the *HTML tag* method → paste the code into
   Site Content → SEO → "Google Search Console verification code" → Save → click Verify in Google.
3. In Search Console → Sitemaps → submit `sitemap.xml`. Repeat with Bing Webmaster Tools (you can import
   the site from Google in one click).
4. Add your Facebook Page / Instagram / X links in Site Content → Social Links (they feed the business
   structured data). Put the site address in each profile's "website" field.
5. Test a share: paste a vehicle link into WhatsApp or <https://developers.facebook.com/tools/debug/>.

**If it breaks:** a share shows the wrong picture → Facebook caches; use the Sharing Debugger's "Scrape
again". A page isn't in Google → Search Console → URL Inspection → "Request indexing". Check what crawlers
see with `curl -A Googlebot https://<site>/vehicles/<slug>` (should show the vehicle's title). If that shows
the generic page, the `vercel.json` rewrites or `SITE_URL` aren't in place.

---

## 18. Responsive layout

**What:** the design adapts from 320 px phones to wide desktops.
**How:** mobile-first CSS (`@media (min-width: …)`), CSS variables for spacing/sizing,
`minmax(0, 1fr)` grids so nothing forces the page wider than the screen, wrapping headings
and contact details, tables scroll inside their own box, images use `srcset`.
**Checked at:** 320, 375, 414, 768, 1024 and 1440 px across all public pages and the login
screens (no sideways scrolling anywhere).
**If a page scrolls sideways on a phone:** in dev tools' device mode, find the element that
sticks out (the box that ends past the right edge); usually a grid using plain `1fr`
columns, a long unbroken word (`overflow-wrap: anywhere`), or a fixed width.


---

## 19. Prices in US dollars, with the kwacha equivalent

**What:** every vehicle and hire price is stored and shown in **US dollars**, with the Malawi kwacha
equivalent beside it ("$26,000 ≈ MWK 45,500,000") at the current exchange rate. Older listings entered in
kwacha display correctly too (converted with the same rate) until they're edited or bulk-converted.

**Where:** rate logic `server/src/pricing/` — `rate-providers.ts` (two free public sources, tried in
order, sanity-checked), `pricing.service.ts` (30-minute cache, remembered in the database, manual override,
margin, rounding, the bulk converter). Public endpoint `GET /api/pricing`. Browser: `PricingContext.tsx`
(refreshes every 10 minutes and instantly when an admin changes settings), `utils/price.ts`, and the
`<Price>` component used by every card, page and table. Lycie quotes the same format
(`pricing/price-format.ts`).

**Managed in the CMS:** Site Content → Currency & Prices — automatic (live rate) or manual rate, a margin %
(when the everyday market rate is higher than the published one), rounding ("nearest 1,000"), a "refresh now"
button, and (Owner) "Convert kwacha listings to USD" for old data. Vehicle and hire forms take USD and show
the kwacha equivalent as you type.

**Honest limits:** the free rate sources publish about once a day, so "live" means "as fresh as the
published rate". For the everyday Malawi rate set a manual rate or a margin. The customer money ledger
(balances, payment proofs) deliberately stays in kwacha.

**If it breaks:** no kwacha shown → no rate yet; set a manual rate, or check the API can reach the internet.
A price looks 10× off → the listing's currency field: edit and save it in USD. Rate not updating → admin
"Refresh live rate now" shows the source and time.

---

## 20. Themes

**What:** four looks — Classic (the original), Ocean, Warm and Dark. Every theme keeps the brand navy and
sky blue, the logo, and the header/footer/button colours; only page and card tones change (in Dark the logo
sits on a white chip, text-navy becomes light blue). Visitors get a sun/moon switch in the header, remembered
per device; an admin can hide it or make dark mode follow the visitor's device setting. The admin
dashboard always stays Classic.

**Where:** colours are variables in `src/styles/variables.css` (`:root[data-theme="…"]` blocks);
`--color-ink` is the brand navy used as *text*, `--color-primary` the brand navy used as *background* (never
changes). `context/ThemeContext.tsx` picks the theme (`utils/theme.ts`), `components/layout/ThemeToggle.tsx`
is the switch, and a tiny script in `index.html` applies the theme before the page paints (no flash).

**Managed in the CMS:** Site Content → Theme.

**Adding a theme:** add a `:root[data-theme="name"]` block overriding the surface tokens, add the name to
`THEME_NAMES`/`THEME_LABELS` in `utils/theme.ts` and a swatch in `ThemeSettings.tsx`.

**If a component looks wrong in a theme:** it is probably using a hard-coded colour; replace it with a token
(`--color-surface`, `--color-tint`, `--color-ink`…).

---

## 21. Deals finder and market recommendations (admin only)

**What:** Admin → **Deals & Market**.
- **Deals:** "Search the internet for deals" asks the AI (with live Google Search) for current promotions and
  bargains on vehicles that suit the Malawian market and saves them as *To review*. You edit the wording,
  then **Publish** or **Dismiss**. Nothing publishes itself. Each deal keeps staff-only notes — *how to get
  it* and *where it was found* — that visitors never see; the public sees only title, description, price,
  end date. Deals can also be added by hand. Published deals appear on the homepage, a `/deals` page and a
  "Deals" menu link (only while one exists).
- **What customers want:** a ranking built from your own numbers (import requests, inquiries, saves, likes,
  views over 90 days), with a plain-language next step for each ("customers keep asking, none in stock —
  source some").
- **Market briefing:** an AI-researched summary of what's selling in Malawi/Southern Africa, opportunities,
  and ways to stand out from other importers, blended with your demand numbers.

**Where:** `server/src/deals/` (parser that scrubs web addresses/attributions from customer text, service,
weekly job — Mondays 7am unless `DEALS_AUTO_SCAN=false`), `server/src/market/` (`demand.ts` scoring,
briefing), `lycie/gemini.client.ts` (search grounding), `src/admin/pages/AdminDeals.tsx`, public
`pages/Deals/` and `components/deals/`. Tables `Deal`, `MarketReport`. Needs `GEMINI_API_KEY`.

**How the research works (and what your Google plan needs):** the finder tries Google's live web search first.
That feature is **not included in Google's free AI tier** (Google answers "quota exceeded"), so on a free key it
falls back to recent news headlines, which are often too thin to yield real deals — it will tell you so rather
than invent anything. **For real deal discovery, enable billing on your Google AI (Gemini) project**
(<https://aistudio.google.com> → your project → set up billing); search then works automatically, with a daily
free allowance. The market briefing still works without it, labelled "based on the AI's general knowledge".
Code: `server/src/research/research.service.ts` (search → headlines → knowledge). `GEMINI_SEARCH_GROUNDING=false`
skips the search attempt.

**Important:** AI-found deals are **unverified** — confirm price, dates and availability with the seller before
publishing. Searches are capped (`DEALS_DAILY_SCANS`, default 6/day) to protect the free AI quota.

**If it breaks:** "AI search isn't set up" → `GEMINI_API_KEY`. "Busy" → Gemini overload; retry in a few
minutes. A deal shows a source publicly → it can't via the API (`toPublicDeal` whitelists fields, tested); check
the summary text you typed yourself.

---

## 22. Social media desk (admin only)

**What:** Admin → **Social Media**. Write a post (the AI can draft it), attach a picture and link, choose
Facebook and/or Instagram, then **Post now**, **Schedule** or **Save draft**. A retry re-sends only the page that
failed, never one that already worked. The **Comments & messages** tab shows what people wrote on your posts and
their private Facebook messages, with a reply box on each. Published deals have a "Post to social media"
shortcut.

**Where:** `server/src/social/` — `meta.client.ts` (Meta Graph API: posting, comments, Messenger, replies),
`social.service.ts` (drafts, scheduling, retries, inbox), `social.cron.ts` (sends due posts every 5 minutes);
`src/admin/pages/AdminSocial.tsx`. Table `SocialPost`.

**Set up (Facebook + Instagram):** see DEPLOYMENT.md → "Social media". Without the three `META_*` variables the
page shows "not connected" and you can still write drafts.

**Limits to know:** Instagram posts need a picture and Instagram *private messages* can't be answered through
Meta's API (reply in the app; comments work). Facebook allows replying to a message only within 24 hours.
X (Twitter) and LinkedIn aren't connected — their APIs need separate approval; the share buttons on vehicle
pages work for them.

**If it breaks:** the message under the post says why in plain words. "connection has expired" → create a new
long-lived Page token and update `META_PAGE_ACCESS_TOKEN` on Render. "permission" → the Meta app needs
`pages_manage_posts`, `pages_read_engagement`, `pages_messaging` (and Instagram equivalents).

---

## 23. Import cost estimator

**What:** a calculator on the Import page: enter a vehicle's price abroad and where it ships from, see the
estimated landed cost (shipping, duty, VAT, clearing, your fee, delivery) in USD with kwacha.
**Off until an admin turns it on** — the default rates are placeholders.
**Where:** `components/import/ImportCostEstimator.tsx`, maths in `utils/importCost.ts` (tested), settings in
Site Content → Import Cost Estimator (`ImportCalculatorSettings.tsx`, SiteContent key `importCalculator`).

---

## 24. Speed

**What was done and why it matters on mobile data:** the logo shrank from 233 KB to 6 KB (WebP at 3× its
display size; the favicon likewise); the app is split so the framework (`vendor-react`) is cached separately
from the app code; the Lycie chat downloads only after the page is idle; built files are cached for a year
(`vercel.json`); photos use responsive sizes (and missing sizes are created on demand — see
`uploads.service.ts`). Result: a first visit to the homepage loads about 90 KB of code and logo (previously
about 310 KB).
**Keeping it light:** avoid adding large libraries to the entry bundle (lazy-load with `import()` like the
admin pages and the QR library); compress new images before use; check `npm run build` output sizes.

---

## 25. AI speed (Lycie, the writing helper, deals and briefings)

**What changed:** Google's models vary wildly in speed — the *same* model answered in 2 seconds one moment and 12
the next, and the model we used first was the slowest. Now:
1. **Fastest models first** (`gemini-flash-lite-latest`, `3.1-flash-lite`, `3.6-flash`, then `3.8-flash`). The "lite"
   models were being skipped because they reject a setting we sent; it's no longer sent to them.
2. **Racing:** if the first model hasn't answered within ~1.2 seconds, the next is started alongside it and whichever
   answers first wins (the loser is cancelled and never marked as broken). Tune with `LYCIE_HEDGE_MS`.
3. **Instant repeat answers:** Lycie remembers answers to standalone questions for 5 minutes (any admin change to
   vehicles, prices or knowledge starts fresh) — a repeated question is answered in about 0.02 seconds and uses no AI quota.
4. **Search quota can't break chat:** search-related failures are tracked separately from ordinary chat.
5. **Two models start together** (`LYCIE_PARALLEL`, default 2): Google's response time has a long tail on the free tier
   (the same model answered in 1 s, then 6 s, then 19 s on the same afternoon), so the two fastest models start at the
   same instant and the first answer wins. More models join if both stall.
6. **FAQ first — no AI at all:** a visitor question that is nearly the same as one of your FAQs is answered from the FAQ
   immediately (about 0.01 s), even while Google is slow or down. Write your common questions as FAQs and Lycie answers
   them instantly.
7. **Real fallback when the AI is down:** instead of only "I'm having trouble", Lycie gives the closest FAQ/knowledge answer
   (at least two shared meaningful words, so unrelated questions never get a random answer) plus how to reach the team.
8. **No cold start:** Lycie's knowledge is built when the server starts and refreshed in the background (an expired copy
   is served instantly while a new one is built), so the first visitor never waits for it.
9. **Stock, price and hire questions need no AI:** "Do you have a Toyota Hilux?", "How much is a Corolla?", "What SUVs
   do you have?" and "What can I hire?" are answered straight from your live vehicles and hire fleet, with vehicle cards
   (about 0.01 s, always current, works when Google is down). Anything more involved — finance, importing, comparisons,
   follow-up questions in a conversation — still goes to the AI. Sold and reserved vehicles are described as such.
Measured on the real key: fresh answers 2.6–5 s (previously 4–12 s for the model alone); repeats 0.02 s; streamed
answers finish in about 2.3 s and start showing words sooner.
**Where:** `server/src/lycie/gemini.client.ts` (`race`, `thinkingFor`), `lycie/answer-cache.util.ts`, `lycie/knowledge-select.util.ts` (`bestKnowledgeMatch`), `lycie/direct-answer.util.ts`, `lycie/lycie.service.ts`, `lycie/context.service.ts`.
**Check it:** Admin → Lycie AI → **AI connection check** tests every model live and shows which work, how fast, and why any fail.
**The limit of what code can do:** on Google's free tier response times are erratic and daily quotas are small. Enabling billing on the Google AI project gives priority and removes the quotas; nothing else changes.
**If it's slow:** check `GEMINI` warnings in the API log — a line like "model X failed (quota exhausted)" means that model's
daily free quota is used up (it rests and the others carry on). Free-tier limits are the usual cause of slowness; a paid
Google AI plan removes them.


---

## Undo for admin actions (added 2026-09-24)

**What:** after almost any change in the admin (add/edit/delete/publish/archive, bulk actions, site content,
bookings, request statuses, prices, admin accounts…) a bar appears: *"Archived 3 vehicles · Undo"* (also
Ctrl/⌘+Z while it shows). **Admin → Activity & Undo** lists every action with an Undo button: Owners can undo
anyone's action, Managers their own, for 30 days. An undo is itself logged and can be redone. If part of the
change was edited again since, the undo stops and offers *Undo anyway*. Deleted items come back with what was
deleted along with them (e.g. a vehicle's reviews). Emails and social posts already sent can't be recalled.

**Where:** `server/src/undo/` — `change-tracker.ts` (a Prisma middleware that, inside an admin write request,
snapshots every row before it changes), `undo.service.ts` (saves before/after per action in `ChangeRecord`,
reverses in one transaction, conflict check), `model-meta.ts` (reads ids/JSON/cascades from the schema, so new
tables are covered automatically). `admin-tools/activity.interceptor.ts` runs requests inside tracking and
returns `X-Undo-Id`. Frontend: `adminApi.ts` (event + `undoAdminAction`), `components/UndoToast.tsx`,
`pages/AdminActivity.tsx`.

**If it breaks:** "can't be undone" → the action didn't change the database, used a bulk insert, or touched
more than 1,000 rows. "Couldn't undo this because something else now uses the same…" → e.g. a new vehicle took
the deleted one's web address; rename it and retry.

## Vehicle alerts and price-drop emails (added 2026-09-24)

**What:** signed-in customers with a confirmed email create alerts on their account page (make, model, type,
top price, oldest year). Every 10 minutes new or newly published matching vehicles are emailed (each once),
and saved vehicles whose price drops trigger a "Price drop" email. **Admin → Insights → What customers are
waiting for** ranks what people want with their typical budget, which is a guide to what to import.

**Where:** `server/src/alerts/` (matching in `alert-match.ts`, job in `alerts.cron.ts`), table `VehicleAlert`,
`SavedVehicle.notifiedPrice`; frontend `components/customer/VehicleAlerts.tsx`. Needs email configured.

## Hire availability (added 2026-09-24)

**What:** the hire form lists dates the vehicle is already booked and won't accept overlapping, past or
over-365-day dates. The API refuses them too, so customers aren't turned down after waiting.
**Where:** `GET /api/hire-requests/availability/:vehicleId` (dates only, no names), `HireRequestForm.tsx`.

## Compare vehicles (added 2026-09-24)

**What:** *Add to compare* on a vehicle page (up to 3, remembered in the browser) or *Compare* on saved
vehicles opens `/compare`, a side-by-side table with the best price, year and mileage highlighted.
**Where:** `src/pages/Compare/`, `src/utils/compareList.ts`, `components/vehicles/CompareButton.tsx`.


## Staff workspace, departments and access (added 2026-09-25)

See [STAFF-AND-ACCESS.md](STAFF-AND-ACCESS.md): invitations with one-time passwords, department modules,
per-person access, the hardened administrator portal, HR leave, and the redesigned workspace.

## Mobile money payments (added 2026-09-25)

**What:** customers pay with Airtel Money or TNM Mpamba from their account page ("Pay with mobile money")
through PayChangu's secure page. The server confirms each payment with PayChangu itself (never trusting the
browser or the webhook body), then credits the account ledger exactly once and sends a receipt (email +
WhatsApp). **Finance → Mobile money** lists every attempt, with *Check again* for waiting ones.
**Setup:** create a PayChangu business account; set `PAYCHANGU_SECRET_KEY` (a `sec-test-…` key for the
sandbox first) and optionally `PAYCHANGU_WEBHOOK_SECRET` (webhook URL: `https://<site>/api/mobile-payments/webhook`).
Check field names against PayChangu's current API docs in the sandbox before going live.
**Where:** `server/src/mobile-payments/`, `src/components/customer/MobileMoneyCard.tsx`, `src/pages/Customer/PaymentReturn.tsx`.

## Shipment tracking (added 2026-09-25)

**What:** **Imports & Clearing → Shipments**: open a shipment for a customer (gets a code like `LYC-7K2M9Q`),
then post progress through 8 stages (purchased → shipped → port → road → border → customs → ready → delivered)
with a message and photos. The customer is emailed (and WhatsApped) each time and sees a timeline on their
account page; anyone with the code can follow it at `/track` (no personal details shown).
**Where:** `server/src/shipments/`, `src/admin/pages/AdminShipments.tsx`, `src/components/common/ShipmentTimeline.tsx`, `src/pages/Track/`.

## WhatsApp notifications (added 2026-09-25)

**What:** booking confirmations/cancellations, shipment updates and payment receipts also go by WhatsApp to
customers with a phone number (unless they chose email only). Customers can add their number on their account page.
**Setup:** WhatsApp Business (Meta Cloud API): approve a *Utility* template with one variable `{{1}}`, then set
`WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_TEMPLATE_NAME` (and `WHATSAPP_TEMPLATE_LANG`, default `en`).
**Where:** `server/src/notifications/`.

## Referrals (added 2026-09-25)

**What:** every customer has a share link (`/account/register?ref=CODE`) on their account page, with a WhatsApp
share button. Friends who join through it are linked; **Finance → Referrals** shows whether the friend has done
business yet and lets Finance reward the referrer — credited to their account balance, once.
**Where:** `server/src/referrals/`, `src/components/customer/ReferralCard.tsx`.

## Chichewa (added 2026-09-25)

**What:** an EN | NY switch in the site header translates the menus, footer, sign-in and tracking pages (remembered
per device; sets `<html lang>`). System administrators turn the switch on or off and pick the default language in
**System → Settings & status → Website language** (saved as site content `language`; needs System edit access). Text edited in Website content stays as written. **Have a native speaker review
`src/i18n/strings.ts` before launch.**
