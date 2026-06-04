import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import NewEventClient from '@/app/(dashboard)/(officer)/officer/events/components/NewEventClient'

export default async function NewEventPage() {
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
  if (!user) redirect('/login')

  const { data: member } = await supabase
    .from('members')
    .select('id, role, jt_family_id')
    .eq('auth_uid', user.id)
    .single()

  if (!member) redirect('/login')

  const { data: semester } = await supabase
    .from('semesters')
    .select('id, name')
    .eq('is_active', true)
    .single()

  const { data: jtFamilies } = await supabase
    .from('jt_families')
    .select('id, name')
    .eq('is_active', true)

  return (
    <NewEventClient
      semesterId={semester?.id ?? ''}
      semesterName={semester?.name ?? ''}
      jtFamilies={jtFamilies ?? []}
      officerJtFamilyId={member.jt_family_id}
      createdBy={member.id}
      isAdmin={member.role === 'admin'}
    />
  )
}