# Admin Onboarding

This guide is for admins who manage member onboarding, roles, and operational settings.

## Access

Admins must have `members.role = 'admin'`. Admin pages are under `/admin/*`.

## Quickstart checklist

- Verify you can access the admin dashboard (e.g., pending members list).
- Confirm the active semester is correct.
- Confirm the Jiating list for the active school year is accurate (`/admin/semesters` — edit names/colors as needed).

## Member onboarding workflows

### Self-registration (pending_member → active)

1. Review **Pending signup** (`/admin/members?tab=signups`). These are `members.status = 'pending_member'`.
2. Optionally assign a Jiating.
3. Click **Approve** → status becomes `active` (JT optional). Member gains dashboard access.

### Pending JT (active, no Jiating)

1. Open **Pending JT** (`/admin/members`). These are `active` members with `jt_family_id` null.
2. Assign a Jiating and click **Assign**.
3. Access does not change — they were already active (e.g. CSV import before sorting).

Result of approval:
- Member gains access to dashboard pages (leaderboard/events/profile).

## CSV member import

Bulk import is the primary way to load the CSA roster after dues (Jiating can wait until sorting).

| Column | Required | Notes |
|--------|----------|-------|
| `Full Name` | Yes | Complete name as shown in the app |
| `TAMU Email` | Yes | Must be `@tamu.edu` |
| `Jiating` | No | Optional; must match an active Jiating when provided. Leave blank until sorting — member is still created as `active` and can use the portal |
| `Phone` | Yes | Contact phone number |
| `Class` | Yes | Graduation year, e.g. `2027` (stored as `graduation_year`) |

- **New emails** → inserted as `active` with `jt_family_id` set when provided (otherwise null until assigned later).
- **Existing emails** → only changed fields are updated; unchanged rows are skipped. A blank Jiating column does **not** clear an existing assignment.
- **Jiating transfers** — spring import only, when a member already had a Jiating and moves to a different one; logged in `jt_transfer_log`. Fall roster assignment and first-time Jiating assignment are not transfers.

Use **Full roster (fall)** for the start-of-year import (often before Jiating reveal). Use **Spring update (partial)** after fall close for JT transfers and mid-year additions only.

Roster imports create `active` members (Jiating optional). New rows are inserted via the server service role after an admin check.

Members still sign in with Google once to link `auth_uid`. They skip the self-registration form — name, phone, and class are already on the roster row — and land in the app as `active` after that first login.

## Semester management

Go to **Admin** → **Semesters** (`/admin/semesters`).

- **Current** — active semester; edit name/dates; manage Jiatings; close action
- **Past semesters** — collapsible history of closed terms with archived member counts
- **Close semester** — archives points into `semester_summaries` via `close_semester` (requires `SUPABASE_SERVICE_ROLE_KEY` on the server). **Spring close** also clears active members’ `jt_family_id` (status stays `active`). Fall close keeps Jiatings for Spring.
- **Start semester** — only when no semester is active; enter name and dates. **School year is derived from the start date** (Aug–Dec → `YYYY-(YYYY+1)`, Jan–Jul → `(YYYY-1)-YYYY`) and created automatically if missing

### Jiatings (per school year)

Jiatings (`jt_families`) belong to a **school year**, not a single semester. Fall and Spring of the same year share the same families.

- **New school year (typically Fall):** if the year has no Jiatings yet, starting the semester creates **JT 1–JT 6** placeholders with random colors (or customize names/colors in the optional section). Prior years’ active Jiatings are deactivated.
- **Same school year (typically Spring):** existing Jiatings carry over; no new placeholders.
- **After start:** on the active semester card, edit names/colors, add Jiatings, or deactivate. Rename placeholders once themes are decided (e.g. August).
- **Mislinked placeholders:** if active Jiatings belong to a different year than the active semester, use **Replace with JT 1–6 placeholders** on the semester card.

Do **not** pre-create inactive semester rows for a future term (e.g. Spring 2027 while Fall 2026 is still active). Create each semester when it starts via **Start semester**.

Typical flow: start fall (placeholders) → rename JTs when themes land → fall roster CSV → close fall (JTs kept) → spring partial CSV → start spring → close spring (**clears JTs**) → next fall.

## Role management

Go to **Admin** → **Members** → **Roles** (`/admin/members?tab=roles`).

- Search active members and filter by current role.
- Set role to **Member**, **Officer**, or **Admin**, then **Save**.
- Promoting to admin and demoting yourself require confirmation.
- The last remaining admin cannot be demoted.

Security note:
- Only admins can change `role` (enforced by RLS + `updateMemberRole` server action). Officers cannot elevate themselves.

## Data integrity / corrections

### Attendance corrections
If a member was checked in incorrectly:
- Officers/admins remove the check-in from event detail or the check-in page (presence corrections).
- `counted = false` is set automatically by point caps; do not remove attendees just because they hit a cap.

## Security operations

- Rotate high-value secrets (especially `SUPABASE_SERVICE_ROLE_KEY`) on any handoff or suspected exposure.
- Review and test RLS changes in staging before production.

