import { redirect } from 'next/navigation'
import Sidebar from '@/app/components/layout/Sidebar'
import { createServerSupabase } from '@/utils/supabase/server'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createServerSupabase()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: member } = await supabase
    .from('members')
    .select('id, preferred_name, full_name, role, status, profile_image_url')
    .eq('auth_uid', user.id)
    .maybeSingle()

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
