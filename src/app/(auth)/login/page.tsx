'use client'
import { createBrowserClient } from '@supabase/ssr'

export default function LoginPage() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback`,
        queryParams: { hd: 'tamu.edu' },
      },
    })
  }

  return (
    <div>
      <h1>CSA Points</h1>
      <button onClick={signInWithGoogle}>
        Sign in with Google
      </button>
    </div>
  )
}