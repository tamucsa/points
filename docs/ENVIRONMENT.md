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

## Notes

- Variables prefixed with `NEXT_PUBLIC_` are embedded in the client bundle by Next.js and are safe only for **non-secret** values.
- All secrets must be server-only variables (no `NEXT_PUBLIC_` prefix).

