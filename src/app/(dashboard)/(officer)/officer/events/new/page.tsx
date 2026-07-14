import { redirect } from 'next/navigation'
import NewEventClient from '@/app/(dashboard)/(officer)/officer/events/components/NewEventClient'
import { getActiveSemester, getCurrentMember } from '@/utils/supabase/auth'

export default async function NewEventPage() {
  const [{ supabase, member }, semester] = await Promise.all([
    getCurrentMember(),
    getActiveSemester(),
  ])

  if (!member) redirect('/')

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
