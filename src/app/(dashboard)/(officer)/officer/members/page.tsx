import MembersClient from '@/app/(dashboard)/(officer)/officer/members/components/MembersClient'
import { OFFICER_MEMBERS_PAGE_SIZE } from '@/utils/constants'
import { getActiveSemester } from '@/utils/supabase/auth'
import { createServerSupabase } from '@/utils/supabase/server'

const MEMBER_COLUMNS =
  'id, full_name, email, profile_image_url, account_linked, jt_family, jt_color, total_points, csa_points, jt_points, sports_points, gm_points'

interface SearchParams {
  page?: string
  q?: string
  jt?: string
  linked?: string
}

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const { page: pageParam, q = '', jt = 'all', linked = 'all' } = await searchParams
  const page = Math.max(1, Number(pageParam) || 1)
  const query = q.trim()
  const linkedFilter = linked === 'connected' || linked === 'pending' ? linked : 'all'
  const from = (page - 1) * OFFICER_MEMBERS_PAGE_SIZE
  const to = from + OFFICER_MEMBERS_PAGE_SIZE - 1

  const supabase = await createServerSupabase()

  let membersQuery = supabase
    .from('v_current_leaderboard')
    .select(MEMBER_COLUMNS, { count: 'exact' })
    .order('total_points', { ascending: false })

  if (query) {
    const pattern = `%${query}%`
    membersQuery = membersQuery.or(
      `full_name.ilike.${pattern},email.ilike.${pattern}`,
    )
  }

  if (jt !== 'all') {
    membersQuery = membersQuery.eq('jt_family', jt)
  }

  if (linkedFilter === 'connected') {
    membersQuery = membersQuery.eq('account_linked', true)
  } else if (linkedFilter === 'pending') {
    membersQuery = membersQuery.eq('account_linked', false)
  }

  const [
    { data: members, count },
    semester,
    { data: jtFamilies },
    { count: notSignedInCount },
  ] = await Promise.all([
    membersQuery.range(from, to),
    getActiveSemester(),
    supabase.from('jt_families').select('name').eq('is_active', true).order('name'),
    supabase
      .from('v_current_leaderboard')
      .select('id', { count: 'exact', head: true })
      .eq('account_linked', false),
  ])

  const totalCount = count ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / OFFICER_MEMBERS_PAGE_SIZE))

  return (
    <MembersClient
      members={members ?? []}
      semester={semester ? { name: semester.name } : null}
      jtFamilies={(jtFamilies ?? []).map(f => f.name)}
      page={page}
      totalPages={totalPages}
      totalCount={totalCount}
      notSignedInCount={notSignedInCount ?? 0}
      query={query}
      filterJT={jt}
      filterLinked={linkedFilter}
    />
  )
}
