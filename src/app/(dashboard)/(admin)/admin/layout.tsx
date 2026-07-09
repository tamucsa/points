import { redirect } from 'next/navigation'
import { getCurrentMember } from '@/utils/supabase/auth'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, member } = await getCurrentMember()

  if (!user) redirect('/')
  if (!member || member.role !== 'admin') {
    redirect('/leaderboard')
  }

  return <>{children}</>
}
