# Admin Onboarding

This guide is for admins who manage member onboarding, roles, and operational settings.

## Access

Admins must have `members.role = 'admin'`. Admin pages are under `/admin/*`.

## Quickstart checklist

- Verify you can access the admin dashboard (e.g., pending members list).
- Confirm the active semester is correct.
- Confirm the Jiating list (`jt_families`) is accurate and active.

## Member onboarding workflow (pending → active)

### 1) Review pending members
Pending members are `members.status = 'pending_jt'`.

### 2) Assign Jiating
- Set `members.jt_family_id` for the member.

### 3) Activate
- Change status to `active`.

Result:
- Member gains access to dashboard pages (leaderboard/events/profile).

## Role management

### Promote to officer
- Update `members.role` to `officer`.

### Promote to admin
- Update `members.role` to `admin`.

Security note:
- Only admins should be able to change `role` or critical fields (enforced by RLS + server-side guards).

## Data integrity / corrections

### Attendance corrections
If a member was checked in incorrectly:
- Decide whether to remove attendance, mark it unverified, or mark it `counted = false` depending on the policy.

### Semester start / close
**Not yet available in the app.** Semester management will be added in a future admin UI. Until then, see interim database steps in `docs/OPERATIONS.md` § Semester lifecycle.

## Security operations

- Rotate high-value secrets (especially `SUPABASE_SERVICE_ROLE_KEY`) on any handoff or suspected exposure.
- Review and test RLS changes in staging before production.

