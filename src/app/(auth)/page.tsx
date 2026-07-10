import type { Metadata } from 'next'
import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import LoginForm from '@/app/(auth)/components/LoginForm'
import { createServerSupabase } from '@/utils/supabase/server'

export const metadata: Metadata = {
  title: 'TAMU CSA Points',
  description: 'The point tracking system for the Texas A&M Chinese Student Association.',
}

export default async function HomePage() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    const { data: member } = await supabase
      .from('members')
      .select('status')
      .eq('auth_uid', user.id)
      .maybeSingle()

    redirect(member?.status === 'pending_jt' ? '/pending' : '/leaderboard')
  }

  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <div className="h-12 w-12 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
