# Staff, departments and module access

How employees get accounts, how the system knows what each person may use, and
how the system administrator stays in control. Code: `server/src/access/`,
`server/src/admin-users/`, `src/admin/modules.ts`, `src/admin/access.ts`.

## Three kinds of account, one website

| Who | Signs in at | Lands on |
| --- | --- | --- |
| Customer | `/account/login` (website sign-in) | their account page |
| Staff member (role `EMPLOYEE`, older `MANAGER`/`VIEWER`) | `/account/login` — the same form | the workspace, `/admin` |
| System administrator (role `OWNER`) | `/admin/login` — the administrator portal only | the workspace, with everything |

`POST /api/sign-in` checks the password against both the staff and customer
account for that email (always the same amount of work, so timing reveals
nothing) and returns what the password opened. Administrator accounts are
refused on the website form and staff accounts on the portal.

## Inviting staff

Workspace → **People (HR) → Staff** or **System → Staff & access** → *Invite staff member*.
Enter name, email, department and job title. The server:

1. checks the email can really receive mail (typo, throwaway and mail-server checks; the paid mailbox check if configured);
2. makes a 20-character one-time password (all four character types, no look-alike characters, about 125 bits);
3. emails an invitation with the sign-in link and that password, valid **72 hours**.

At first sign-in the person must choose their own password (strength-checked,
must differ from the one-time one) before anything else works. If email isn't
set up, the one-time password is shown to the inviter **once** to hand over in
person. *Re-send invite* issues a fresh one. The account list shows *Invited*,
*Invitation expired*, *Active* or *Deactivated*.

## Modules and access levels

Ten modules: Sales · Hire & Fleet · Imports & Clearing · Finance · Customer Care ·
Marketing & Content · Lycie AI · Insights & Market · People (HR) · System.

Levels: **No access** (hidden) · **View** · **Edit** (add, change, handle work) ·
**Manage** (edit plus exports of personal data, settings, inviting staff in HR).

Each **department** has defaults (`DEPARTMENTS` in `server/src/access/modules.ts`):

| Department | Default access |
| --- | --- |
| Director | Edit on all operational modules, view Insights and HR, **Tracking codes** |
| Management | Edit on all operational modules, view Insights and HR, **Tracking codes** |
| Sales | Sales + Customer Care edit; Hire, Lycie AI, Insights view |
| Hire & Fleet | Hire edit; Customer Care, Insights view |
| Imports & Clearing | Imports edit; Customer Care, Sales view |
| Finance | Finance edit; Sales, Hire, Imports, Insights view |
| Customer Care | Customer Care + Lycie AI edit; Sales, Hire, Imports view |
| Marketing | Marketing + Lycie AI edit; Sales, Insights view |
| Human Resources | People (HR) manage |
| General staff | nothing but their own pages |

The **system administrator** can *extend or limit* anyone module by module
(Staff & access → Edit → *Module access*). Rows that differ from the department
are highlighted; *Reset to department defaults* clears them. Changes apply to
the person's very next click — no sign-out needed.

Every staff member also has: Home dashboard, **My work & leave**, **Team directory**,
**My security**, **Activity & undo** (their own actions).

### How it is enforced

The server decides, never the browser. `RolesGuard` looks up the route in
`server/src/access/route-access.ts` (which module, which level) and compares it
with the person's access, recalculated from the database at most every 15
seconds. A staff route that isn't in that table falls back to its role list, so
a new endpoint is never accidentally open to everyone. The workspace only hides
what the server would refuse anyway.

## Tracking codes are private

Shipment tracking codes work like a password for a customer's shipment. Only people with the **Tracking
codes** privilege — the Director, Managers, system administrators, or anyone a system administrator gives it
to in Staff & access — see the list of all shipments and their codes. Everyone else (Imports & Clearing,
Customer Care, Sales…) asks the customer for their code and enters it (Shipments, or Customer Care → *Look up
a shipment*) to see that one shipment; Imports staff can then post progress. When a shipment is opened the
code is emailed (and WhatsApped) straight to the customer, so staff without the privilege never see it.
Look-ups are limited to 20 a minute so codes can't be guessed by trying many.

## Who can manage accounts

| Action | System administrator | HR / System "manage" |
| --- | --- | --- |
| Invite staff, edit profile/department, deactivate, re-send invite | ✓ | ✓ (not administrator accounts) |
| Add another system administrator, change roles | ✓ | ✗ |
| Change module access | ✓ | ✗ |
| Reset someone's two-step verification | ✓ | ✗ |
| Delete an account | ✓ | ✗ (deactivate instead) |

The most sensitive changes (new administrator, role or access change, deleting,
2FA reset) also ask **"Confirm it's you"** — password plus authenticator code,
valid 10 minutes.

## Guides ("About this page")

Every workspace page and module overview starts with a short guide explaining what it's for and how it
works (built-in texts: `server/src/guides/guide-defaults.ts`). The main system administrator rewrites them
under **System → Guides** and chooses who sees each: everyone who can open that area, only system
administrators, chosen departments, or nobody. Guides describing security rules are for administrators only
by default. Staff only ever receive the guides meant for them (`GET /api/workspace/guides`); editing is
limited to the OWNER role. Edits reach open workspaces immediately.

## What the public side reveals (nothing)

- Both sign-in pages give the same "Invalid email or password" for a wrong password, an unknown email, the
  wrong kind of account (an administrator on the website form, staff on the administrator page) and a blocked
  network. Lockout after 5 tries also applies to emails with no account, so it can't be used to discover who
  is registered.
- The administrator sign-in page is a plain "Sign in" form; nothing on the website links to it, and
  `robots.txt` doesn't mention it (the page is sent with `X-Robots-Tag: noindex`).
- The website's built files have anonymous names, and no setting names or security rules are in the
  browser code: Settings & status descriptions come from the server, only for people with System access.
- Messages staff see when a service isn't connected say only "A system administrator can see what's needed".

## The system administrator portal

- Owner accounts only (anyone else gets the ordinary "Invalid email or password").
- **Two-step verification is mandatory** (`SYSTEM_ADMIN_REQUIRE_2FA`, on unless set to `false`).
  Until it's set up, only My Security works.
- No "keep me signed in"; 3-minute idle sign-out (staff: 5 minutes unless they chose to stay signed in).
- Optional network lock: `SYSTEM_ADMIN_ALLOWED_IPS="41.70.1.2, 102.68.3.4"`.
- Every sign-in emails an alert; every change is in Activity & undo.
- The last active administrator can't be demoted, deactivated or deleted.
- **System → Settings & status** shows these rules, which services are connected, and the website language setting.

## HR: leave

Staff request leave from *My work & leave* (working days are counted, overlaps
refused). HR with edit access approves or declines under *People (HR) → Leave*
(not their own); the employee is emailed. The HR overview shows who's away today.

## The workspace

Sidebar grouped by department with "needs attention" badges; each module has an
Overview (its numbers and pages) and tabs across its pages; breadcrumb, search
(Ctrl/⌘+K), account menu, and Light / Dark / Match-device theme. On phones the
sidebar is a slide-in menu. Speed: pages load on demand and start downloading
when you hover a link; dashboard numbers come from one request
(`GET /api/workspace/summary`) cached 20 s on the server and 30 s in the browser.
