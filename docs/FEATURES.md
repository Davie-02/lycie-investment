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
