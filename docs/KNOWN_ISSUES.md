# Known Issues

Living document for bugs, limitations, and planned improvements. Update this file as issues are discovered, fixed, or deprioritized.

**How to use this doc:**
- Add new issues at the bottom with date, severity, and status.
- Move items to **Resolved** when fixed (include PR/commit reference).
- Link related docs (`OPERATIONS.md`, `ARCHITECTURE.md`) where helpful.

---

## Resolved issues

### KI-001 — No admin UI for semester start/close
- **Severity:** Medium (operational)
- **Status:** Resolved (2026-07-10)
- **Description:** Starting or closing a semester required manual database steps.
- **Resolution:** Admin UI at `/admin/semesters` with close and start actions.

## Open issues
### KI-002 — No admin UI for role management
- **Severity:** Medium (operational)
- **Status:** Open — planned feature
- **Description:** Promoting members to `officer` or `admin` requires a direct database update. No in-app UI exists.
- **Workaround:** Supabase admin updates `members.role` manually.
- **Target:** Future admin UI.

### KI-003 — No UI for attendance corrections
- **Severity:** Medium (operational)
- **Status:** Open — planned feature
- **Description:** Officers cannot undo or correct mistaken check-ins from the app. Corrections require database access.
- **Workaround:** Delete or set `counted = false` on the `attendance` row in Supabase.
- **Target:** Future admin/officer UI.

### KI-004 — Leaderboard view performance at scale
- **Severity:** Medium (performance)
- **Status:** Open — partially mitigated
- **Description:** `v_current_leaderboard` aggregates all members on every query. At ~300 members with growing attendance, page loads may slow even when only 10 or 25 rows are returned.
- **Mitigation applied:** Pagination (25/page) on officer members; `limit(10)` on overall leaderboard; per-JT `limit(3)` on jiatings page; attendance indexes migration (`20260606120000_leaderboard_perf_indexes.sql`).
- **Target:** Materialized view or precomputed `semester_summaries` refreshed on check-in.

### KI-005 — Duplicate auth/member queries in middleware
- **Severity:** Low (performance)
- **Status:** Open
- **Description:** `middleware.ts` calls `getUser()` and queries `members.status` on every request. Dashboard layouts also fetch the member via cached helpers, but middleware still adds a round-trip before the page renders.
- **Mitigation applied:** `React.cache()` helpers in `src/utils/supabase/auth.ts` deduplicate within a single request.
- **Target:** Reduce middleware DB query (e.g., JWT claim for status, or layout-only gating).

### KI-006 — Register page blank while loading
- **Severity:** Low (UX)
- **Status:** Open
- **Description:** `/register` returns `null` while checking auth state, showing a blank screen briefly instead of a loading indicator.
- **Workaround:** None needed; page loads quickly in practice.
- **Target:** Add spinner/skeleton during auth check.

### KI-007 — Sequential queries on profile page
- **Severity:** Low (performance)
- **Status:** Open
- **Description:** `/profile` runs multiple sequential Supabase queries (member → points → semester → attendance → history) after layout auth.
- **Target:** Batch with `Promise.all` where dependencies allow.

### KI-008 — Officer events attendance count fetches all rows
- **Severity:** Low (performance)
- **Status:** Open
- **Description:** `/officer/events` loads every `attendance` row for the semester and counts in JavaScript instead of using a SQL `GROUP BY`.
- **Target:** SQL aggregation or RPC for per-event counts.

---

## Resolved issues

### KI-R001 — Cookie modification error in Server Components
- **Status:** Resolved
- **Description:** `officer/layout.tsx` and other server pages called `cookieStore.set()` in Server Components, causing Next.js errors.
- **Fix:** Introduced `createServerSupabase()` (read-only cookies) and `createActionSupabase()` (writable cookies for Server Actions).

### KI-R002 — Missing check-in routes
- **Status:** Resolved
- **Description:** `/checkin/[code]` and `/officer/events/[id]/checkin` did not exist; check-in flow was non-functional.
- **Fix:** Routes and client components implemented with server actions.

### KI-R003 — `pending_jt` members could access dashboard
- **Status:** Resolved
- **Description:** Members awaiting Jiating assignment could reach leaderboard/events/profile.
- **Fix:** Middleware + dashboard layout redirect `pending_jt` to `/pending`.

### KI-R004 — Officer could set `role=admin` via RLS
- **Status:** Resolved
- **Description:** Overly broad officer UPDATE policy on `members`.
- **Fix:** RLS split: admin full update, officer limited update (migration `20260606072504`).

### KI-R005 — `close_semester` publicly executable
- **Status:** Resolved
- **Description:** Any authenticated user could call `close_semester`.
- **Fix:** EXECUTE revoked from public/anon/authenticated; granted to `service_role` only.

### KI-R006 — Officer members page loaded all members
- **Status:** Resolved
- **Description:** `/officer/members` fetched entire leaderboard view (~300 rows).
- **Fix:** Server-side pagination (25/page) with search and JT filter.

### KI-R007 — Jiatings leaderboard loaded all members
- **Status:** Resolved
- **Description:** `/leaderboard/jiatings` fetched all members and filtered top 3 in JS.
- **Fix:** Per-JT query with `limit(3)`.

---

## Adding a new issue

Use this template:

```markdown
### KI-XXX — Short title
- **Severity:** Critical / High / Medium / Low
- **Status:** Open / In progress / Resolved
- **Description:** What happens and when.
- **Workaround:** (if any)
- **Target:** Planned fix or timeline.
```
