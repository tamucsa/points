# Admin Onboarding

This guide is for admins who manage member onboarding, roles, and operational settings.

## Access

Admins must have `members.role = 'admin'`. Admin pages are under `/admin/*`.

## Quickstart checklist

- Verify you can access the admin dashboard (e.g., pending members list).
- Confirm the active semester is correct.
- Confirm the Jiating list (`jt_families`) is accurate and active.

## Member onboarding workflow (pending → active)

### 1) Review pending members
Pending members are `members.status = 'pending_jt'`.

### 2) Assign Jiating
- Set `members.jt_family_id` for the member.

### 3) Activate
- Change status to `active`.

Result:
- Member gains access to dashboard pages (leaderboard/events/profile).

## CSV member import

Bulk import is the primary way to load the full CSA roster after Jiating sorting.

| Column | Required | Notes |
|--------|----------|-------|
| `Full Name` | Yes | Complete name as shown in the app |
| `TAMU Email` | Yes | Must be `@tamu.edu` |
| `Jiating` | Yes | Must match an active Jiating in `jt_families` |
| `Phone` | Yes | Contact phone number |
| `Class` | Yes | Graduation year, e.g. `2027` (stored as `graduation_year`) |

- **New emails** → inserted as `active` with `jt_family_id` set.
- **Existing emails** → only changed fields are updated; unchanged rows are skipped.
- **Jiating transfers** → logged in `jt_transfer_log` with semester and import batch metadata.

Use **Full roster (fall)** for the start-of-year import. Use **Spring update (partial)** after fall close for JT transfers and mid-year additions only.

Roster imports create `active` members with Jiating assigned. New rows are inserted via the server service role after an admin check (RLS allows admin bulk import of `active` members with `auth_uid IS NULL`).

Members still sign in with Google once to link `auth_uid`.

## Semester management

Go to **Admin** → **Semesters** (`/admin/semesters`).

- **Current** — active semester with close action, school year, dates, Jiatings, and event count
- **Past semesters** — collapsible history of closed terms with archived member counts
- **Close semester** — archives points into `semester_summaries` via `close_semester` (requires `SUPABASE_SERVICE_ROLE_KEY` on the server)
- **Start semester** — only available when no semester is active; pick name, dates, and school year (`years.name`, e.g. `2026-2027`)

Do **not** pre-create inactive semester rows for a future term (e.g. Spring 2027 while Fall 2026 is still active). Create each semester when it starts via **Start semester**.

Typical flow: close fall → spring partial CSV import → start spring semester.

## Role management

### Promote to officer
- Update `members.role` to `officer`.

### Promote to admin
- Update `members.role` to `admin`.

Security note:
- Only admins should be able to change `role` or critical fields (enforced by RLS + server-side guards).

## Data integrity / corrections

### Attendance corrections
If a member was checked in incorrectly:
- Decide whether to remove attendance, mark it unverified, or mark it `counted = false` depending on the policy.

## Security operations

- Rotate high-value secrets (especially `SUPABASE_SERVICE_ROLE_KEY`) on any handoff or suspected exposure.
- Review and test RLS changes in staging before production.

