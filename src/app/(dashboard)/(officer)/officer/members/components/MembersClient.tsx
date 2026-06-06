'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { inputClassName } from '@/utils/constants'

interface Member {
  id: string
  full_name: string
  preferred_name: string | null
  email: string
  profile_image_url: string | null
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
}

export default function MembersClient({ members, semester }: Props) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [filterJT, setFilterJT] = useState('all')

  const jtFamilies = [...new Set(members.map(m => m.jt_family).filter(Boolean))]

  const filtered = useMemo(() => members.filter(m => {
    const q = search.toLowerCase()
    const matchesSearch =
      m.full_name.toLowerCase().includes(q) ||
      (m.preferred_name?.toLowerCase().includes(q)) ||
      m.email.toLowerCase().includes(q)
    const matchesJT = filterJT === 'all' || m.jt_family === filterJT
    return matchesSearch && matchesJT
  }), [members, search, filterJT])

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 lg:px-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-text">Members</h1>
        <p className="mt-1 text-sm text-subtitle">
          {semester?.name} · {members.length} active members
        </p>
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <input
          placeholder="Search by name or email…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className={inputClassName}
        />
        <select
          value={filterJT}
          onChange={e => setFilterJT(e.target.value)}
          className={`${inputClassName} cursor-pointer sm:max-w-[10rem]`}
        >
          <option value="all">All JTs</option>
          {jtFamilies.map(jt => <option key={jt} value={jt!}>{jt}</option>)}
        </select>
      </div>

      <div className="overflow-x-auto rounded-4xl border border-home-border bg-white shadow-sm">
        <div className="grid min-w-[640px] grid-cols-[1fr_7rem_4rem_4rem_4rem_4rem_4rem] border-b border-home-border bg-bg px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.05em] text-subtitle">
          <div>Member</div>
          <div>JT</div>
          <div className="text-right">Total</div>
          <div className="text-right">CSA</div>
          <div className="text-right">JT</div>
          <div className="text-right">Sports</div>
          <div className="text-right">GM</div>
        </div>

        {filtered.length === 0 && (
          <div className="px-8 py-10 text-center text-sm text-subtitle">No members found.</div>
        )}

        {filtered.map(m => (
          <button
            key={m.id}
            type="button"
            onClick={() => router.push(`/officer/members/${m.id}`)}
            className="grid w-full min-w-[640px] grid-cols-[1fr_7rem_4rem_4rem_4rem_4rem_4rem] items-center border-b border-home-border px-5 py-3 text-left transition last:border-b-0 hover:bg-bg"
          >
            <div className="flex min-w-0 items-center gap-3">
              {m.profile_image_url ? (
                <img src={m.profile_image_url} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
              ) : (
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                  style={{ background: `${m.jt_color ?? '#4779B8'}20`, color: m.jt_color ?? '#4779B8' }}
                >
                  {(m.preferred_name || m.full_name)[0]}
                </div>
              )}
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-text">{m.preferred_name || m.full_name}</div>
                <div className="truncate text-xs text-subtitle">{m.email}</div>
              </div>
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
          </button>
        ))}
      </div>
    </div>
  )
}
