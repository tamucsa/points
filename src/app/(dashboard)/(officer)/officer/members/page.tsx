import { redirect } from 'next/navigation'
import MembersClient from '@/app/(dashboard)/(officer)/officer/members/components/MembersClient'
import { createServerSupabase } from '@/utils/supabase/server'

export default async function MembersPage() {
  const supabase = await createServerSupabase()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: members } = await supabase
    .from('v_current_leaderboard')
    .select('*')
    .order('total_points', { ascending: false })

  const { data: semester } = await supabase
    .from('semesters')
    .select('name')
    .eq('is_active', true)
    .single()

  return (
    <MembersClient
      members={members ?? []}
      semester={semester}
    />
  )
}