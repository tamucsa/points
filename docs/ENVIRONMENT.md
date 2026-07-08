# Environment Variables

This project uses Next.js App Router + Supabase. **Do not commit secrets**; only document variable *names* and purpose here.

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
- **Where to get it**: Your deployed site URL (e.g., Vercel production URL). For local dev, `http://localhost:3000`.

## Notes

- Variables prefixed with `NEXT_PUBLIC_` are embedded in the client bundle by Next.js and are safe only for **non-secret** values.
- All secrets must be server-only variables (no `NEXT_PUBLIC_` prefix).

