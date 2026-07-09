'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { registerMember } from '@/app/actions/members'
import { GoogleUser } from '@/utils/types'
import { createBrowserSupabase } from '@/utils/supabase/client'

export default function RegisterPage() {
  const router = useRouter()
  const supabase = createBrowserSupabase()

  const [user, setUser] = useState<GoogleUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    preferred_name: '',
    graduation_year: '',
    phone: '',
  })

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push('/')
        return
      }

      // If they already have a member row, they shouldn't be here
      const { data: existing } = await supabase
        .from('members')
        .select('id, status')
        .eq('auth_uid', user.id)
        .maybeSingle()

      if (existing) {
        router.push(existing.status === 'active' ? '/leaderboard' : '/pending')
        return
      }

      setUser(user as unknown as GoogleUser)
      setLoading(false)
    }

    getUser()
  }, [])

  const handleSubmit = async () => {
    setError(null)

    // Validation
    if (!form.preferred_name.trim()) {
      setError('Preferred name is required.')
      return
    }
    if (!form.graduation_year) {
      setError('Graduation year is required.')
      return
    }

    const year = parseInt(form.graduation_year)
    const currentYear = new Date().getFullYear()
    if (year < currentYear || year > currentYear + 6) {
      setError('Please enter a valid graduation year.')
      return
    }

    setSubmitting(true)

    const result = await registerMember({
      preferredName: form.preferred_name,
      graduationYear: year,
      phone: form.phone,
    })

    if (!result.success) {
      setError(result.error ?? 'Something went wrong. Please try again.')
      setSubmitting(false)
      return
    }

    router.push('/pending')
  }

  if (loading) return null // middleware handles redirect if no session

  return (
    <div className="relative min-h-screen overflow-hidden bg-bg px-6 py-6 text-text lg:max-h-screen lg:min-h-0">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(71,121,184,0.16),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(240,176,195,0.22),transparent_38%)]" />
      <div className="absolute -left-24 top-16 h-44 w-44 rounded-full bg-primary/10 blur-3xl" />
      <div className="absolute -right-20 bottom-10 h-56 w-56 rounded-full bg-accent/20 blur-3xl" />

      <div className="relative mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-6xl items-center justify-center lg:max-h-[calc(100vh-3rem)] lg:min-h-0">
        <div className="grid w-full max-w-5xl overflow-hidden rounded-4xl border border-home-border bg-white shadow-[0_24px_80px_rgba(15,23,42,0.08)] lg:grid-cols-[1.05fr_0.95fr]">
          <div className="relative overflow-hidden bg-[linear-gradient(135deg,rgba(71,121,184,0.08),rgba(255,255,255,0.9)_52%,rgba(240,176,195,0.16))] p-8 sm:p-10 lg:p-12">
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-primary/15 bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-primary backdrop-blur">
              Texas A&amp;M Chinese Student Association
            </div>

            <h1 className="text-3xl font-bold tracking-tight text-text sm:text-4xl lg:text-5xl">
              Complete your registration
            </h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-subtitle sm:text-lg">
              After you finish, your account will be ready to view CSA events, earn points, and appear on the leaderboard!
            </p>

            <div className="mt-10 hidden gap-4 sm:grid sm:grid-cols-3">
              <div className="rounded-2xl border border-home-border bg-white/85 p-4 shadow-sm">
                <div className="text-sm font-semibold text-primary">Profile</div>
                <div className="mt-1 text-sm leading-6 text-subtitle">
                  Confirm your preferred name and contact info.
                </div>
              </div>
              <div className="rounded-2xl border border-home-border bg-white/85 p-4 shadow-sm">
                <div className="text-sm font-semibold text-primary">Graduation</div>
                <div className="mt-1 text-sm leading-6 text-subtitle">
                  Set your class year so officers can organize members.
                </div>
              </div>
              <div className="rounded-2xl border border-home-border bg-white/85 p-4 shadow-sm">
                <div className="text-sm font-semibold text-accent">JT family</div>
                <div className="mt-1 text-sm leading-6 text-subtitle">
                  Your group is assigned after sorting is complete.
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center bg-white p-8 sm:p-10 lg:p-12">
            <div className="w-full max-w-md rounded-[1.75rem] border border-home-border bg-bg p-6 shadow-[0_16px_48px_rgba(71,121,184,0.08)] sm:p-8">
              <div className="mb-4 flex items-center gap-3 rounded-2xl border border-home-border bg-white p-3.5 shadow-sm sm:mb-6 sm:p-4">
                {user?.user_metadata.avatar_url && (
                  <img
                    src={user.user_metadata.avatar_url}
                    alt="Profile"
                    className="h-12 w-12 rounded-full border border-home-border object-cover"
                  />
                )}
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-text">
                    {user?.user_metadata.full_name}
                  </div>
                  <div className="truncate text-sm text-subtitle">{user?.email}</div>
                </div>
              </div>

              <div className="mb-4 rounded-2xl border border-accent/35 bg-[linear-gradient(180deg,rgba(240,176,195,0.18),rgba(255,255,255,0.9))] p-3.5 sm:mb-5 sm:p-4">
                <p className="text-sm leading-6 text-subtitle">
                  Your JT family will be assigned by an officer after the sorting process. You&apos;ll appear on the leaderboard once assigned.
                </p>
              </div>

              <div className="space-y-3 sm:space-y-4">
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.06em] text-subtitle">
                    Preferred Name *
                  </label>
                  <input
                    type="text"
                    placeholder="What should we call you?"
                    value={form.preferred_name}
                    onChange={e => setForm(f => ({ ...f, preferred_name: e.target.value }))}
                    className={inputClassName}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.06em] text-subtitle">
                    Graduation Year *
                  </label>
                  <select
                    value={form.graduation_year}
                    onChange={e => setForm(f => ({ ...f, graduation_year: e.target.value }))}
                    className={`${inputClassName} cursor-pointer`}
                  >
                    <option value="">Select year…</option>
                    {Array.from({ length: 6 }, (_, i) => new Date().getFullYear() + i).map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.06em] text-subtitle">
                    Phone <span className="font-normal text-[#8b96aa]">(optional)</span>
                  </label>
                  <input
                    type="tel"
                    placeholder="(555) 555-5555"
                    value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    className={inputClassName}
                  />
                </div>
              </div>

              {error && (
                <div className="mt-4 rounded-2xl border border-[#f5b0b0] bg-[#fff4f4] p-3.5 sm:mt-5 sm:p-4">
                  <p className="text-sm leading-6 text-[#c94b4b]">{error}</p>
                </div>
              )}

              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="mt-5 flex w-full items-center justify-center rounded-xl border border-transparent bg-primary px-4 py-3 text-[15px] font-semibold text-white shadow-[0_12px_28px_rgba(71,121,184,0.24)] transition duration-150 hover:bg-[#35679e] disabled:cursor-not-allowed disabled:bg-[#9cb8d8] disabled:text-white/80 sm:mt-6"
              >
                {submitting ? 'Registering…' : 'Complete Registration'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const inputClassName = 'w-full rounded-xl border border-home-border bg-white px-4 py-3 text-sm text-text outline-none transition placeholder:text-[#8b96aa] focus:border-primary focus:ring-2 focus:ring-primary/15'