'use client'
import { createBrowserClient } from '@supabase/ssr'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import { GoogleUser } from '@/utils/types'

export default function RegisterPage() {
  const router = useRouter()
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

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
        router.push('/login')
        return
      }

      // If they already have a member row, they shouldn't be here
      const { data: existing } = await supabase
        .from('members')
        .select('id')
        .eq('auth_uid', user.id)
        .single()

      if (existing) {
        router.push('/leaderboard')
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

    const { error: insertError } = await supabase.from('members').insert({
      auth_uid:          user!.id,
      email:             user!.email,
      full_name:         user!.user_metadata.full_name,
      preferred_name:    form.preferred_name.trim(),
      graduation_year:   year,
      phone:             form.phone.trim() || null,
      profile_image_url: user!.user_metadata.avatar_url,
      status:            'pending_jt',
      role:              'member',
    })

    if (insertError) {
      setError('Something went wrong. Please try again.')
      setSubmitting(false)
      return
    }

    router.push('/pending')
  }

  if (loading) return null // middleware handles redirect if no session

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f1117]">
      <div className="w-full max-w-md p-8 bg-[#161a27] rounded-lg border border-[#1e2337]">

        {/* Header */}
        <div className="mb-7">
          <h1 className="text-xl font-bold text-white mb-1.5">
            Complete your registration
          </h1>
          <p style={{ fontSize: 14, color: '#555' }}>
            You only need to do this once.
          </p>
        </div>

        {/* Pre-filled from Google — read only */}
        <div className="mb-5 p-3.5 bg-[#0f1117] rounded-lg flex items-center gap-3">
          {user?.user_metadata.avatar_url && (
            <img
              src={user.user_metadata.avatar_url}
              alt="Profile"
              style={{ width: 40, height: 40, borderRadius: '50%' }}
            />
          )}
          <div>
            <div style={{ fontSize: 14, fontWeight: 500, color: '#ddd' }}>
              {user?.user_metadata.full_name}
            </div>
            <div style={{ fontSize: 13, color: '#555' }}>{user?.email}</div>
          </div>
        </div>

        {/* Form fields */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>
              Preferred Name *
            </label>
            <input
              type="text"
              placeholder="What should we call you?"
              value={form.preferred_name}
              onChange={e => setForm(f => ({ ...f, preferred_name: e.target.value }))}
              style={inputStyle}
            />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>
              Graduation Year *
            </label>
            <select
              value={form.graduation_year}
              onChange={e => setForm(f => ({ ...f, graduation_year: e.target.value }))}
              style={{ ...inputStyle, cursor: 'pointer' }}
            >
              <option value="">Select year…</option>
              {Array.from({ length: 6 }, (_, i) => new Date().getFullYear() + i).map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>
              Phone <span style={{ color: '#444', fontWeight: 400 }}>(optional)</span>
            </label>
            <input
              type="tel"
              placeholder="(555) 555-5555"
              value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              style={inputStyle}
            />
          </div>

        </div>

        {/* JT notice */}
        <div style={{ marginTop: 20, padding: 12, background: '#4f6ef710', borderRadius: 8, border: '1px solid #4f6ef720' }}>
          <p style={{ fontSize: 13, color: '#4f6ef7' }}>
            🏠 Your JT family will be assigned by an officer after the sorting process. You'll appear on the leaderboard once assigned.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div style={{ marginTop: 16, padding: 12, background: '#e74c3c15', borderRadius: 8, border: '1px solid #e74c3c30' }}>
            <p style={{ fontSize: 13, color: '#e74c3c' }}>{error}</p>
          </div>
        )}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={submitting}
          style={{
            marginTop: 24,
            width: '100%',
            padding: '12px',
            background: submitting ? '#2a2f45' : '#4f6ef7',
            color: submitting ? '#555' : '#fff',
            border: 'none',
            borderRadius: 10,
            fontSize: 15,
            fontWeight: 600,
            cursor: submitting ? 'not-allowed' : 'pointer',
            transition: 'all 0.15s',
            fontFamily: 'inherit',
          }}
        >
          {submitting ? 'Registering…' : 'Complete Registration'}
        </button>

      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  background: '#0f1117',
  border: '1px solid #2a2f45',
  borderRadius: 8,
  color: '#ddd',
  fontSize: 14,
  fontFamily: 'inherit',
  outline: 'none',
}