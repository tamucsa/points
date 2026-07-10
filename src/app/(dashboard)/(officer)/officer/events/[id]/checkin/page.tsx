import { notFound, redirect } from 'next/navigation'
import OfficerCheckinClient from '@/app/(dashboard)/(officer)/officer/events/[id]/checkin/components/OfficerCheckinClient'
import { createServerSupabase } from '@/utils/supabase/server'

function memberRoleLabel(role: string): 'Member' | 'Officer' {
  return role === 'officer' || role === 'admin' ? 'Officer' : 'Member'
}

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
    .select(`
      id,
      name,
      category,
      point_value,
      starts_at,
      ends_at,
      semester_id,
      check_in_type,
      scope,
      jt_family_id,
      jt_families ( name )
    `)
    .eq('id', id)
    .maybeSingle()

  if (!event) notFound()

  let membersQuery = supabase
    .from('members')
    .select('id, full_name, email, profile_image_url, role, jt_family_id, jt_families(name, color)')
    .eq('status', 'active')
    .order('full_name')

  if (event.scope === 'jt_specific' && event.jt_family_id) {
    membersQuery = membersQuery.eq('jt_family_id', event.jt_family_id)
  }

  const { data: members } = await membersQuery

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
      email: m.email,
      profile_image_url: m.profile_image_url,
      jt_color: jtFamily?.color ?? null,
      role_label: memberRoleLabel(m.role),
    }
  })

  const jtFamily = Array.isArray(event.jt_families)
    ? event.jt_families[0] ?? null
    : (event.jt_families as { name: string } | null)

  return (
    <OfficerCheckinClient
      event={{
        id: event.id,
        name: event.name,
        category: event.category,
        point_value: event.point_value,
        starts_at: event.starts_at,
        ends_at: event.ends_at,
        semester_id: event.semester_id,
        check_in_type: event.check_in_type,
        scope: event.scope,
        jt_family_name: jtFamily?.name ?? null,
      }}
      members={normalizedMembers}
      checkedInIds={checkedInIds}
    />
  )
}
