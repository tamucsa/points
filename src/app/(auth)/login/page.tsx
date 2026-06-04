'use client'
import { createBrowserClient } from '@supabase/ssr'
import { useState } from 'react'

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const signInWithGoogle = async () => {
    setLoading(true)
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback`,
        queryParams: { hd: 'tamu.edu' },
      },
    })
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f1117', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 440, padding: 32, background: '#161a27', borderRadius: 16, border: '1px solid #1e2337' }}>
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#4f6ef7', marginBottom: 8 }}>
            Texas A&M Chinese Student Association
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 6 }}>
            Sign in to CSA Points
          </h1>
          <p style={{ fontSize: 14, color: '#555', lineHeight: 1.6 }}>
            Use your TAMU Google account to access events, points, and your profile.
          </p>
        </div>

        <div style={{ padding: 14, background: '#0f1117', borderRadius: 10, border: '1px solid #1e2337', marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#ddd', marginBottom: 4 }}>
            TAMU email required
          </div>
          <div style={{ fontSize: 13, color: '#555', lineHeight: 1.5 }}>
            Sign in with the Google account associated with your Texas A&M email address.
          </div>
        </div>

        <button
          onClick={signInWithGoogle}
          disabled={loading}
          style={{
            width: '100%',
            padding: '12px 14px',
            background: loading ? '#2a2f45' : '#4f6ef7',
            color: loading ? '#555' : '#fff',
            border: 'none',
            borderRadius: 10,
            fontSize: 15,
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'all 0.15s',
            fontFamily: 'inherit',
          }}
        >
          {loading ? 'Redirecting…' : 'Sign in with Google'}
        </button>
      </div>
    </div>
  )
}