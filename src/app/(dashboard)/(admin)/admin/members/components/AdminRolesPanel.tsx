'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { updateMemberRole } from '@/app/actions/members'
import MemberAvatar from '@/app/components/MemberAvatar'
import { inputClassName, OFFICER_MEMBERS_PAGE_SIZE } from '@/utils/constants'
import { MEMBER_ROLES, type MemberRole } from '@/utils/members'

export interface RoleMember {
  id: string
  full_name: string
  email: string
  profile_image_url: string | null
  role: MemberRole
  jt_family_name: string | null
}

interface Props {
  members: RoleMember[]
  currentAdminId: string
  page: number
  totalPages: number
  totalCount: number
  query: string
  roleFilter: 'all' | MemberRole
}

const ROLE_LABELS: Record<MemberRole, string> = {
  member: 'Member',
  officer: 'Officer',
  admin: 'Admin',
}

const selectClassName =
  'w-full cursor-pointer appearance-none rounded-xl border border-home-border bg-white py-2.5 pl-3 pr-10 text-sm text-text shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-60'

function SelectChevron() {
  return (
    <ChevronDown
      className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-subtitle"
      aria-hidden
    />
  )
}

function buildRolesUrl(page: number, query: string, roleFilter: string) {
  const params = new URLSearchParams()
  params.set('tab', 'roles')
  if (page > 1) params.set('page', String(page))
  if (query) params.set('q', query)
  if (roleFilter !== 'all') params.set('role', roleFilter)
  return `/admin/members?${params.toString()}`
}

export default function AdminRolesPanel({
  members,
  currentAdminId,
  page,
  totalPages,
  totalCount,
  query,
  roleFilter,
}: Props) {
  const router = useRouter()
  const [searchInput, setSearchInput] = useState(query)
  const [draftRoles, setDraftRoles] = useState<Record<string, MemberRole>>({})
  const [savingId, setSavingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const rangeStart = totalCount === 0 ? 0 : (page - 1) * OFFICER_MEMBERS_PAGE_SIZE + 1
  const rangeEnd = Math.min(page * OFFICER_MEMBERS_PAGE_SIZE, totalCount)

  const applyFilters = (next: { page?: number; q?: string; role?: string }) => {
    router.push(
      buildRolesUrl(
        next.page ?? 1,
        next.q ?? searchInput.trim(),
        next.role ?? roleFilter,
      ),
    )
  }

  const selectedRole = (m: RoleMember) => draftRoles[m.id] ?? m.role

  const saveRole = async (m: RoleMember) => {
    const nextRole = selectedRole(m)
    if (nextRole === m.role) return

    const isSelf = m.id === currentAdminId
    if (nextRole === 'admin' && m.role !== 'admin') {
      const ok = window.confirm(
        `Promote ${m.full_name} to admin? This grants full admin access including role management and semester controls.`,
      )
      if (!ok) return
    }

    if (isSelf && m.role === 'admin' && nextRole !== 'admin') {
      const ok = window.confirm(
        'Remove your own admin access? You will lose access to admin pages after this change.',
      )
      if (!ok) return
    }

    setSavingId(m.id)
    setError(null)
    setSuccess(null)

    const result = await updateMemberRole(m.id, nextRole)
    setSavingId(null)

    if (!result.success) {
      setError(result.error ?? 'Failed to update role.')
      return
    }

    setDraftRoles(prev => {
      const next = { ...prev }
      delete next[m.id]
      return next
    })
    setSuccess(`Updated ${m.full_name} to ${ROLE_LABELS[nextRole]}.`)
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm leading-6 text-subtitle">
        Promote or demote active members. Officers can access officer tools; admins can access
        admin pages as well. You cannot demote the last remaining admin.
      </p>

      <form
        className="flex flex-col gap-3 sm:flex-row"
        onSubmit={e => {
          e.preventDefault()
          applyFilters({ q: searchInput.trim(), page: 1 })
        }}
      >
        <input
          type="search"
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          placeholder="Search by name or email…"
          className={`${inputClassName} flex-1`}
        />
        <div className="relative sm:w-44">
          <select
            value={roleFilter}
            onChange={e => applyFilters({ role: e.target.value, page: 1, q: searchInput.trim() })}
            className={selectClassName}
            aria-label="Filter by role"
          >
            <option value="all">All roles</option>
            {MEMBER_ROLES.map(role => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}
              </option>
            ))}
          </select>
          <SelectChevron />
        </div>
        <button
          type="submit"
          className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#35679e]"
        >
          Search
        </button>
      </form>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {success}
        </div>
      )}

      <div className="overflow-hidden rounded-4xl border border-home-border bg-white shadow-sm">
        {members.length === 0 ? (
          <div className="px-8 py-10 text-center text-sm text-subtitle">
            No active members match these filters.
          </div>
        ) : (
          members.map(m => {
            const draft = selectedRole(m)
            const dirty = draft !== m.role
            const isYou = m.id === currentAdminId

            return (
              <div
                key={m.id}
                className="flex flex-col gap-3 border-b border-home-border px-5 py-4 last:border-b-0 sm:flex-row sm:items-center sm:gap-4"
              >
                <MemberAvatar name={m.full_name} profileImageUrl={m.profile_image_url} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-text">
                    <span className="truncate">{m.full_name}</span>
                    {isYou && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                        You
                      </span>
                    )}
                    <span className="rounded-full bg-bg px-2 py-0.5 text-[11px] font-semibold capitalize text-subtitle">
                      {ROLE_LABELS[m.role]}
                    </span>
                  </div>
                  <div className="truncate text-xs text-subtitle">{m.email}</div>
                  {m.jt_family_name && (
                    <div className="text-xs text-subtitle/80">{m.jt_family_name}</div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative min-w-[8.5rem]">
                    <select
                      value={draft}
                      onChange={e =>
                        setDraftRoles(prev => ({
                          ...prev,
                          [m.id]: e.target.value as MemberRole,
                        }))
                      }
                      disabled={savingId === m.id}
                      className={selectClassName}
                      aria-label={`Role for ${m.full_name}`}
                    >
                      {MEMBER_ROLES.map(role => (
                        <option key={role} value={role}>
                          {ROLE_LABELS[role]}
                        </option>
                      ))}
                    </select>
                    <SelectChevron />
                  </div>
                  <button
                    type="button"
                    onClick={() => void saveRole(m)}
                    disabled={!dirty || savingId === m.id}
                    className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:bg-[#9cb8d8]"
                  >
                    {savingId === m.id ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>

      {totalCount > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-subtitle">
            Showing {rangeStart}–{rangeEnd} of {totalCount}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => applyFilters({ page: page - 1 })}
              className="rounded-xl border border-home-border bg-white px-3 py-2 text-sm font-medium text-subtitle transition hover:border-primary/30 hover:text-text disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => applyFilters({ page: page + 1 })}
              className="rounded-xl border border-home-border bg-white px-3 py-2 text-sm font-medium text-subtitle transition hover:border-primary/30 hover:text-text disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
