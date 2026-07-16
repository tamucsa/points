# Environment Variables

This project uses Next.js App Router + Supabase. **Do not commit secrets**; only document variable *names* and purpose here.

## Getting variables locally (recommended)

This project is deployed on **Vercel**. For local development, pull env vars from the Vercel project instead of copying them by hand.

1. Log in (one-time):

```bash
npx vercel login
```

2. Link the repo to the Vercel project (one-time per machine):

```bash
npx vercel link
```

Select the correct team and the **CSA Points** project when prompted.

3. Pull into `.env.local`:

```bash
npx vercel env pull .env.local --environment=development
```

Use `--environment=preview` or `--environment=production` only when you intentionally need those values locally.

If a variable is missing after pulling, add it in Vercel (Project → Settings → Environment Variables) for the target environment, then pull again.

## Required

### `NEXT_PUBLIC_SUPABASE_URL`
- **Purpose**: Supabase project URL used by browser and server clients.
- **Where to get it**: Supabase project settings → API → Project URL.

### `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **Purpose**: Public (anon) key used by the app for authenticated user operations under RLS.
- **Where to get it**: Supabase project settings → API → anon/public key.

### `SUPABASE_SERVICE_ROLE_KEY`
- **Purpose**: Server-only key used in server routes for admin operations (e.g., linking auth accounts to existing member rows in the OAuth callback).
- **Where to get it**: Supabase project settings → API → service_role key.
- **Security**: Must **never** be exposed to the browser. Only used in Route Handlers / server contexts.

### `NEXT_PUBLIC_SITE_URL`
- **Purpose**: Fallback base URL for generating absolute links when request headers don’t include host/proto (used by officer QR page).
- **Where to get it**: Production: `https://points.csatamu.org`. For local dev, `http://localhost:3000`.

## Optional — Google Calendar sync (CSA Member Calendar)

App → Google pushes eligible org events to the shared **CSA Member Calendar**. Members’ Google sign-in scopes are unchanged; sync uses a **service account**, not user OAuth.

### Setup (one-time in Google Cloud / Calendar)

1. In the Google Cloud project for `tamu.csa1963@gmail.com`, enable the **Google Calendar API**.
2. Create or reuse a service account and download a JSON key (or copy `client_email` + `private_key`).
3. Open the **CSA Member Calendar** in Google Calendar → Settings and sharing → Share with people → add the service account `client_email` with **Make changes to events**.
4. Copy the calendar’s **Calendar ID** from Integrate calendar (often `...@group.calendar.google.com`).
5. Set the variables below in Vercel (and pull into `.env.local` for local testing).

### `GOOGLE_CALENDAR_SYNC_ENABLED`
- **Purpose**: Kill switch. Must be `true` for sync to run; anything else (or unset) disables sync.
- **Security**: Server-only.

### `GOOGLE_CALENDAR_ID`
- **Purpose**: Target calendar ID (CSA Member Calendar).
- **Security**: Server-only (not a secret by itself, but keep with other config).

### `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- **Purpose**: Service account `client_email` from the JSON key.
- **Security**: Server-only.

### `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`
- **Purpose**: Service account `private_key` PEM. In env files, newlines are often stored as `\n`; the app expands them.
- **Security**: Must **never** be exposed to the browser.

When credentials are missing or sync is disabled, event create/update/delete in the App still succeed; Calendar writes are skipped.

## Optional — Google Places autocomplete

Officer event create/edit location fields can suggest Places near Texas A&M. Free-text entry always works without selecting a suggestion. Requests go through authenticated server routes (`/api/places/*`); the API key stays server-only.

### Setup (one-time in Google Cloud)

1. In the same Google Cloud project (or another with billing enabled), enable **Places API (New)**.
2. Create an **API key** restricted to Places API (New) only. Prefer application/IP restrictions suitable for server-side use (HTTP referrer restrictions do not apply to server routes).
3. Set `GOOGLE_PLACES_API_KEY` in Vercel for the target environments, then pull locally if needed.

### `GOOGLE_PLACES_API_KEY`
- **Purpose**: Server-only key for Places Autocomplete (New) + Place Details (New).
- **Security**: Must **never** be exposed to the browser (`NEXT_PUBLIC_` not allowed).
- When unset, location fields behave as plain text inputs (no suggestions).

## Optional — Scheduled event publish (GitHub Actions)

Draft / scheduled events become visible to members when published. A **GitHub Actions** workflow calls `/api/cron/publish-events` about every 5 minutes to publish rows whose `publish_at` has passed (America/Chicago wall times stored as UTC).

**Why not Vercel Cron on Hobby?** Hobby allows at most **one cron run per day**, with timing only accurate within that hour. Expressions like `*/5 * * * *` **fail deployment** on Hobby. Pro supports per-minute crons; we use GitHub Actions so Hobby stays accurate without upgrading.

### `CRON_SECRET`
- **Purpose**: Shared secret; requests must send `Authorization: Bearer <CRON_SECRET>`.
- **Where to get it**: Generate yourself, e.g. `openssl rand -hex 32`. Not from a dashboard.
- **Where to set it**:
  1. **Vercel** → Project → Settings → Environment Variables → `CRON_SECRET` (Production; Preview optional). Redeploy after adding.
  2. **GitHub** → repo → Settings → Secrets and variables → Actions → New repository secret → same name `CRON_SECRET` (same value).
- **Security**: Server-only. Never expose as `NEXT_PUBLIC_*`.

### `APP_URL` (GitHub Actions only)
- **Purpose**: Production site origin the workflow curls, e.g. `https://your-app.vercel.app` (no trailing slash).
- **Where to set it**: GitHub Actions repository secret `APP_URL`.

Officers can always use **Publish now** if a schedule is delayed.

## Notes

- Variables prefixed with `NEXT_PUBLIC_` are embedded in the client bundle by Next.js and are safe only for **non-secret** values.
- All secrets must be server-only variables (no `NEXT_PUBLIC_` prefix).

