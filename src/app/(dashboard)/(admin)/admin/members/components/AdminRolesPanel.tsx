'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { updateMemberAccess } from '@/app/actions/members'
import MemberAvatar from '@/app/components/MemberAvatar'
import RoleBadges from '@/app/components/RoleBadges'
import { inputClassName, OFFICER_MEMBERS_PAGE_SIZE } from '@/utils/constants'
import {
  ACCESS_PRESET_LABELS,
  ACCESS_PRESETS,
  accessPresetFromMember,
  accessPresetToFields,
  type AccessPreset,
  type MemberRole,
} from '@/utils/members'

export interface RoleMember {
  id: string
  full_name: string
  email: string
  profile_image_url: string | null
  role: MemberRole
  is_parent: boolean
  jt_family_name: string | null
}

interface Props {
  members: RoleMember[]
  currentAdminId: string
  page: number
  totalPages: number
  totalCount: number
  query: string
  roleFilter: 'all' | MemberRole | 'parent'
}

const selectClassName =
  'w-full cursor-pointer appearance-none rounded-xl border border-home-border bg-surface py-2.5 pl-3 pr-10 text-sm text-text shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-60'

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
  const [draftPresets, setDraftPresets] = useState<Record<string, AccessPreset>>({})
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

  const selectedPreset = (m: RoleMember) =>
    draftPresets[m.id] ?? accessPresetFromMember(m.role, m.is_parent)

  const saveRole = async (m: RoleMember) => {
    const nextPreset = selectedPreset(m)
    const { role: nextRole, is_parent: nextParent } = accessPresetToFields(nextPreset)
    if (nextRole === m.role && nextParent === m.is_parent) return

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

    const result = await updateMemberAccess(m.id, nextRole, nextParent)
    setSavingId(null)

    if (!result.success) {
      setError(result.error ?? 'Failed to update role.')
      return
    }

    setDraftPresets(prev => {
      const next = { ...prev }
      delete next[m.id]
      return next
    })
    setSuccess(`Updated ${m.full_name} to ${ACCESS_PRESET_LABELS[nextPreset]}.`)
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm leading-6 text-subtitle">
        Assign Member, Parent, Officer, or Admin. Parent is its own role and
        can also combine with Officer or Admin. Parents do not earn points and
        are hidden from the leaderboard. Parent-only users can create Jiating
        Event and Jiating Mixer for their own family; Officer + Parent and
        Admin + Parent keep full staff create tools. You cannot demote the last
        remaining admin.
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
            <option value="member">Member</option>
            <option value="parent">Parent</option>
            <option value="officer">Officer</option>
            <option value="admin">Admin</option>
          </select>
          <SelectChevron />
        </div>
        <button
          type="submit"
          className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary transition hover:bg-primary-hover"
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

      <div className="overflow-hidden rounded-4xl border border-home-border bg-surface shadow-sm">
        {members.length === 0 ? (
          <div className="px-8 py-10 text-center text-sm text-subtitle">
            No active members match these filters.
          </div>
        ) : (
          members.map(m => {
            const draft = selectedPreset(m)
            const current = accessPresetFromMember(m.role, m.is_parent)
            const dirty = draft !== current
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
                    <RoleBadges role={m.role} isParent={m.is_parent} revealAdmin />
                  </div>
                  <div className="truncate text-xs text-subtitle">{m.email}</div>
                  {m.jt_family_name && (
                    <div className="text-xs text-subtitle/80">{m.jt_family_name}</div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative min-w-[11.5rem]">
                    <select
                      value={draft}
                      onChange={e =>
                        setDraftPresets(prev => ({
                          ...prev,
                          [m.id]: e.target.value as AccessPreset,
                        }))
                      }
                      disabled={savingId === m.id}
                      className={selectClassName}
                      aria-label={`Role for ${m.full_name}`}
                    >
                      {ACCESS_PRESETS.map(preset => (
                        <option key={preset} value={preset}>
                          {ACCESS_PRESET_LABELS[preset]}
                        </option>
                      ))}
                    </select>
                    <SelectChevron />
                  </div>
                  <button
                    type="button"
                    onClick={() => void saveRole(m)}
                    disabled={!dirty || savingId === m.id}
                    className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-on-primary transition disabled:cursor-not-allowed disabled:bg-disabled"
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
              className="rounded-xl border border-home-border bg-surface px-3 py-2 text-sm font-medium text-subtitle transition hover:border-primary/30 hover:text-text disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => applyFilters({ page: page + 1 })}
              className="rounded-xl border border-home-border bg-surface px-3 py-2 text-sm font-medium text-subtitle transition hover:border-primary/30 hover:text-text disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
