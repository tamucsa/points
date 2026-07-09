# Architecture (Developer Onboarding + Project Transfer)

This document explains how the system is structured, how requests flow through the app, and what to know when transferring ownership.

## TL;DR (Quickstart mental model)

- **Frontend**: Next.js (App Router) pages + client components.
- **Backend**: Supabase (Postgres + Auth + RLS).
- **Auth**: Supabase OAuth → `/api/auth/callback` exchanges code for session, enforces TAMU domain, and links auth users to `members`.
- **Authorization**: RLS policies in Supabase + server-side guards in layouts/routes.
- **Points**: Aggregated from `attendance` and `events` for the active semester (see leaderboard views).

## Repository layout

- `src/app/`: Next.js routes, layouts, server components, and client components.
  - `(auth)/`: public homepage (`/`), sign-in, registration, pending onboarding, and legal pages (`/privacy`, `/terms`). `/login` redirects to `/` for backward compatibility.
  - `(dashboard)/`: authenticated app shell + pages (leaderboard/events/profile)
  - `(dashboard)/(officer)/officer`: officer tools
  - `(dashboard)/(admin)/admin`: admin tools
  - `api/auth/*`: Supabase session exchange + signout
  - `checkin/[code]`: QR/self check-in entry
- `src/utils/supabase/`: Supabase client factories for different runtime contexts
  - `server.ts`: Server Components (read-only cookies)
  - `action.ts`: Server Actions (writable cookies)
  - `client.ts`: Browser client
  - `auth.ts`: cached helpers to deduplicate auth/member lookups in a single request
- `supabase/migrations/`: SQL migrations for schema/views/security/indexes.

## Data model (high-level)

Core tables (names reflect actual schema):
- `members`: one row per person (email, role, status, jt family, auth uid)
- `events`: point-earning opportunities; has scope (CSA-wide / JT shared / JT specific)
- `attendance`: joins members to events; source of points
- `semesters`: identifies the active semester
- `jt_families`: Jiating / family grouping
- `semester_summaries`: optional historical rollups per member per semester
- `years`, `semester_families`: configuration/support tables

Derived views (used by UI):
- `v_current_leaderboard`: active members + points breakdown for the active semester
- `v_jt_leaderboard`: per-jiating aggregation for the active semester

## Request flow

### 1) Middleware gating
`middleware.ts` enforces:
- Unauthenticated users are redirected to `/` (except public routes).
- `pending_jt` users are restricted to onboarding routes.

Public routes (no sign-in required): `/`, `/login` (redirects to `/`), `/register`, `/pending`, `/privacy`, `/terms`, `/checkin/*`, `/api/auth/*`.

### 2) Layout gating
`src/app/(dashboard)/layout.tsx` loads the current member and renders the app shell (`Sidebar` + page content). Officer/admin sections have their own layouts that enforce role membership.

### 3) Data fetching
Most routes fetch data via Supabase server client.

Performance note:
- Use cached helpers in `src/utils/supabase/auth.ts` to avoid repeated `getUser()`/member queries.

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

