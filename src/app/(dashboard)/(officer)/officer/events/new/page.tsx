import { redirect } from 'next/navigation'
import NewEventClient from '@/app/(dashboard)/(officer)/officer/events/components/NewEventClient'
import { createServerSupabase } from '@/utils/supabase/server'

export default async function NewEventPage() {
  const supabase = await createServerSupabase()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { data: member } = await supabase
    .from('members')
    .select('id, jt_family_id')
    .eq('auth_uid', user.id)
    .maybeSingle()

  if (!member) redirect('/')

  const { data: semester } = await supabase
    .from('semesters')
    .select('id, name')
    .eq('is_active', true)
    .maybeSingle()

  const { data: jtFamilies } = await supabase
    .from('jt_families')
    .select('id, name')
    .eq('is_active', true)
    .order('name')

  return (
    <NewEventClient
      semesterId={semester?.id ?? ''}
      semesterName={semester?.name ?? ''}
      jtFamilies={jtFamilies ?? []}
      officerJtFamilyId={member.jt_family_id}
      createdBy={member.id}
    />
  )
}
