import { redirect } from 'next/navigation'
import AdminMembersClient from '@/app/(dashboard)/(admin)/admin/members/components/AdminMembersClient'
import { createServerSupabase } from '@/utils/supabase/server'

export default async function AdminMembersPage() {
  const supabase = await createServerSupabase()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  // Pending members
  const { data: pending } = await supabase
    .from('members')
    .select('id, full_name, email, graduation_year, created_at')
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