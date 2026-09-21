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

## 17. SEO and sharing

**What:** each page sets its title and description; site-wide defaults are editable.
**Where:** `src/components/common/Seo.tsx`; SiteContent key `seo`; static fallbacks in `index.html`.

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
