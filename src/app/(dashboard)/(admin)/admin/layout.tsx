import { redirect } from 'next/navigation'
import AdminNav from '@/app/(dashboard)/(admin)/admin/components/AdminNav'
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

  return (
    <>
      <div className="mx-auto max-w-5xl px-6 pt-8 lg:px-8">
        <AdminNav />
      </div>
      {children}
    </>
  )
}
