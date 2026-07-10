# Local Setup (Developers)

This doc is the **authoritative** setup guide for onboarding new developers.

## Quickstart

1. Install dependencies:

```bash
npm install
```

2. Set up `.env.local` — follow `docs/ENVIRONMENT.md` (Vercel pull workflow).

3. Start the dev server:

```bash
npm run dev
```

App runs at `http://localhost:3000`.

## Requirements

- **Node.js**: recommend latest LTS.
- **Package manager**: `npm` is supported and used in CI examples.
- **Supabase**: you need either:
  - **Hosted Supabase** project credentials (recommended for onboarding), or
  - **Local Supabase** stack (optional; only if your team uses it).

## Database migrations

Migrations live in `supabase/migrations/`.

- When using **hosted Supabase**, apply migrations using the Supabase dashboard SQL editor or the Supabase CLI (team preference).
- When using **local Supabase**, apply migrations via the CLI workflow (if enabled for your team).

## Sanity checks

After setup:

```bash
npm run build
```

If build passes, your local environment is configured correctly.

## Common issues

### Login redirects loop
- Usually caused by missing/incorrect `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

### OAuth callback fails
- Ensure your Google OAuth redirect URI includes the Supabase project callback (`https://<project-ref>.supabase.co/auth/v1/callback`), copied from Supabase Dashboard → Authentication → Providers → Google.
- The app exchanges the session at `/api/auth/callback` after Supabase redirects back.

### Public routes during development
- Sign-in and homepage: `/` ( `/login` redirects here ).
- Legal pages: `/privacy`, `/terms` (no auth required).
- Unauthenticated access to other routes redirects to `/`.

### QR page missing origin
- Set `NEXT_PUBLIC_SITE_URL` for environments where `x-forwarded-host`/`host` headers aren’t present.

