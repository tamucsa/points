'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import AccountLinkBadge from '@/app/(dashboard)/(officer)/officer/members/components/AccountLinkBadge'
import MemberAvatar from '@/app/components/MemberAvatar'
import { inputClassName, OFFICER_MEMBERS_PAGE_SIZE } from '@/utils/constants'

interface Member {
  id: string
  full_name: string
  email: string
  profile_image_url: string | null
  account_linked: boolean
  jt_family: string | null
  jt_color: string | null
  total_points: number
  csa_points: number
  jt_points: number
  sports_points: number
  gm_points: number
}

interface Props {
  members: Member[]
  semester: { name: string } | null
  jtFamilies: string[]
  page: number
  totalPages: number
  totalCount: number
  notSignedInCount: number
  query: string
  filterJT: string
  filterLinked: 'all' | 'connected' | 'pending'
}

function buildMembersUrl(
  page: number,
  query: string,
  filterJT: string,
  filterLinked: string,
) {
  const params = new URLSearchParams()
  if (page > 1) params.set('page', String(page))
  if (query) params.set('q', query)
  if (filterJT !== 'all') params.set('jt', filterJT)
  if (filterLinked !== 'all') params.set('linked', filterLinked)
  const qs = params.toString()
  return qs ? `/officer/members?${qs}` : '/officer/members'
}

export default function MembersClient({
  members,
  semester,
  jtFamilies,
  page,
  totalPages,
  totalCount,
  notSignedInCount,
  query,
  filterJT,
  filterLinked,
}: Props) {
  const router = useRouter()
  const [searchInput, setSearchInput] = useState(query)

  const rangeStart = totalCount === 0 ? 0 : (page - 1) * OFFICER_MEMBERS_PAGE_SIZE + 1
  const rangeEnd = Math.min(page * OFFICER_MEMBERS_PAGE_SIZE, totalCount)

  const applyFilters = (next: { page?: number; q?: string; jt?: string; linked?: string }) => {
    router.push(
      buildMembersUrl(
        next.page ?? 1,
        next.q ?? searchInput,
        next.jt ?? filterJT,
        next.linked ?? filterLinked,
      ),
    )
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 lg:px-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-text">Members</h1>
        <p className="mt-1 text-sm text-subtitle">
          {semester?.name} · {totalCount} active members
          {notSignedInCount > 0 && (
            <> · {notSignedInCount} haven&apos;t signed in with Google yet</>
          )}
        </p>
      </div>

      <form
        className="mb-4 flex flex-col gap-3 lg:flex-row"
        onSubmit={e => {
          e.preventDefault()
          applyFilters({ page: 1, q: searchInput })
        }}
      >
        <input
          placeholder="Search by name or email…"
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          className={inputClassName}
        />
        <select
          value={filterJT}
          onChange={e => applyFilters({ page: 1, jt: e.target.value })}
          className={`${inputClassName} cursor-pointer lg:max-w-[10rem]`}
        >
          <option value="all">All JTs</option>
          {jtFamilies.map(jt => (
            <option key={jt} value={jt}>{jt}</option>
          ))}
        </select>
        <select
          value={filterLinked}
          onChange={e => applyFilters({ page: 1, linked: e.target.value })}
          className={`${inputClassName} cursor-pointer lg:max-w-[11rem]`}
        >
          <option value="all">All sign-in status</option>
          <option value="connected">Signed in</option>
          <option value="pending">Not signed in</option>
        </select>
        <button
          type="submit"
          className="rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary/90 sm:shrink-0"
        >
          Search
        </button>
      </form>

      <div className="overflow-x-auto rounded-4xl border border-home-border bg-white shadow-sm">
        <div className="grid min-w-[720px] grid-cols-[1fr_6.5rem_7rem_4rem_4rem_4rem_4rem_4rem] border-b border-home-border bg-bg px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.05em] text-subtitle">
          <div>Member</div>
          <div>Sign-in</div>
          <div>JT</div>
          <div className="text-right">Total</div>
          <div className="text-right">CSA</div>
          <div className="text-right">JT</div>
          <div className="text-right">Sports</div>
          <div className="text-right">GM</div>
        </div>

        {members.length === 0 && (
          <div className="px-8 py-10 text-center text-sm text-subtitle">No members found.</div>
        )}

        {members.map(m => {
          const displayName = m.full_name
          return (
          <Link
            key={m.id}
            href={`/officer/members/${m.id}`}
            className="grid min-w-[720px] grid-cols-[1fr_6.5rem_7rem_4rem_4rem_4rem_4rem_4rem] items-center border-b border-home-border px-5 py-3 transition last:border-b-0 hover:bg-bg"
          >
            <div className="flex min-w-0 items-center gap-3">
              <MemberAvatar
                name={displayName}
                profileImageUrl={m.profile_image_url}
                color={m.jt_color}
              />
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-text">{displayName}</div>
                <div className="truncate text-xs text-subtitle">{m.email}</div>
              </div>
            </div>
            <div>
              <AccountLinkBadge linked={m.account_linked} compact />
            </div>
            <div>
              {m.jt_family && (
                <span
                  className="inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold"
                  style={{ background: `${m.jt_color ?? '#4779B8'}20`, color: m.jt_color ?? '#4779B8' }}
                >
                  {m.jt_family}
                </span>
              )}
            </div>
            <div className="text-right text-sm font-bold text-text">{m.total_points}</div>
            <div className="text-right text-sm text-subtitle">{m.csa_points}</div>
            <div className="text-right text-sm text-subtitle">{m.jt_points}</div>
            <div className="text-right text-sm text-subtitle">{m.sports_points}</div>
            <div className="text-right text-sm text-subtitle">{m.gm_points}</div>
          </Link>
          )
        })}
      </div>

      {totalCount > 0 && (
        <div className="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row">
          <p className="text-sm text-subtitle">
            Showing {rangeStart}–{rangeEnd} of {totalCount}
          </p>
          <div className="flex items-center gap-2">
            {page > 1 ? (
              <Link
                href={buildMembersUrl(page - 1, query, filterJT, filterLinked)}
                className="rounded-xl border border-home-border bg-white px-4 py-2 text-sm font-medium text-subtitle transition hover:border-primary/30 hover:text-primary"
              >
                Previous
              </Link>
            ) : (
              <span className="rounded-xl border border-home-border px-4 py-2 text-sm text-subtitle/40">
                Previous
              </span>
            )}
            <span className="px-2 text-sm text-subtitle">
              Page {page} of {totalPages}
            </span>
            {page < totalPages ? (
              <Link
                href={buildMembersUrl(page + 1, query, filterJT, filterLinked)}
                className="rounded-xl border border-home-border bg-white px-4 py-2 text-sm font-medium text-subtitle transition hover:border-primary/30 hover:text-primary"
              >
                Next
              </Link>
            ) : (
              <span className="rounded-xl border border-home-border px-4 py-2 text-sm text-subtitle/40">
                Next
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
