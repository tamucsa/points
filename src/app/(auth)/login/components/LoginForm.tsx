'use client'
import { createBrowserSupabase } from '@/utils/supabase/client'
import { useSearchParams } from 'next/navigation'
import { useState } from 'react'

export default function LoginForm() {
  const searchParams = useSearchParams()
  const next = searchParams.get('next')
  const authError = searchParams.get('error')
  const [loading, setLoading] = useState(false)
  const supabase = createBrowserSupabase()

  const signInWithGoogle = async () => {
    setLoading(true)
    const callbackUrl = next
      ? `${window.location.origin}/api/auth/callback?next=${encodeURIComponent(next)}`
      : `${window.location.origin}/api/auth/callback`

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: callbackUrl,
        queryParams: { hd: 'tamu.edu' },
        skipBrowserRedirect: true,
      },
    })

    if (error || !data?.url) {
      setLoading(false)
      return
    }

    window.location.href = data.url
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-bg px-6 py-10 text-text">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(71,121,184,0.16),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(240,176,195,0.22),transparent_38%)]" />
      <div className="absolute -left-24 top-20 h-44 w-44 rounded-full bg-primary/10 blur-3xl" />
      <div className="absolute -right-20 bottom-8 h-56 w-56 rounded-full bg-accent/20 blur-3xl" />

      <div className="relative mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-6xl items-center justify-center">
        <div className="grid w-full max-w-5xl overflow-hidden rounded-4xl border border-home-border bg-white shadow-[0_24px_80px_rgba(15,23,42,0.08)] lg:grid-cols-[1.15fr_0.85fr]">
          <div className="relative overflow-hidden bg-[linear-gradient(135deg,rgba(71,121,184,0.08),rgba(255,255,255,0.9)_52%,rgba(240,176,195,0.16))] p-8 sm:p-10 lg:p-12">
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-primary/15 bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-primary backdrop-blur">
              Texas A&amp;M Chinese Student Association
            </div>

            <div className="max-w-lg">
              <h1 className="text-3xl font-bold tracking-tight text-text sm:text-4xl lg:text-5xl">
                Sign in to TAMU CSA Points
              </h1>
              <p className="mt-4 max-w-xl text-base leading-7 text-subtitle sm:text-lg">
                Use your TAMU Google account to access events, your profile and points, and the CSA-wide leaderboard!
              </p>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-home-border bg-white/85 p-4 shadow-sm">
                <div className="text-sm font-semibold text-primary">Events</div>
                <div className="mt-1 text-sm leading-6 text-subtitle">
                  Browse upcoming CSA events and check in quickly.
                </div>
              </div>
              <div className="rounded-2xl border border-home-border bg-white/85 p-4 shadow-sm">
                <div className="text-sm font-semibold text-primary">Points</div>
                <div className="mt-1 text-sm leading-6 text-subtitle">
                  Track attendance and earn points throughout the semester.
                </div>
              </div>
              <div className="rounded-2xl border border-home-border bg-white/85 p-4 shadow-sm">
                <div className="text-sm font-semibold text-accent">Profile</div>
                <div className="mt-1 text-sm leading-6 text-subtitle">
                  Keep your membership details in one place.
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center bg-white p-8 sm:p-10 lg:p-12">
            <div className="w-full max-w-md rounded-[1.75rem] border border-home-border bg-bg p-7 shadow-[0_16px_48px_rgba(71,121,184,0.08)] sm:p-8">
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-base font-bold text-white shadow-[0_12px_24px_rgba(71,121,184,0.24)]">
                  CSA
                </div>
                <div>
                  <div className="text-sm font-semibold uppercase tracking-[0.22em] text-primary">
                    Welcome back
                  </div>
                  <div className="text-sm text-subtitle">
                    Secure TAMU sign-in
                  </div>
                </div>
              </div>

              <div className="mb-5 rounded-2xl border border-accent/35 bg-[linear-gradient(180deg,rgba(240,176,195,0.18),rgba(255,255,255,0.9))] p-4">
                <div className="text-sm font-semibold text-text">TAMU email required</div>
                <div className="mt-1 text-sm leading-6 text-subtitle">
                  Sign in with the Google account associated with your Texas A&amp;M email address.
                </div>
              </div>

              {authError && (
                <div className="mb-4 rounded-2xl border border-[#f5b0b0] bg-[#fff4f4] p-3.5">
                  <p className="text-sm leading-6 text-[#c94b4b]">
                    {authError === 'invalid_domain'
                      ? 'Please sign in with your @tamu.edu Google account.'
                      : 'Sign-in failed. Please try again.'}
                  </p>
                </div>
              )}

              <button
                onClick={signInWithGoogle}
                disabled={loading}
                className="flex w-full items-center justify-center rounded-xl border border-transparent bg-primary px-4 py-3 text-[15px] font-semibold text-white shadow-[0_12px_28px_rgba(71,121,184,0.24)] transition duration-150 hover:bg-[#35679e] disabled:cursor-not-allowed disabled:bg-[#9cb8d8] disabled:text-white/80"
              >
                {loading ? 'Redirecting…' : 'Sign in with Google'}
              </button>

              <p className="mt-4 text-center text-sm leading-6 text-subtitle">
                You&apos;ll be redirected to Google to complete authentication.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
