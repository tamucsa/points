import { redirect } from 'next/navigation'
import { canAccessOfficerMembers } from '@/utils/members'
import { getCurrentMember } from '@/utils/supabase/auth'

export default async function OfficerMembersLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, member } = await getCurrentMember()

  if (!user) redirect('/')
  if (!member || !canAccessOfficerMembers(member)) {
    redirect('/officer/events')
  }

  return <>{children}</>
}
