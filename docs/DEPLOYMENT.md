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
- Never expose `SUPABASE_SERVICE_ROLE_KEY` to clients.
- `NEXT_PUBLIC_*` variables are public by definition.

## Database migrations

Migrations live in `supabase/migrations/`.

Operational recommendation:
- Apply migrations **before** deploying code that depends on them.
- For critical security fixes (RLS, function grants), apply immediately and verify.

## Post-deploy verification checklist

- Login works (TAMU domain enforcement).
- Redirects behave correctly for:
  - unauthenticated users
  - `pending_jt` members
  - active members
- Officer routes are inaccessible to non-officers.
- Admin routes are inaccessible to non-admins.
- Leaderboard renders and shows correct totals.
- Check-in flow works (self/QR and officer check-in).

