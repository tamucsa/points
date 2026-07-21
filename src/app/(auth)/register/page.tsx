'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { GraduationCap, Home, User } from 'lucide-react'
import { registerMember } from '@/app/actions/members'
import AuthFeatureCard from '@/app/(auth)/components/AuthFeatureCard'
import MemberAvatar from '@/app/components/MemberAvatar'
import PageLoading from '@/app/components/PageLoading'
import PublicPageShell from '@/app/(auth)/components/PublicPageShell'
import { parseGoogleName, validateClassYear, validateRegistrationNames } from '@/utils/members'
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
    first_name: '',
    last_name: '',
    class_year: '',
    phone: '',
  })

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push('/')
        return
      }

      const { data: existing } = await supabase
        .from('members')
        .select('id, status')
        .eq('auth_uid', user.id)
        .maybeSingle()

      if (existing) {
        router.push(existing.status === 'active' ? '/leaderboard' : '/pending')
        return
      }

      const googleUser = user as unknown as GoogleUser
      const { firstName, lastName } = parseGoogleName(googleUser.user_metadata)
      setForm(f => ({
        ...f,
        first_name: firstName,
        last_name: lastName,
      }))
      setUser(googleUser)
      setLoading(false)
    }

    getUser()
  }, [])

  const handleSubmit = async () => {
    setError(null)

    const names = validateRegistrationNames(form.first_name, form.last_name)
    if (!names.ok) {
      setError(names.error)
      return
    }

    const classResult = validateClassYear(form.class_year)
    if (!classResult.ok) {
      setError(classResult.error)
      return
    }

    setSubmitting(true)

    const result = await registerMember({
      firstName: form.first_name,
      lastName: form.last_name,
      classYear: classResult.year,
      phone: form.phone,
    })

    if (!result.success) {
      setError(result.error ?? 'Something went wrong. Please try again.')
      setSubmitting(false)
      return
    }

    router.push('/pending')
  }

  const previewName =
    [form.first_name.trim(), form.last_name.trim()].filter(Boolean).join(' ') ||
    user?.user_metadata.full_name ||
    ''

  if (loading) {
    return (
      <PublicPageShell showFooter={false}>
        <PageLoading label="Loading your account…" />
      </PublicPageShell>
    )
  }

  return (
    <PublicPageShell showFooter={false}>
      <div className="flex min-h-[calc(100vh-5rem)] items-center justify-center lg:max-h-[calc(100vh-5rem)]">
        <div className="grid w-full max-w-5xl overflow-hidden rounded-4xl border border-home-border bg-surface shadow-theme-lg lg:grid-cols-[1.05fr_0.95fr]">
          <div className="relative overflow-hidden bg-hero-gradient p-8 sm:p-10 lg:p-12">
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-primary/15 bg-surface/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-primary backdrop-blur">
              Texas A&amp;M Chinese Student Association
            </div>

            <h1 className="text-3xl font-bold tracking-tight text-text sm:text-4xl lg:text-5xl">
              Complete your registration
            </h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-subtitle sm:text-lg">
              After you finish, your account will be ready to view CSA events, earn points, and appear on the leaderboard!
            </p>

            <div className="mt-10 hidden gap-4 sm:grid sm:grid-cols-3">
              <AuthFeatureCard
                icon={User}
                title="Profile"
                description="Confirm your name and contact info."
              />
              <AuthFeatureCard
                icon={GraduationCap}
                title="Class"
                description="Set your class so officers can organize members."
              />
              <AuthFeatureCard
                icon={Home}
                title="JT family"
                description="Your group is assigned after sorting is complete."
                accent
              />
            </div>
          </div>

          <div className="flex items-center justify-center bg-surface p-8 sm:p-10 lg:p-12">
            <div className="w-full max-w-md rounded-[1.75rem] border border-home-border bg-bg p-6 shadow-theme-sm sm:p-8">
              <div className="mb-4 flex items-center gap-3 rounded-2xl border border-home-border bg-surface p-3.5 shadow-sm sm:mb-6 sm:p-4">
                <MemberAvatar
                  name={previewName}
                  profileImageUrl={user?.user_metadata.avatar_url}
                  size="md"
                  bordered
                />
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-text">{previewName}</div>
                  <div className="truncate text-sm text-subtitle">{user?.email}</div>
                </div>
              </div>

              <div className="mb-4 rounded-2xl border border-accent/35 bg-accent-card p-3.5 sm:mb-5 sm:p-4">
                <p className="text-sm leading-6 text-subtitle">
                  Your JT family will be assigned by an officer after the sorting process. You&apos;ll appear on the leaderboard once assigned.
                </p>
              </div>

              <div className="space-y-3 sm:space-y-4">
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.06em] text-subtitle">
                    Name *
                  </label>
                  <p className="mb-2 text-xs leading-5 text-subtitle">
                    This is how your name will appear on the leaderboard.
                  </p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <input
                      type="text"
                      placeholder="First name"
                      value={form.first_name}
                      onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))}
                      className={inputClassName}
                      autoComplete="given-name"
                    />
                    <input
                      type="text"
                      placeholder="Last name"
                      value={form.last_name}
                      onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))}
                      className={inputClassName}
                      autoComplete="family-name"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.06em] text-subtitle">
                    Class *
                  </label>
                  <select
                    value={form.class_year}
                    onChange={e => setForm(f => ({ ...f, class_year: e.target.value }))}
                    className={`${inputClassName} cursor-pointer`}
                  >
                    <option value="">Select class…</option>
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
                    autoComplete="tel"
                  />
                </div>
              </div>

              {error && (
                <div className="mt-4 rounded-2xl border border-error-border bg-error-bg p-3.5 sm:mt-5 sm:p-4">
                  <p className="text-sm leading-6 text-error">{error}</p>
                </div>
              )}

              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="mt-5 flex w-full items-center justify-center rounded-xl border border-transparent bg-primary px-4 py-3 text-[15px] font-semibold text-on-primary shadow-theme-primary transition duration-150 hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-disabled disabled:text-on-primary/80 sm:mt-6"
              >
                {submitting ? 'Registering…' : 'Complete Registration'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </PublicPageShell>
  )
}

const inputClassName = 'w-full rounded-xl border border-home-border bg-surface px-4 py-3 text-sm text-text outline-none transition placeholder:text-subtitle focus:border-primary focus:ring-2 focus:ring-primary/15'
