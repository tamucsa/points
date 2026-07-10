import { redirect } from 'next/navigation'
import { getCurrentMember } from '@/utils/supabase/auth'

export default async function OfficerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, member } = await getCurrentMember()

  if (!user) redirect('/')
  if (!member || !['officer', 'admin'].includes(member.role)) {
    redirect('/leaderboard')
  }

  return <>{children}</>
}
