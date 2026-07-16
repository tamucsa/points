import { headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import QRFullScreen from '@/app/(dashboard)/(officer)/officer/events/components/QRFullScreen'
import { getAuthUser } from '@/utils/supabase/auth'

export default async function QRPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase, user } = await getAuthUser()
  if (!user) redirect('/')

  const { data: event } = await supabase
    .from('events')
    .select('id, name, starts_at, ends_at, point_value, check_in_code, location, location_maps_url')
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
