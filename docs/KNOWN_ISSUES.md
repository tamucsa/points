# Known Issues

Living document for bugs, limitations, and planned improvements. Update this file as issues are discovered, fixed, or deprioritized.

**How to use this doc:**
- Add new issues under **Open issues** with date, severity, and status.
- Rank open issues by severity (Critical → High → Medium → Low).
- Move noteworthy fixes to **Resolved issues** (include date / PR when useful); drop minor resolved items instead of archiving them forever.
- Link related docs (`OPERATIONS.md`, `ARCHITECTURE.md`) where helpful.

---

## Open issues

Ranked by severity.

### KI-004 — Leaderboard view performance at scale
- **Severity:** Medium (performance)
- **Status:** Open — partially mitigated
- **Last verified:** 2026-07-13
- **Description:** `v_current_leaderboard` still aggregates all active members on each query. At ~300 members with growing attendance, queries can slow even when the UI only displays 10 or 25 rows.
- **Mitigation applied:** Overall leaderboard `limit(10)`; jiatings page per-JT `limit(3)`; officer members pagination (25/page); attendance indexes (`20260606120000_leaderboard_perf_indexes.sql`).
- **Target:** Materialized view or precomputed `semester_summaries` refreshed on check-in.

### KI-003 — Attendance corrections still incomplete
- **Severity:** Low (operational)
- **Status:** Open — partially fixed
- **Last verified:** 2026-07-13
- **Description:** Officers can **remove a mistaken check-in** from the officer check-in page (`officerRemoveCheckIn`, two-step confirm). Remaining gaps:
  - No UI to set `counted = false` (record kept, points suppressed)
  - No correction controls on the event detail attendance list
  - Broader admin correction tooling still missing
- **Workaround:** Use check-in uncheck for wrong check-ins; for `counted` flips, edit the `attendance` row in Supabase.
- **Target:** Event-detail / admin correction UI covering remove and `counted`.

### KI-008 — Officer events attendance count fetches all rows
- **Severity:** Low (performance)
- **Status:** Open
- **Last verified:** 2026-07-13
- **Description:** `/officer/events` still selects every `attendance.event_id` for the semester and counts in JavaScript instead of a SQL `GROUP BY` / RPC.
- **Target:** Aggregated query or RPC for per-event counts.

### KI-005 — Duplicate auth/member queries in middleware
- **Severity:** Low (performance)
- **Status:** Open
- **Last verified:** 2026-07-13
- **Description:** `middleware.ts` still calls `getUser()` and queries `members.status` on every matched request. Dashboard layouts also load the member (cached helpers dedupe within the RSC tree, not with middleware).
- **Mitigation applied:** `React.cache()` helpers in `src/utils/supabase/auth.ts` for layout/page dedupe.
- **Target:** Reduce middleware DB work (e.g. JWT claim for status, or layout-only gating where safe).

### KI-007 — Sequential queries on profile page
- **Severity:** Low (performance)
- **Status:** Open
- **Last verified:** 2026-07-13
- **Description:** `/profile` still runs member → points → semester → attendance → history largely sequentially after auth. Attendance correctly depends on `semester.id`, but points / semester / history can overlap more.
- **Target:** `Promise.all` for independent fetches after member is known.

---

## Resolved issues

Only keeping fixes that mattered for security, access, or core ops. Minor UX/perf cleanups are omitted.

### KI-002 — No admin UI for role management
- **Severity:** Medium (operational)
- **Status:** Resolved (2026-07-13)
- **Description:** Promoting members to `officer` or `admin` required a direct database update.
- **Resolution:** Admin **Roles** tab at `/admin/members?tab=roles` with `updateMemberRole` (last-admin guard, confirm for promote-to-admin / self-demote).

### KI-001 — No admin UI for semester start/close
- **Severity:** Medium (operational)
- **Status:** Resolved (2026-07-10)
- **Description:** Starting or closing a semester required manual database steps.
- **Resolution:** Admin UI at `/admin/semesters` with close and start actions.

### KI-R002 — Missing check-in routes
- **Status:** Resolved
- **Description:** `/checkin/[code]` and `/officer/events/[id]/checkin` did not exist.
- **Fix:** Routes and client components with server actions.

### KI-R003 — `pending_jt` members could access dashboard
- **Status:** Resolved
- **Description:** Pending members could reach leaderboard/events/profile.
- **Fix:** Middleware + dashboard layout redirect to `/pending`.

### KI-R004 — Officer could set `role=admin` via RLS
- **Status:** Resolved
- **Description:** Overly broad officer UPDATE policy on `members`.
- **Fix:** RLS split — admin full update, officer limited (migration `20260606072504`).

### KI-R005 — `close_semester` publicly executable
- **Status:** Resolved
- **Description:** Any authenticated user could call `close_semester`.
- **Fix:** EXECUTE revoked from public/anon/authenticated; granted to `service_role` only.

### KI-R001 — Cookie modification error in Server Components
- **Status:** Resolved
- **Description:** Server pages called `cookieStore.set()` in Server Components.
- **Fix:** `createServerSupabase()` (read-only) vs `createActionSupabase()` (writable for actions).

### KI-R008 — CSV roster import blocked by RLS
- **Status:** Resolved (2026-07-10)
- **Description:** Admin CSV import failed inserting active roster rows under RLS.
- **Fix:** RLS updated for roster imports; service-role inserts after admin check.

---

## Adding a new issue

Use this template:

```markdown
### KI-XXX — Short title
- **Severity:** Critical / High / Medium / Low
- **Status:** Open / In progress / Partially fixed / Resolved
- **Last verified:** YYYY-MM-DD
- **Description:** What happens and when.
- **Workaround:** (if any)
- **Target:** Planned fix or timeline.
```
