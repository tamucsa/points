import { notFound, redirect } from 'next/navigation'
import OfficerCheckinClient from '@/app/(dashboard)/(officer)/officer/events/components/OfficerCheckinClient'
import { isMixerCategory } from '@/utils/events'
import { fetchAllPages } from '@/utils/supabase/fetchAll'
import { getCurrentMember } from '@/utils/supabase/auth'

function memberRoleLabel(role: string): 'Member' | 'Officer' {
  return role === 'officer' || role === 'admin' ? 'Officer' : 'Member'
}

export default async function OfficerCheckinPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase, user, member: officer } = await getCurrentMember()
  if (!user) redirect('/')

  if (!officer || !['officer', 'admin'].includes(officer.role)) {
    redirect('/leaderboard')
  }

  const { data: event, error: eventError } = await supabase
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
      jt_family_id
    `)
    .eq('id', id)
    .maybeSingle()

  if (eventError) {
    console.error('Officer check-in failed to load event:', eventError.message, { id })
    throw new Error(`Failed to load event: ${eventError.message}`)
  }

  if (!event) notFound()

  let jtFamilyName: string | null = null
  if (event.jt_family_id) {
    const { data: family } = await supabase
      .from('jt_families')
      .select('name')
      .eq('id', event.jt_family_id)
      .maybeSingle()
    jtFamilyName = family?.name ?? null
  }

  const isJtSpecific = event.scope === 'jt_specific' && !!event.jt_family_id
  const isJtShared = event.scope === 'jt_shared'

  let tabFamilies: { id: string; name: string; color: string | null }[] = []

  if (isJtShared) {
    const { data: linked } = await supabase
      .from('event_jt_families')
      .select('jt_family_id')
      .eq('event_id', id)

    const linkedIds = (linked ?? []).map(row => row.jt_family_id)

    if (linkedIds.length > 0) {
      const { data: families } = await supabase
        .from('jt_families')
        .select('id, name, color')
        .in('id', linkedIds)
        .order('name')

      tabFamilies = (families ?? []).map(f => ({
        id: f.id,
        name: f.name,
        color: f.color,
      }))
    } else {
      const { data: allFamilies } = await supabase
        .from('jt_families')
        .select('id, name, color')
        .eq('is_active', true)
        .order('name')

      tabFamilies = (allFamilies ?? []).map(f => ({
        id: f.id,
        name: f.name,
        color: f.color,
      }))
    }
  }

  type MemberRosterRow = {
    id: string
    full_name: string
    email: string
    profile_image_url: string | null
    role: string
    jt_family_id: string | null
    jt_families: { name: string; color: string } | { name: string; color: string }[] | null
  }

  const { data: members, error: membersError } = await fetchAllPages<MemberRosterRow>((from, to) => {
    let membersQuery = supabase
      .from('members')
      .select('id, full_name, email, profile_image_url, role, jt_family_id, jt_families(name, color)')
      .eq('status', 'active')
      .order('full_name')

    if (isJtSpecific) {
      membersQuery = membersQuery.eq('jt_family_id', event.jt_family_id!)
    } else if (isJtShared && tabFamilies.length > 0) {
      membersQuery = membersQuery.in('jt_family_id', tabFamilies.map(f => f.id))
    } else if (isJtShared) {
      membersQuery = membersQuery.not('jt_family_id', 'is', null)
    }

    return membersQuery.range(from, to)
  })

  if (membersError) {
    console.error('Officer check-in failed to load members:', membersError.message, { id })
    throw new Error(`Failed to load members: ${membersError.message}`)
  }

  const { data: attendance, error: attendanceError } = await fetchAllPages<{ member_id: string }>(
    (from, to) =>
      supabase
        .from('attendance')
        .select('member_id')
        .eq('event_id', id)
        .range(from, to),
  )

  if (attendanceError) {
    console.error('Officer check-in failed to load attendance:', attendanceError.message, { id })
    throw new Error(`Failed to load attendance: ${attendanceError.message}`)
  }

  const checkedInIds = attendance.map(a => a.member_id)

  let hasRsvpList = false
  let rsvpedMemberIds: string[] = []

  if (event.check_in_type === 'rsvp_required') {
    const { data: rsvpRows, error: rsvpError } = await fetchAllPages<{
      member_id: string | null
    }>((from, to) =>
      supabase
        .from('event_rsvps')
        .select('member_id')
        .eq('event_id', id)
        .range(from, to),
    )

    if (rsvpError) {
      console.error('Officer check-in failed to load RSVPs:', rsvpError.message, { id })
    } else {
      hasRsvpList = rsvpRows.length > 0
      rsvpedMemberIds = rsvpRows
        .map(r => r.member_id)
        .filter((mid): mid is string => Boolean(mid))
    }
  }

  const normalizedMembers = members.map(m => {
    const jtFamily = Array.isArray(m.jt_families)
      ? m.jt_families[0] ?? null
      : (m.jt_families as { name: string; color: string } | null)

    return {
      id: m.id,
      full_name: m.full_name,
      email: m.email,
      profile_image_url: m.profile_image_url,
      jt_family_id: m.jt_family_id,
      jt_family_name: jtFamily?.name ?? null,
      jt_color: jtFamily?.color ?? null,
      role_label: memberRoleLabel(m.role),
    }
  })

  const defaultTabId =
    (officer.jt_family_id && tabFamilies.some(f => f.id === officer.jt_family_id)
      ? officer.jt_family_id
      : tabFamilies[0]?.id) ?? null

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
        jt_family_name: jtFamilyName,
        is_mixer: isMixerCategory(event.category),
      }}
      members={normalizedMembers}
      checkedInIds={checkedInIds}
      tabFamilies={tabFamilies}
      defaultTabId={defaultTabId}
      hasRsvpList={hasRsvpList}
      rsvpedMemberIds={rsvpedMemberIds}
    />
  )
}
