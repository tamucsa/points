# Deployment

This doc describes how to deploy the app and safely manage secrets/migrations.

## Quickstart (Vercel-style)

1. Create a new project and connect the Git repository.
2. Set environment variables (see `docs/ENVIRONMENT.md`).
3. Deploy the `main` (or chosen) branch.
4. Apply any pending Supabase migrations from `supabase/migrations/`.

## Environments

Recommended environments:
- **Production**
- **Staging** (optional but strongly recommended)

Each environment should have:
- its own Supabase project (recommended), or
- separate Supabase schemas and strict access controls (more complex; not recommended for small teams).

## Secrets & configuration

- Store secrets only in your hosting provider’s secret manager.
- Never expose `SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`, or `GOOGLE_PLACES_API_KEY` to clients.
- `NEXT_PUBLIC_*` variables are public by definition.

## Database migrations

Migrations live in `supabase/migrations/`.

Operational recommendation:
- Apply migrations **before** deploying code that depends on them.
- For critical security fixes (RLS, function grants), apply immediately and verify.

## Post-deploy verification checklist

Smoke after every production deploy. Cap / season cases live in `docs/OPERATIONS.md` → **Verification checklists**.

- Homepage (`/`) loads with app description, sign-in, and links to Privacy Policy and Terms of Service.
- `/privacy` and `/terms` are publicly accessible without signing in.
- Sign-in works with a `@tamu.edu` Google account; a non-TAMU account is rejected.
- Redirects:
  - signed-out users hitting `/leaderboard` (or other gated routes) go to `/`
  - signed-in users with no `members` row go to `/register`
  - `pending_member` goes to `/pending` (cannot open the dashboard)
  - `active` members land on `/leaderboard`
- A regular member cannot open `/officer/*` or `/admin/*`.
- An officer can open `/officer/*` but not `/admin/*`.
- An admin can open both.
- `/leaderboard` renders for an active member (names and point totals, not an empty error state).
- Self/QR check-in (`/checkin/[code]`) records attendance for an active member.
- Officer check-in on `/officer/events/[id]/checkin` records attendance.
- Duplicate check-in for the same member + event is rejected.

## Google OAuth (production)

Production is hosted at `https://points.csatamu.org`. Google Cloud OAuth consent screen should use:

| Field | URL |
|-------|-----|
| App home page | `https://points.csatamu.org` |
| Privacy policy | `https://points.csatamu.org/privacy` |
| Terms of service | `https://points.csatamu.org/terms` |

Sign-in uses Supabase Google OAuth with basic scopes only (`openid`, `email`, `profile`). The app's callback route is `/api/auth/callback`; Google must also allow the Supabase project callback URL (`https://<project-ref>.supabase.co/auth/v1/callback`) on the OAuth client.

Operational notes:
- App must be **In production** (not Testing) for unrestricted member sign-in beyond the test-user cap.
- Only the three basic Google sign-in scopes should remain on the OAuth consent screen Data Access page.
- Brand verification in Google Cloud improves consent-screen trust (app name/logo); a Supabase custom auth domain requires a paid Supabase plan and is optional.

See `docs/ARCHITECTURE.md` for auth flow details and ownership transfer checklist.

## Google Calendar sync (CSA Member Calendar)

Eligible org events can be pushed to the shared CSA Member Calendar via a **service account** (not member OAuth). Sign-in scopes stay `openid` / `email` / `profile` only.

Before enabling in an environment:

1. Apply the migration that adds `events.google_event_id` (and related columns).
2. Complete the Google Calendar sharing steps and set `GOOGLE_*` variables described in `docs/ENVIRONMENT.md`.
3. Set `GOOGLE_CALENDAR_SYNC_ENABLED=true` only after the service account can write to the calendar.

Verify after enable: create an eligible test event (e.g. General Meeting or Howdy Week), confirm it appears on the CSA Member Calendar, then edit schedule/location and delete it — Calendar should update/remove accordingly. Mixer and Jiating Event must not appear.

## Google Places autocomplete

Officer location fields can suggest Places near campus via server routes `/api/places/autocomplete` and `/api/places/details`.

1. Enable **Places API (New)** and create a server API key (see `docs/ENVIRONMENT.md`).
2. Set `GOOGLE_PLACES_API_KEY` in Vercel.
3. Verify: on New Event, type `MSC`, pick a suggestion, save; also save a free-typed room like `MSC 2406` without picking.

Never expose the Places key as `NEXT_PUBLIC_*`.

## Scheduled event publishing

1. Migration for `events.publish_status` / `publish_at` / `published_at` (already applied on prod DB if you ran it).
2. Set `CRON_SECRET` in **Vercel** (see `docs/ENVIRONMENT.md`) and redeploy.
3. Set GitHub Actions secrets on the repo:
   - `CRON_SECRET` — same value as Vercel
   - `APP_URL` — `https://points.csatamu.org`
4. Workflow: `.github/workflows/publish-scheduled-events.yml` runs ~every 5 minutes (and can be run manually via **Actions** → **Publish scheduled events** → **Run workflow**).
5. Verify: schedule an event a few minutes ahead; after the workflow runs it should appear on member `/events` and (if eligible) on the Member Calendar.

**Hobby note:** Do not put a sub-daily schedule in `vercel.json` — Hobby rejects it at deploy time. Use GitHub Actions (or upgrade to Vercel Pro) for frequent publishing.

