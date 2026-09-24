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
| Management | Edit on all operational modules, view Insights and HR |
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

## The system administrator portal

- Owner accounts only; staff are told to use the website sign-in.
- **Two-step verification is mandatory** (`SYSTEM_ADMIN_REQUIRE_2FA`, on unless set to `false`).
  Until it's set up, only My Security works.
- No "keep me signed in"; 3-minute idle sign-out (staff: 5 minutes unless they chose to stay signed in).
- Optional network lock: `SYSTEM_ADMIN_ALLOWED_IPS="41.70.1.2, 102.68.3.4"`.
- Every sign-in emails an alert; every change is in Activity & undo.
- The last active administrator can't be demoted, deactivated or deleted.
- **System → System status** shows these rules and which services are connected.

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
