import { headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import QRFullScreen from '@/app/(dashboard)/(officer)/officer/events/components/QRFullScreen'
import { createServerSupabase } from '@/utils/supabase/server'

export default async function QRPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerSupabase()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { data: event } = await supabase
    .from('events')
    .select('id, name, event_date, point_value, check_in_code, location')
    .eq('id', id)
    .eq('check_in_type', 'self')
    .maybeSingle()

  if (!event?.check_in_code) notFound()

  const headersList = await headers()
  const host = headersList.get('x-forwarded-host') ?? headersList.get('host')
  const proto = headersList.get('x-forwarded-proto') ?? 'https'
  const origin = host ? `${proto}://${host}` : (process.env.NEXT_PUBLIC_SITE_URL ?? '')

  return <QRFullScreen event={event} origin={origin} />
}
