import { redirect } from 'next/navigation'
import AdminMembersClient from '@/app/(dashboard)/(admin)/admin/members/components/AdminMembersClient'
import { countHowdyWeekAttendanceByMemberIds } from '@/app/actions/guests'
import { OFFICER_MEMBERS_PAGE_SIZE } from '@/utils/constants'
import { isMemberRole, type MemberRole } from '@/utils/members'
import { getActiveSemester, getCurrentMember } from '@/utils/supabase/auth'

interface SearchParams {
  tab?: string
  page?: string
  q?: string
  role?: string
}

export default async function AdminMembersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const { supabase, user, member: adminMember } = await getCurrentMember()
  if (!user || !adminMember) redirect('/')

  const {
    tab: tabParam,
    page: pageParam,
    q = '',
    role: roleParam = 'all',
  } = await searchParams

  const tab =
    tabParam === 'import' || tabParam === 'roles' || tabParam === 'pending' || tabParam === 'signups'
      ? tabParam
      : 'pending'
  const page = Math.max(1, Number(pageParam) || 1)
  const query = q.trim()
  const roleFilter: 'all' | MemberRole =
    roleParam === 'all' || !isMemberRole(roleParam) ? 'all' : roleParam

  const [
    { data: pendingJt },
    { data: pendingSignups },
    { data: jtFamilies },
    semester,
  ] = await Promise.all([
    supabase
      .from('members')
      .select('id, full_name, email, graduation_year, created_at')
      .eq('status', 'active')
      .is('jt_family_id', null)
      .order('full_name', { ascending: true }),
    supabase
      .from('members')
      .select('id, full_name, email, graduation_year, created_at')
      .eq('status', 'pending_member')
      .order('created_at', { ascending: true }),
    supabase
      .from('jt_families')
      .select('id, name')
      .eq('is_active', true)
      .order('name'),
    getActiveSemester(),
  ])

  const signupRows = pendingSignups ?? []
  const howdyWeekCounts = semester
    ? await countHowdyWeekAttendanceByMemberIds(
        supabase,
        signupRows.map(m => m.id),
        semester.id,
      )
    : new Map<string, number>()

  const pendingSignupsWithHowdy = signupRows.map(m => ({
    ...m,
    howdy_week_count: howdyWeekCounts.get(m.id) ?? 0,
  }))

  const from = (page - 1) * OFFICER_MEMBERS_PAGE_SIZE
  const to = from + OFFICER_MEMBERS_PAGE_SIZE - 1

  let rolesQuery = supabase
    .from('members')
    .select('id, full_name, email, profile_image_url, role, jt_families(name)', {
      count: 'exact',
    })
    .eq('status', 'active')
    .order('full_name', { ascending: true })

  if (query) {
    const pattern = `%${query}%`
    rolesQuery = rolesQuery.or(`full_name.ilike.${pattern},email.ilike.${pattern}`)
  }

  if (roleFilter !== 'all') {
    rolesQuery = rolesQuery.eq('role', roleFilter)
  }

  const { data: roleRows, count: roleCount } = await rolesQuery.range(from, to)

  const roleMembers = (roleRows ?? []).map(row => {
    const jt = Array.isArray(row.jt_families)
      ? row.jt_families[0] ?? null
      : (row.jt_families as { name: string } | null)

    return {
      id: row.id,
      full_name: row.full_name,
      email: row.email,
      profile_image_url: row.profile_image_url,
      role: (isMemberRole(row.role) ? row.role : 'member') as MemberRole,
      jt_family_name: jt?.name ?? null,
    }
  })

  const totalCount = roleCount ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / OFFICER_MEMBERS_PAGE_SIZE))

  return (
    <AdminMembersClient
      pendingJt={pendingJt ?? []}
      pendingSignups={pendingSignupsWithHowdy}
      jtFamilies={jtFamilies ?? []}
      initialTab={tab}
      currentAdminId={adminMember.id}
      roleMembers={roleMembers}
      rolePage={page}
      roleTotalPages={totalPages}
      roleTotalCount={totalCount}
      roleQuery={query}
      roleFilter={roleFilter}
    />
  )
}
