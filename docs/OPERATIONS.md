# Operations (Workflows)

Runbook for day-to-day CSA Points operations. Each section includes an **overview** (what happens in the system) and **step-by-step** instructions (what to do in the app).

## Quick reference


| Workflow                               | Who              | Where in app                                                      |
| -------------------------------------- | ---------------- | ----------------------------------------------------------------- |
| Member self-registration               | Member           | `/register`                                                       |
| Bulk member import                     | Admin            | `/admin/members` → Import                                         |
| Spring roster update (JT transfers)    | Admin            | `/admin/members` → Import → Spring update                         |
| Close / start semester                 | Admin            | `/admin/semesters`                                                |
| Activate pending member                | Admin            | `/admin/members` → Pending                                        |
| Create event                           | Officer/Admin    | `/officer/events/new`                                             |
| Officer check-in                       | Officer/Admin    | `/officer/events/[id]/checkin`                                    |
| QR / self check-in                     | Officer + Member | `/officer/events/[id]/qr` + `/checkin/[code]`                     |
| View leaderboard                       | Member           | `/leaderboard`, `/leaderboard/jiatings`, `/leaderboard/standings` |
| View own points                        | Member           | `/profile`                                                        |
| Points rules (values, caps)            | —                | This doc → [Points rules](#points-rules)                          |
| Browse events                          | Member           | `/events`                                                         |
| Browse / filter events                 | Officer/Admin    | `/officer/events`                                                 |
| Edit event date / time / location      | Officer/Admin    | `/officer/events/[id]` → When and Where                           |
| Manage member roles                    | Admin            | `/admin/members?tab=roles`                                        |
| Look up member points / sign-in status | Officer/Admin    | `/officer/members`                                                |


Related docs:

- User guides: `docs/ONBOARDING_MEMBERS.md`, `docs/ONBOARDING_OFFICERS.md`, `docs/ONBOARDING_ADMINS.md`
- Deployment: `docs/DEPLOYMENT.md`
- Points policy: `docs/OPERATIONS.md` → **Points rules**
- Known issues & planned features: [GitHub Issues](https://github.com/tamucsa/points/issues) (`known-issue`, `planned-feature` labels)

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
  - Class (required)
  - Phone (optional)
5. Member submits the form.
6. System creates a `members` row with `status = pending_jt` and `role = member`.
7. Member is redirected to `/pending` until an admin activates them.

### Step-by-step: Admin bulk-imports members (CSV)

Use this at the start of a semester to pre-load the roster before members sign in.

1. Admin signs in and goes to **Admin** → `/admin/members`.
2. Open the **Import** tab and select **Full roster (fall)**.
3. Prepare a CSV with these column headers (order does not matter):

  | Column       | Required | Notes                                           |
  | ------------ | -------- | ----------------------------------------------- |
  | `Full Name`  | Yes      | Complete name as shown in the app               |
  | `TAMU Email` | Yes      | Must be `@tamu.edu`                             |
  | `Jiating`    | Yes      | Must match an active Jiating name in the system |
  | `Phone`      | Yes      | Contact phone number                            |
  | `Class`      | Yes      | Graduation year, e.g. `2027`                    |

4. Upload the CSV file.
5. Review the import summary:
  - **Added** — new `members` rows created as `active` with Jiating assigned
  - **Updated** — existing email matched; only changed fields are written
  - **Unchanged** — row matched an existing member with identical data
  - **Jiating transfers** — spring import only: existing member moved from one Jiating to another (logged to `jt_transfer_log`)
  - **Errors** — invalid email, unknown Jiating, missing required fields, or DB failures
6. Tell members to sign in with Google; the auth callback links their account by email.

### Step-by-step: Admin spring roster update (partial CSV)

After fall semester close and Jiating re-sorting, upload only rows that changed.

1. Admin goes to `/admin/members` → **Import** → **Spring update (partial)**.
2. Prepare a CSV with the same columns as fall import, but include **only**:
  - Members who transferred Jiating
  - New members joining mid-year
  - Rows where name, phone, or class needs correction
3. Upload the CSV.
4. Review the summary (especially **Jiating transfers**). Unlisted members are not modified.
5. Start the new spring semester from `/admin/semesters` if not already active.

### Step-by-step: Admin activates a pending member

1. Admin goes to `/admin/members` → **Pending** tab.
2. Find the member in the pending list.
3. Select their **Jiating** from the dropdown.
4. Click **Activate** (or equivalent action for that row).
5. System sets `jt_family_id` and `status = active`.
6. Member can now access leaderboard, events, and profile on next visit.

### Troubleshooting


| Symptom                                | Likely cause                                 | Action                                                         |
| -------------------------------------- | -------------------------------------------- | -------------------------------------------------------------- |
| Member stuck on `/pending`             | Not activated or no Jiating assigned         | Admin activates in `/admin/members`                            |
| Member sent to `/register` after login | No member row and not imported               | Member completes registration, or admin imports them           |
| Imported member shows "Not signed in"  | CSV row exists but `auth_uid` not linked yet | Member signs in once with Google; auth callback links by email |
| Non-TAMU email rejected                | Domain enforcement in auth callback          | Member must use `@tamu.edu`                                    |


---

## 2. Semester lifecycle

### Overview

Points and leaderboards are scoped to the **active semester** (`semesters.is_active = true`). `v_current_leaderboard` reads cached totals from `member_semester_points` (refreshed when attendance is inserted/deleted/`counted` changes, or when an event’s `point_value` / `category` changes). `v_jt_leaderboard` still aggregates live for GM publish snapshots.

Closing a semester archives totals (via `close_semester` in the database) and rolls up data into `semester_summaries`.

### Step-by-step: Close the active semester

1. Confirm all events for the semester are complete and attendance is finalized.
2. Admin goes to **Admin** → **Semesters** (`/admin/semesters`).
3. Click **Close semester** on the active term and confirm.
4. Verify the semester appears as **Closed** in history.

### Step-by-step: Start a new semester

1. Confirm no semester is currently active (close the previous one first).
2. Admin goes to `/admin/semesters`.
3. Fill in semester name, start/end dates, and school year.
4. Click **Start semester**.
5. Verify in the app:
  - Leaderboard shows data for the new semester (may be empty initially).
  - Officer event creation uses the new semester.
6. Communicate the semester change to officers.

### Typical annual flow

1. **Fall:** Full roster CSV import → members sign in with Google.
2. **End of fall:** Close fall semester on `/admin/semesters`.
3. **Spring:** Spring partial CSV (JT transfers + new members) → start spring semester.

> **Note:** Do not pre-create inactive semester rows for a future term. Use **Start semester** on `/admin/semesters` when the term actually begins; pre-created rows can duplicate when you start the term from the UI.

The semester admin page shows the active term, a collapsible **Past semesters** list, and per-semester details (school year, dates, Jiatings, event count, archived member count for closed terms).

---

## 3. Events

### Overview

Officers and admins create events tied to the active semester. Each event has:

- **Category** (e.g., General Meeting, CSA-Wide, Sports) and **point value** (set automatically per category)
- **Scope**: CSA-wide (`org`), JT shared (`jt_shared`), or JT-specific (`jt_specific`) — set automatically per category
- **Check-in type**: officer, self (QR), or RSVP required — fixed for some categories; officer chooses for CSA-Wide and Sports

Sports events can optionally create a linked **Spectator** child event (1 point, self check-in). Spectator semester point caps are under **[Points rules](#points-rules)**.

### Step-by-step: Browse Officer Events

1. Officer/admin goes to **Officer Events** → `/officer/events`.
2. Optionally search by event name.
3. Use category tabs (**All** / **CSA** / **Jiating** / **Sports** / **Dance**) to filter.
4. On the **Jiating** tab, use **Counts toward** to pick a family (defaults to the officer’s Jiating when assigned):
  - Olympics count toward every family → always shown for a selected family
  - Mixers count only toward participating families (`event_jt_families`)
  - JT-specific events count only toward their `jt_family_id`
5. Expand **Past Events** when checking in after the start time or verifying older attendance.
6. Long lists paginate at **10 events per page** (upcoming and past separately). Prev/Next and the range label appear **above and below** the list when there is more than one page.

Member **Events** (`/events`) is narrower: only the member’s JT-specific events plus shared/org events (and Mixers their Jiating participates in). Same category tabs, past-events collapse, and 10-per-page pagination (controls above and below); no family dropdown.

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
5. For **Mixers**, select at least two participating Jiatings (editable later on the event detail page).
6. Submit the form.
7. Confirm the event appears on `/officer/events`.

### Step-by-step: Edit event date, time, or location

1. Officer opens the event from `/officer/events` → event detail `/officer/events/[id]`.
2. Under **When and Where**, update **Date**, **Location**, **Start time**, and optional **End time**.
3. Click **Save Date and Location**.
4. Linked **Spectator** child events (if any) get the same schedule and location automatically.

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

Points are earned through `attendance` rows linked to `events`. Only rows with `attendance.counted = true` add to totals. Leaderboards read from database views for the active semester. Category point values live in code (`src/utils/events.ts` → `CATEGORY_CONFIG`).

### Points rules

Canonical scoring policy for CSA Points. Change here when club policy changes; keep `CATEGORY_CONFIG` and DB triggers/jobs in sync.

#### Category point values


| Category         | Points | Scope                  | Typical check-in                        |
| ---------------- | ------ | ---------------------- | --------------------------------------- |
| General Meeting  | 2      | CSA-wide               | Self (QR)                               |
| CSA-Wide         | 3      | CSA-wide               | Officer chooses / often self or officer |
| Philanthropy     | 3      | CSA-wide               | Officer chooses                         |
| Concessions      | 3      | CSA-wide               | Officer                                 |
| Jiating Olympics | 2      | JT shared              | Officer                                 |
| Mixer            | 2      | JT shared              | Officer                                 |
| Jiating Event    | 1      | JT specific            | Officer                                 |
| Sports           | 1      | CSA-wide               | Officer (+ optional Spectator child)    |
| Dance            | 1      | CSA-wide               | Officer                                 |
| Sports Spectator | 1      | Linked child of Sports | Self (QR)                               |


Leaderboard buckets (approx.):

- **CSA** — CSA-Wide, Philanthropy, Concessions  
- **JT** — Jiating Olympics, Jiating Event, Mixer  
- **Sports** — Sports / Sports Spectator  
- **GM** — General Meeting

#### Caps and `attendance.counted`


| Rule                                 | Status       | Detail                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------------------------ | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Sports Spectator semester cap**    | **Enforced** | Per member, per active semester: counted Spectator points cannot exceed **10**. Extra Spectator check-ins record attendance with `counted = false` (DB trigger on insert).                                                                                                                                                                                                                                                                                                                                                                                                |
| **Weekly Jiating Event + Mixer cap** | **Enforced** | Per member: at most **4** counting attendances for categories in `{Jiating Event, Mixer}` per week. Extra check-ins may still be recorded with `counted = false`. Week = **Monday 00:00 → Sunday 23:59**, America/Chicago. Prefer max points (`point_value` DESC, then `starts_at` ASC — Mixers before Jiating Events under current values). Live recompute on check-in / uncheck / relevant event `starts_at` or `category` changes (DB function + triggers). Hosting more than 4 events is allowed. **Jiating Olympics and all other categories are outside this cap.** |


Attendance with `counted = false` still appears in history (profile / event detail) but does not add to leaderboard or totals.

#### Timezone

Event start/end and weekly windows use **America/Chicago**.

### Step-by-step: Member views their points

1. Member goes to **My Points** → `/profile`.
2. Review total points and category breakdown (CSA, JT, Sports, General Meeting).
3. Scroll attendance history for the current semester.

### Step-by-step: Anyone views the leaderboard

1. Go to **Leaderboard** → `/leaderboard`.
2. **Overall** tab shows top 10 members (rank, name, avatar, Jiating badge, total points).
3. **Jiatings** tab → `/leaderboard/jiatings` shows top 3 per Jiating card.
4. **Standings** tab → `/leaderboard/standings` shows Jiating-vs-Jiating rankings from snapshots published after each GM (not live).

### Step-by-step: Officer publishes Jiating standings after GM

1. Officer opens the **GM** event from `/officer/events`.
2. After check-in is complete, click **Publish Jiating standings**.
3. System captures current `v_jt_leaderboard` totals into a snapshot.
4. Members see the new standings on **Leaderboard → Standings** until the next GM publish.
5. Each GM event can only be published once (duplicate publishes are blocked).

### Step-by-step: Officer looks up a member’s points

1. Officer goes to **Members** → `/officer/members`.
2. Use search (name/email), **JT filter**, or **sign-in status filter** (Signed in / Not signed in).
3. Review the **Sign-in** column:
  - **Signed in** — member has linked their Google account (`auth_uid` set)
  - **Not signed in** — roster-imported member who has not logged in yet
4. The page header shows how many active members have not signed in.
5. Navigate pages (25 members per page).
6. Click a member row → `/officer/members/[id]` for full breakdown, sign-in status, and attendance history.

---

## 5. Attendance corrections

### Overview

**Presence** is officer-managed: check in or remove a check-in. **Points** (`attendance.counted`) are system-managed by caps (Sports Spectator semester limit; weekly Jiating Event / Mixer limit). Cap-limited attendance stays on the list with a Cap reached badge and does not add points — do not remove someone just because they hit a cap.

### Step-by-step: Correct a mistaken check-in

1. Open the event on Officer Events → event detail, or use the check-in page.
2. Find the person who was checked in by mistake.
3. Click **Remove** (event detail) or uncheck (check-in page) and confirm.
4. That deletes their attendance for the event. If the check-in was counting toward points, their total updates after refresh.

Use remove only when they were **not** at the event. If they attended but points do not apply because of a cap, leave the row.

---

## 6. Role management

### Overview

Roles (`member`, `officer`, `admin`) control access to officer and admin pages. RLS policies prevent officers from elevating roles. Admins manage roles in the app.

### Step-by-step: Promote or demote a member

1. Sign in as an admin and go to **Admin** → **Members** → **Roles** (`/admin/members?tab=roles`).
2. Search by name/email and optionally filter by current role.
3. Choose the new role (`Member`, `Officer`, or `Admin`) and click **Save**.
  - Promoting to **Admin** asks for confirmation (full access including roles and semesters).
  - Demoting yourself away from admin asks for confirmation.
  - You cannot demote the **last remaining admin**.
4. The member should refresh (or sign out/in) so nav picks up officer/admin access.

Only **active** members appear on the Roles tab. Pending JT members must be activated first.

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

Track the roadmap in [GitHub Issues](https://github.com/tamucsa/points/issues?q=is%3Aissue+is%3Aopen+label%3Aplanned-feature) (`planned-feature` label).

Bugs and debt on existing behavior: [known-issue issues](https://github.com/tamucsa/points/issues?q=is%3Aissue+is%3Aopen+label%3Aknown-issue).

> **Attendance corrections:** Officers remove mistaken check-ins from the check-in page or event detail. `counted` is set by caps, not by officers.

