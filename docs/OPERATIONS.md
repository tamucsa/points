# Operations (Workflows)

Runbook for day-to-day CSA Points operations. Each section includes an **overview** (what happens in the system) and **step-by-step** instructions (what to do in the app).

## Quick reference

| Workflow | Who | Where in app |
|----------|-----|--------------|
| Member self-registration | Member | `/register` |
| Bulk member import | Admin | `/admin/members` → Import |
| Activate pending member | Admin | `/admin/members` → Pending |
| Create event | Officer/Admin | `/officer/events/new` |
| Officer check-in | Officer/Admin | `/officer/events/[id]/checkin` |
| QR / self check-in | Officer + Member | `/officer/events/[id]/qr` + `/checkin/[code]` |
| View leaderboard | Member | `/leaderboard`, `/leaderboard/jiatings` |
| View own points | Member | `/profile` |
| Browse events | Member | `/events` |
| Look up member points | Officer/Admin | `/officer/members` |

Related docs:
- User guides: `docs/ONBOARDING_MEMBERS.md`, `docs/ONBOARDING_OFFICERS.md`, `docs/ONBOARDING_ADMINS.md`
- Deployment: `docs/DEPLOYMENT.md`
- Known issues: `docs/KNOWN_ISSUES.md`

---

## 1. Member onboarding

### Overview

New members authenticate with TAMU Google (`@tamu.edu`). The auth callback links their Supabase auth account to a `members` row (by `auth_uid` or email). Until an admin assigns a Jiating and activates them, they remain `pending_jt` and can only access onboarding routes.

**States:** `pending_jt` → `active` (after admin assigns Jiating)

### Step-by-step: Member self-registers

1. Member opens the site and clicks **Sign in with Google**.
2. Member signs in with a `@tamu.edu` account.
3. If no `members` row exists, they are redirected to `/register`.
4. Member fills in:
   - First name and last name (required) — stored together as `full_name`
   - Graduation year (required)
   - Phone (optional)
5. Member submits the form.
6. System creates a `members` row with `status = pending_jt` and `role = member`.
7. Member is redirected to `/pending` until an admin activates them.

### Step-by-step: Admin bulk-imports members (CSV)

Use this at the start of a semester to pre-load the roster before members sign in.

1. Admin signs in and goes to **Admin** → `/admin/members`.
2. Open the **Import** tab.
3. Prepare a CSV with these exact column headers:
   - `Full Name` — complete name as shown in the app (required)
   - `TAMU Email`
   - `Phone`
   - `Graduation Year`
4. Upload the CSV file.
5. Review the import summary:
   - **Added** — new rows created as `pending_jt`
   - **Skipped** — email already exists
   - **Errors** — invalid emails (must be `@tamu.edu`) or insert failures
6. Tell imported members to sign in with Google; the auth callback will link their account by email.

### Step-by-step: Admin activates a pending member

1. Admin goes to `/admin/members` → **Pending** tab.
2. Find the member in the pending list.
3. Select their **Jiating** from the dropdown.
4. Click **Activate** (or equivalent action for that row).
5. System sets `jt_family_id` and `status = active`.
6. Member can now access leaderboard, events, and profile on next visit.

### Troubleshooting

| Symptom | Likely cause | Action |
|---------|--------------|--------|
| Member stuck on `/pending` | Not activated or no Jiating assigned | Admin activates in `/admin/members` |
| Member sent to `/register` after login | No member row and not imported | Member completes registration, or admin imports them |
| Non-TAMU email rejected | Domain enforcement in auth callback | Member must use `@tamu.edu` |

---

## 2. Semester lifecycle

### Overview

Points and leaderboards are scoped to the **active semester** (`semesters.is_active = true`). Leaderboard views (`v_current_leaderboard`, `v_jt_leaderboard`) join against the active semester automatically.

Closing a semester archives totals (via `close_semester` in the database) and should roll up data into `semester_summaries`.

> **Planned:** Semester start and close will be implemented in a **future admin UI**. Until then, semester changes require database access (see interim steps below).

### Step-by-step: Start a new semester (interim — until admin UI exists)

> **Status:** Not yet available in the app. Coordinate with a developer or Supabase admin.

1. Confirm the previous semester is closed (see below).
2. In Supabase, insert a new row into `semesters` with the new semester name and dates.
3. Set `is_active = false` on all other semesters.
4. Set `is_active = true` on the new semester only.
5. Verify in the app:
   - Leaderboard shows data for the new semester (may be empty initially).
   - Officer event creation uses the new semester.
6. Communicate the semester change to officers.

### Step-by-step: Close a semester (interim — until admin UI exists)

> **Status:** Not yet available in the app. The `close_semester(uuid)` function exists but is restricted to `service_role` only.

1. Confirm all events for the semester are complete and attendance is finalized.
2. A developer or Supabase admin runs `close_semester(<semester_id>)` using service-role credentials.
3. Verify `semester_summaries` rows were created for members.
4. Set the closing semester’s `is_active = false`.
5. Start the new semester (see above).

### Future: Semester admin UI (planned)

When implemented, admins will be able to:
- Create a new semester and mark it active
- Close the current semester (triggering archival and summary rollups)
- View semester history

No manual database steps will be required.

---

## 3. Events

### Overview

Officers and admins create events tied to the active semester. Each event has:
- **Category** (e.g., GM, CSA, Sports) and **point value**
- **Scope**: CSA-wide (`org`), JT shared (`jt_shared`), or JT-specific (`jt_specific`)
- **Check-in type**: officer, self (QR), or RSVP required

Sports events can optionally create a linked **Spectator** child event (1 point, self check-in, capped at 10 points/semester per member via `attendance.counted`).

### Step-by-step: Create an event

1. Officer/admin signs in and goes to **Officer Events** → `/officer/events`.
2. Click **New Event** → `/officer/events/new`.
3. Fill in the form:
   - **Name** (required)
   - **Category** and **point value**
   - **Scope**:
     - *CSA-Wide* — visible to all active members
     - *JT Shared* — visible to all Jiatings
     - *JT Specific* — select a Jiating; only that family sees the event
   - **Check-in type**:
     - *Officer* — manual check-in at the event
     - *Self (QR)* — members scan a QR code
     - *RSVP Required* — provide RSVP URL and deadline
   - **Date**, **location**, **description** (as needed)
4. For **Sports** events, optionally enable **Spectator check-in** (creates a child spectator event).
5. Submit the form.
6. Confirm the event appears on `/officer/events`.

### Step-by-step: Run officer check-in at an event

1. Officer opens the event from `/officer/events`.
2. Click **Check In** → `/officer/events/[id]/checkin`.
3. Search or scroll the member list.
4. Click a member to check them in.
5. System inserts an `attendance` row with `check_in_method = officer`.
6. Already-checked-in members show as checked (duplicate inserts are blocked).

### Step-by-step: Run QR / self check-in at an event

**Officer setup:**

1. Create the event with check-in type **Self (QR)**.
2. Open the event detail page → **Show QR** → `/officer/events/[id]/qr`.
3. Display the QR code at the event venue.

**Member check-in:**

1. Member scans the QR code (or opens `/checkin/[code]`).
2. Member signs in if not already authenticated.
3. Member confirms check-in on the check-in page.
4. System inserts `attendance` with `check_in_method = qr_scan`.
5. If the member is `pending_jt`, check-in is blocked with an error message.

### Step-by-step: Verify attendance after an event

1. Officer opens the event detail page → `/officer/events/[id]`.
2. Review the attendance list (name, check-in method, counted status, timestamp).
3. Compare headcount against expected turnout.
4. For corrections, see **Attendance corrections** below.

---

## 4. Points and leaderboards

### Overview

Points are earned through `attendance` rows linked to `events`. The `attendance.counted` flag supports rules like the Sports Spectator cap (max 10 points/semester). Leaderboards read from database views for the active semester.

### Step-by-step: Member views their points

1. Member goes to **My Points** → `/profile`.
2. Review total points and category breakdown (CSA, JT, Sports, GM).
3. Scroll attendance history for the current semester.

### Step-by-step: Anyone views the leaderboard

1. Go to **Leaderboard** → `/leaderboard`.
2. **Overall** tab shows top 10 members (rank, name, avatar, Jiating badge, total points).
3. **Jiatings** tab → `/leaderboard/jiatings` shows top 3 per Jiating card.

### Step-by-step: Officer looks up a member’s points

1. Officer goes to **Members** → `/officer/members`.
2. Use search (name/email) or JT filter.
3. Navigate pages (25 members per page).
4. Click a member row → `/officer/members/[id]` for full breakdown and attendance history.

---

## 5. Attendance corrections

### Overview

There is no dedicated “undo check-in” UI yet. Corrections are handled at the database level or by marking attendance as not counted.

### Step-by-step: Correct a mistaken check-in (interim)

1. Identify the incorrect `attendance` row (via event detail page or Supabase).
2. Decide the correction:
   - **Remove** the row entirely (member was never there), or
   - Set `counted = false` (attendance recorded but points should not apply)
3. A developer or Supabase admin makes the change.
4. Verify the member’s points updated on `/profile` and leaderboard.

> **Planned:** Admin UI for attendance corrections.

---

## 6. Role management

### Overview

Roles (`member`, `officer`, `admin`) control access to officer and admin pages. RLS policies prevent officers from elevating roles.

### Step-by-step: Promote a member to officer or admin (interim)

> **Status:** No in-app role management UI yet.

1. A developer or Supabase admin updates `members.role` for the target member:
   - `officer` — access to `/officer/*`
   - `admin` — access to `/officer/*` and `/admin/*`
2. Member signs out and back in (or refreshes) to pick up the new role.
3. Verify they can access the appropriate pages.

> **Planned:** Admin UI for role management.

---

## 7. Security operations

### Overview

The app relies on Supabase RLS for data access control. High-value secrets must stay server-only.

### Step-by-step: Rotate secrets after a handoff or exposure

1. In Supabase → Settings → API, rotate the **service_role** key.
2. Update `SUPABASE_SERVICE_ROLE_KEY` in the hosting provider (e.g., Vercel).
3. Redeploy the application.
4. Verify login and member linking still work.

### Step-by-step: Review RLS before a schema change

1. Read existing policies in `supabase/migrations/`.
2. Test changes in a staging Supabase project first.
3. Apply migration to production.
4. Smoke-test: member login, officer event creation, admin activation, check-in.

---

## 8. Deployment and migrations

See `docs/DEPLOYMENT.md` for full deployment steps.

### Step-by-step: Apply a new database migration

1. Review the SQL in `supabase/migrations/`.
2. Apply to Supabase (dashboard SQL editor or CLI).
3. Deploy application code that depends on the migration.
4. Run post-deploy verification (login, leaderboard, check-in).

---

## Planned features (not yet in app)

| Feature | Status |
|---------|--------|
| Semester start/close admin UI | Planned |
| Role management admin UI | Planned |
| Attendance correction UI | Planned |
| Materialized leaderboard (performance at 300+ members) | Under consideration |

Track implementation progress and open bugs in `docs/KNOWN_ISSUES.md`.
