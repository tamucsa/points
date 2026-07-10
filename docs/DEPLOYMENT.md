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

- Homepage (`/`) loads with app description, sign-in, and links to Privacy Policy and Terms of Service.
- `/privacy` and `/terms` are publicly accessible.
- Sign-in works (TAMU domain enforcement).
- Redirects behave correctly for:
  - unauthenticated users
  - `pending_jt` members
  - active members
- Officer routes are inaccessible to non-officers.
- Admin routes are inaccessible to non-admins.
- Leaderboard renders and shows correct totals.
- Check-in flow works (self/QR and officer check-in).

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

