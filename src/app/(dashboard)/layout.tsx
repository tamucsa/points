import { redirect } from 'next/navigation'
import Sidebar from '@/app/components/layout/Sidebar'
import { getCurrentMember } from '@/utils/supabase/auth'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, member } = await getCurrentMember()

  if (!user) redirect('/login')
  if (!member) redirect('/register')

  if (member.status === 'pending_jt') redirect('/pending')

  return (
    <div className="flex min-h-screen bg-bg text-text lg:h-screen lg:overflow-hidden">
      <Sidebar member={member} />
      <main className="min-w-0 flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top_right,rgba(71,121,184,0.05),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(240,176,195,0.12),transparent_28%)] pt-14 lg:pt-0">
        {children}
      </main>
    </div>
  )
}
