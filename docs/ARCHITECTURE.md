# Architecture (Developer Onboarding + Project Transfer)

This document explains how the system is structured, how requests flow through the app, and what to know when transferring ownership.

## TL;DR (Quickstart mental model)

- **Frontend**: Next.js (App Router) pages + client components.
- **Backend**: Supabase (Postgres + Auth + RLS).
- **Auth**: Supabase OAuth → `/api/auth/callback` exchanges code for session, enforces TAMU domain, and links auth users to `members`.
- **Authorization**: RLS policies in Supabase + server-side guards in layouts/routes.
- **Points**: Counted attendance points are rolled into `member_semester_points` on check-in / uncheck / related event updates. `v_current_leaderboard` reads those cached totals for the active semester.

## Repository layout

- `src/app/`: Next.js routes, layouts, server components, and client components.
  - `(auth)/`: public homepage (`/`), sign-in, registration, pending onboarding, and legal pages (`/privacy`, `/terms`). `/login` redirects to `/` for backward compatibility.
  - `(dashboard)/`: authenticated app shell + pages (leaderboard/events/profile)
  - `(dashboard)/(officer)/officer`: officer tools
  - `(dashboard)/(admin)/admin`: admin tools (`/admin/members`, `/admin/semesters`)
  - `api/auth/*`: Supabase session exchange + signout
  - `checkin/[code]`: QR/self check-in entry
- `src/utils/supabase/`: Supabase client factories for different runtime contexts
  - `server.ts`: Server Components (read-only cookies)
  - `action.ts`: Server Actions (writable cookies)
  - `admin.ts`: Service-role client for admin-only operations (semester close, roster import inserts, JT transfer logging)
  - `client.ts`: Browser client
  - `auth.ts`: cached helpers (`getAuthUser`, `getCurrentMember`, `getActiveSemester`) to deduplicate auth/member lookups in a single request; prefer these in dashboard RSC pages over raw `createServerSupabase()` + `getUser()`
- `supabase/migrations/`: SQL migrations for schema/views/security/indexes.

## Data model (high-level)

Core tables (names reflect actual schema):
- `members`: one row per person (email, role, status, jt family, auth uid)
- `events`: point-earning opportunities; has scope (CSA-wide / JT shared / JT specific)
- `event_jt_families`: which Jiatings participate in a Mixer (and similar multi-family events)
- `attendance`: joins members to events; source of points
- `member_semester_points`: cached counted point totals per member per semester; maintained by triggers on attendance / event category·point changes; backing store for `v_current_leaderboard`
- `semesters`: identifies the active semester
- `jt_families`: Jiating / family grouping
- `semester_summaries`: optional historical rollups per member per semester
- `jt_transfer_log`: audit log of Jiating changes from spring CSV imports
- `jt_leaderboard_snapshots` / `jt_leaderboard_snapshot_rows`: frozen Jiating standings published after GM
- `years`, `semester_families`: configuration/support tables

### Member name field

`members.full_name` is the only name column — shown on the leaderboard, member lists, and profile.

- **Self-registration** (`/register`): first and last name from the form are concatenated into `full_name`.
- **Admin CSV import**: roster columns map to `full_name`, email, phone, class (stored as `graduation_year`), and **Jiating** (resolved to `jt_family_id`). New rows are inserted as `active`; existing emails get diff-based updates only. Jiating transfers are logged to `jt_transfer_log`. Inserts use the service-role client after an admin server-action check.

Registration helpers live in `src/utils/members.ts`.

Derived views / RPCs (used by UI):
- `v_current_leaderboard`: active members + points breakdown for the active semester from `member_semester_points` (not a live re-sum of all attendance); includes `account_linked` (`auth_uid IS NOT NULL`) for officer sign-in status (not shown on public leaderboard UI)
- `v_jt_leaderboard`: per-jiating aggregation for the active semester (source for GM snapshot publish)
- `attendance_counts_for_semester(semester_id)`: per-event attendance counts for Officer Events (SQL `GROUP BY`, not a full attendance row fetch)
- `top_leaderboard_members_per_jt(limit)`: top N members per Jiating for `/leaderboard/jiatings` without loading the full leaderboard
- `close_semester(semester_id)`: archives `member_semester_points` into `semester_summaries` and deactivates the semester (service role)

## Request flow

### 1) Middleware gating
`middleware.ts` enforces:
- Session cookie refresh via `getUser()` (no `members` DB lookup).
- Unauthenticated users are redirected to `/` (except public routes).
- Signed-in users hitting `/` or `/login` go to `/leaderboard`.

Public routes (no sign-in required): `/`, `/login` (redirects to `/` when logged out; signed-in users go to `/leaderboard`), `/register`, `/pending`, `/privacy`, `/terms`, `/checkin/*`, `/api/auth/*`.

### 2) Layout gating
`src/app/(dashboard)/layout.tsx` loads the current member (`getCurrentMember`) and:
- redirects missing members to `/register`
- redirects `pending_jt` to `/pending`
- renders the app shell (`Sidebar` + page content)

`pending` page redirects active members to `/leaderboard`. Officer/admin sections have their own layouts that enforce role membership.

### 3) Data fetching
Most routes fetch data via Supabase server client.

Performance note:
- Use cached helpers in `src/utils/supabase/auth.ts` to avoid repeated `getUser()`/member queries.
- `/profile` reuses those helpers and loads points, attendance, and history with `Promise.all` after member + semester are known.
- Unbounded selects can silently truncate near PostgREST `max-rows` (~1000). Prefer `fetchAllPages` (`src/utils/supabase/fetchAll.ts`), SQL aggregation RPCs (e.g. `attendance_counts_for_semester`, `top_leaderboard_members_per_jt`), or `count`/`head` queries.

## Schema / migrations ownership

- New DB changes belong in `supabase/migrations/*.sql` and must be applied to production before code that depends on them.
- Migrations are **not** a complete bootstrap of production. See `docs/LOCAL_SETUP.md` → **Baseline schema gap**.
- Semester close archives cached totals via `close_semester(p_semester_id)` (service role only).

## Auth & onboarding

### OAuth callback
`src/app/api/auth/callback/route.ts`:
- Exchanges OAuth code for a Supabase session (sets cookies).
- Rejects non-`@tamu.edu` accounts.
- Uses `SUPABASE_SERVICE_ROLE_KEY` to find/link a matching `members` row:
  - first by `auth_uid`
  - then by email
- Redirects users to:
  - `/register` if no member row exists,
  - `/pending` if member is pending JT assignment,
  - `/leaderboard` otherwise.

### Member lifecycle states
`members.status` is an enum-like field used for gating:
- `pending_jt`: needs admin assignment to a Jiating
- `active`: full access
- (others may exist: alumni/inactive, depending on schema)

## Role model

`members.role` controls access:
- `member`: normal access
- `officer`: officer pages + check-in tools
- `admin`: admin pages + officer pages

## Operations & ownership transfer checklist

### Access you must transfer
- Supabase project owner access
- GitHub repo admin access
- Vercel project access (or hosting provider equivalent)
- Google OAuth configuration ownership (client + redirect URIs)

### Secrets to rotate on transfer
- `SUPABASE_SERVICE_ROLE_KEY`
- Any OAuth secrets stored in hosting provider

### Key “source of truth” locations
- Schema + RLS + views: `supabase/migrations/*.sql`
- Auth callback logic: `src/app/api/auth/callback/route.ts`
- Auth gating: `middleware.ts` and dashboard/officer/admin layouts

