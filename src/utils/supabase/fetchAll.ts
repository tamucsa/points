import type { PostgrestError } from '@supabase/supabase-js'

/** PostgREST default max-rows; keep page size at the limit so we never silently truncate. */
export const POSTGREST_PAGE_SIZE = 1000

/**
 * Fetches all rows for a query that would otherwise hit PostgREST max-rows (~1000).
 * `fetchPage` must apply `.range(from, to)` (inclusive) each call on a fresh query builder.
 */
export async function fetchAllPages<T>(
  fetchPage: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: PostgrestError | null }>,
): Promise<{ data: T[]; error: PostgrestError | null }> {
  const all: T[] = []
  let from = 0

  for (;;) {
    const to = from + POSTGREST_PAGE_SIZE - 1
    const { data, error } = await fetchPage(from, to)
    if (error) return { data: all, error }

    const rows = data ?? []
    all.push(...rows)
    if (rows.length < POSTGREST_PAGE_SIZE) break
    from += POSTGREST_PAGE_SIZE
  }

  return { data: all, error: null }
}
