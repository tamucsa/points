import { createClient } from '@supabase/supabase-js'

/** Service-role client for admin-only operations (e.g. close_semester). */
export function createAdminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}
