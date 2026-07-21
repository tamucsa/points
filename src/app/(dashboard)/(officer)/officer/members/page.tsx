import GuestsClient from '@/app/(dashboard)/(officer)/officer/members/components/GuestsClient'
import MembersClient from '@/app/(dashboard)/(officer)/officer/members/components/MembersClient'
import {
  countHowdyWeekAttendanceByMemberIds,
  listHowdyWeekGuestProspects,
  listRecentGuestExports,
  type HowdyWeekGuestSort,
} from '@/app/actions/guests'
import { OFFICER_MEMBERS_PAGE_SIZE } from '@/utils/constants'
import { fetchAllPages } from '@/utils/supabase/fetchAll'
import { getActiveSemester, getAuthUser } from '@/utils/supabase/auth'

const MEMBER_COLUMNS =
  'id, full_name, email, profile_image_url, account_linked, jt_family, jt_color, total_points, csa_points, jt_points, sports_points, gm_points'

interface SearchParams {
  tab?: string
  page?: string
  q?: string
  jt?: string
  linked?: string
  minEvents?: string
  event?: string
  sort?: string
}

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const tab = params.tab === 'guests' ? 'guests' : 'members'
  const page = Math.max(1, Number(params.page) || 1)
  const query = (params.q ?? '').trim()

  const { supabase } = await getAuthUser()
  const semester = await getActiveSemester()

  if (tab === 'guests') {
    const minEvents = Math.max(1, Number(params.minEvents) || 1)
    const eventId = params.event && params.event !== 'all' ? params.event : 'all'
    const sort: HowdyWeekGuestSort =
      params.sort === 'name' || params.sort === 'last_attended'
        ? params.sort
        : 'event_count'

    const [prospectsResult, exportsResult, howdyEventsResult, membersResult] =
      await Promise.all([
        listHowdyWeekGuestProspects(
          {
            query,
            minEvents,
            eventId: eventId === 'all' ? null : eventId,
            sort,
            page,
            pageSize: OFFICER_MEMBERS_PAGE_SIZE,
          },
          supabase,
        ),
        listRecentGuestExports(5),
        semester
          ? supabase
              .from('events')
              .select('id, name')
              .eq('semester_id', semester.id)
              .eq('category', 'Howdy Week')
              .order('starts_at', { ascending: false })
          : Promise.resolve({ data: [] as { id: string; name: string }[] }),
        fetchAllPages<{ id: string; full_name: string; email: string }>(
          (from, to) =>
            supabase
              .from('members')
              .select('id, full_name, email')
              .in('status', ['active', 'pending_member'])
              .order('full_name')
              .range(from, to),
        ),
      ])

    const totalCount = prospectsResult.total
    const totalPages = Math.max(
      1,
      Math.ceil(totalCount / OFFICER_MEMBERS_PAGE_SIZE),
    )

    return (
      <GuestsClient
        prospects={prospectsResult.rows}
        totalCount={totalCount}
        page={page}
        totalPages={totalPages}
        semester={semester ? { name: semester.name } : null}
        query={query}
        minEvents={minEvents}
        eventId={eventId}
        sort={sort}
        howdyEvents={howdyEventsResult.data ?? []}
        matchMembers={membersResult.data ?? []}
        recentExports={exportsResult.rows}
        loadError={prospectsResult.error}
      />
    )
  }

  const jt = params.jt ?? 'all'
  const linked = params.linked ?? 'all'
  const linkedFilter =
    linked === 'connected' || linked === 'pending' ? linked : 'all'
  const from = (page - 1) * OFFICER_MEMBERS_PAGE_SIZE
  const to = from + OFFICER_MEMBERS_PAGE_SIZE - 1

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
    { data: jtFamilies },
    { count: notSignedInCount },
  ] = await Promise.all([
    membersQuery.range(from, to),
    supabase.from('jt_families').select('name').eq('is_active', true).order('name'),
    supabase
      .from('v_current_leaderboard')
      .select('id', { count: 'exact', head: true })
      .eq('account_linked', false),
  ])

  const memberRows = members ?? []
  const howdyWeekCounts = semester
    ? await countHowdyWeekAttendanceByMemberIds(
        supabase,
        memberRows.map(m => m.id),
        semester.id,
      )
    : new Map<string, number>()

  const membersWithHowdy = memberRows.map(m => ({
    ...m,
    howdy_week_count: howdyWeekCounts.get(m.id) ?? 0,
  }))

  const totalCount = count ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / OFFICER_MEMBERS_PAGE_SIZE))

  return (
    <MembersClient
      members={membersWithHowdy}
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
