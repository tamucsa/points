import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/utils/supabase/server'

export default async function PendingPage() {
  const supabase = await createServerSupabase()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/')
  }

  const { data: member } = await supabase
    .from('members')
    .select('status')
    .eq('auth_uid', user.id)
    .maybeSingle()

  if (member?.status === 'active') {
    redirect('/leaderboard')
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-bg px-6 py-8 text-text">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(71,121,184,0.16),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(240,176,195,0.22),transparent_38%)]" />
      <div className="absolute -left-24 top-16 h-44 w-44 rounded-full bg-primary/10 blur-3xl" />
      <div className="absolute -right-20 bottom-10 h-56 w-56 rounded-full bg-accent/20 blur-3xl" />

      <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-4xl items-center justify-center">
        <div className="w-full max-w-xl overflow-hidden rounded-4xl border border-home-border bg-white shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
          <div className="bg-[linear-gradient(135deg,rgba(71,121,184,0.08),rgba(255,255,255,0.9)_52%,rgba(240,176,195,0.16))] p-8 sm:p-10 lg:p-12">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/15 bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-primary backdrop-blur">
              Texas A&amp;M Chinese Student Association
            </div>

            <div className="text-center">
              <div className="mb-5 text-5xl">⏳</div>
              <h1 className="text-3xl font-bold tracking-normal text-text sm:text-5xl">
                You&apos;re registered!
              </h1>
              <p className="mx-auto mt-4 max-w-lg text-base leading-7 text-subtitle sm:text-lg">
                This dashboard will be available to you once you join your jiating after the reveal! You&apos;ll get full access to the leaderboard and events once that&apos;s done.
              </p>
              <p className="mx-auto mt-4 max-w-lg text-base leading-7 text-subtitle sm:text-lg">
               Note that this is not the same as the registration form. If you haven&apos;t filled out the registration form yet and payed dues, please make sure to complete that!
              </p>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-home-border bg-white/85 p-4 shadow-sm">
                <div className="text-sm font-semibold text-primary">Next Step</div>
                <div className="mt-1 text-sm leading-6 text-subtitle">
                  Wait for Jiating Reveal!
                </div>
              </div>
              <div className="rounded-2xl border border-home-border bg-white/85 p-4 shadow-sm">
                <div className="text-sm font-semibold text-accent">Access</div>
                <div className="mt-1 text-sm leading-6 text-subtitle">
                  Your leaderboard event list will unlock after sorting.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
