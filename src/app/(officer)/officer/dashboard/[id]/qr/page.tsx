import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import QRFullScreen from '@/app/(officer)/dashboard/components/QRFullScreen'

export default async function QRPage({ params }: { params: { id: string } }) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: event } = await supabase
    .from('events')
    .select('id, name, event_date, point_value, check_in_code, location')
    .eq('id', params.id)
    .eq('check_in_type', 'self')
    .single()

  if (!event || !event.check_in_code) notFound()

  return <QRFullScreen event={event} />
}