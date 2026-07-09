import { notFound, redirect } from 'next/navigation'
import OfficerCheckinClient from '@/app/(dashboard)/(officer)/officer/events/[id]/checkin/components/OfficerCheckinClient'
import { createServerSupabase } from '@/utils/supabase/server'

export default async function OfficerCheckinPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerSupabase()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { data: officer } = await supabase
    .from('members')
    .select('role')
    .eq('auth_uid', user.id)
    .maybeSingle()

  if (!officer || !['officer', 'admin'].includes(officer.role)) {
    redirect('/leaderboard')
  }

  const { data: event } = await supabase
    .from('events')
    .select('id, name, category, point_value, event_date, semester_id, check_in_type')
    .eq('id', id)
    .maybeSingle()

  if (!event) notFound()

  const { data: members } = await supabase
    .from('members')
    .select('id, full_name, preferred_name, email, profile_image_url, jt_family_id, jt_families(name, color)')
    .eq('status', 'active')
    .order('preferred_name')

  const { data: attendance } = await supabase
    .from('attendance')
    .select('member_id')
    .eq('event_id', id)

  const checkedInIds = new Set(attendance?.map(a => a.member_id) ?? [])

  const normalizedMembers = (members ?? []).map(m => {
    const jtFamily = Array.isArray(m.jt_families)
      ? m.jt_families[0] ?? null
      : (m.jt_families as { name: string; color: string } | null)

    return {
      id: m.id,
      full_name: m.full_name,
      preferred_name: m.preferred_name,
      email: m.email,
      profile_image_url: m.profile_image_url,
      jt_family: jtFamily?.name ?? null,
      jt_color: jtFamily?.color ?? null,
    }
  })

  return (
    <OfficerCheckinClient
      event={event}
      members={normalizedMembers}
      checkedInIds={checkedInIds}
    />
  )
}
