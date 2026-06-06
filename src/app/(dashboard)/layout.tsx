import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import Sidebar from '@/app/components/layout/Sidebar'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
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

  if (!user) return null

  const { data: member } = await supabase
    .from('members')
    .select('id, preferred_name, full_name, role, status, profile_image_url')
    .eq('auth_uid', user.id)
    .single()

  if (!member) {
    return null
  }

  return (
    <div className="flex min-h-screen bg-bg text-text">
      <Sidebar member={member} />
      <main className="flex-1 overflow-auto bg-[radial-gradient(circle_at_top_right,rgba(71,121,184,0.05),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(240,176,195,0.12),transparent_28%)]">
        {children}
      </main>
    </div>
  )
}