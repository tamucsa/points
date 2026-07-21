import { Hourglass } from 'lucide-react'
import { redirect } from 'next/navigation'
import PublicPageShell from '@/app/(auth)/components/PublicPageShell'
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

  if (member?.status !== 'pending_member' && member?.status !== 'pending_jt') {
    redirect('/')
  }

  return (
    <PublicPageShell showFooter={false}>
      <div className="flex min-h-[calc(100vh-5rem)] items-center justify-center">
        <div className="w-full max-w-xl overflow-hidden rounded-4xl border border-home-border bg-surface shadow-theme-lg">
          <div className="bg-hero-gradient p-8 sm:p-10 lg:p-12">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/15 bg-surface/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-primary backdrop-blur">
              Texas A&amp;M Chinese Student Association
            </div>

            <div className="text-center">
              <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                <Hourglass className="size-7 text-primary" aria-hidden />
              </div>
              <h1 className="text-3xl font-bold tracking-normal text-text sm:text-5xl">
                You&apos;re registered!
              </h1>
              <p className="mx-auto mt-4 max-w-lg text-base leading-7 text-subtitle sm:text-lg">
                An admin still needs to confirm your CSA membership before you can use the points
                dashboard. If you already paid dues, make sure your email is on the roster — rostered
                members skip this step after Google sign-in.
              </p>
              <p className="mx-auto mt-4 max-w-lg text-base leading-7 text-subtitle sm:text-lg">
                Note that this is not the same as the registration form. If you haven&apos;t filled
                out the membership registration form and paid dues, please make sure to complete that!
              </p>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-home-border bg-surface/85 p-4 shadow-sm">
                <div className="text-sm font-semibold text-primary">Next Step</div>
                <div className="mt-1 text-sm leading-6 text-subtitle">
                  Wait for an admin to approve your account.
                </div>
              </div>
              <div className="rounded-2xl border border-home-border bg-surface/85 p-4 shadow-sm">
                <div className="text-sm font-semibold text-accent">Access</div>
                <div className="mt-1 text-sm leading-6 text-subtitle">
                  Leaderboard and events unlock once you&apos;re an active member.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PublicPageShell>
  )
}
