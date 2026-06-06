import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/utils/supabase/server'

export default async function OfficerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createServerSupabase()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: member } = await supabase
    .from('members')
    .select('role')
    .eq('auth_uid', user.id)
    .maybeSingle()

  if (!member || !['officer', 'admin'].includes(member.role)) {
    redirect('/leaderboard')
  }

  return <>{children}</>
}
