import { headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import QRFullScreen from '@/app/(dashboard)/(officer)/officer/events/components/QRFullScreen'
import { publicOrigin } from '@/utils/public-origin'
import { getAuthUser } from '@/utils/supabase/auth'

export default async function QRPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ print?: string }>
}) {
  const { id } = await params
  const { print } = await searchParams
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
  const origin = publicOrigin({
    forwardedHost: headersList.get('x-forwarded-host'),
    forwardedProto: headersList.get('x-forwarded-proto'),
    host: headersList.get('host'),
  })

  return (
    <QRFullScreen
      event={event}
      origin={origin}
      autoPrint={print === '1'}
    />
  )
}
