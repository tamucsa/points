import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import AdminMembersClient from '@/app/(dashboard)/(admin)/admin/members/components/AdminMembersClient'

export default async function AdminMembersPage() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll() {},
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Pending members
  const { data: pending } = await supabase
    .from('members')
    .select('id, full_name, preferred_name, email, graduation_year, created_at')
    .eq('status', 'pending_jt')
    .order('created_at', { ascending: true })

  // JT families for assignment dropdown
  const { data: jtFamilies } = await supabase
    .from('jt_families')
    .select('id, name')
    .eq('is_active', true)

  return (
    <AdminMembersClient
      pending={pending ?? []}
      jtFamilies={jtFamilies ?? []}
    />
  )
}