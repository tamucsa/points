'use client'

import { QRCodeSVG } from 'qrcode.react'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { deleteEvent, publishEvent } from '@/app/actions/events'
import IconLabel, { CheckInTypeBadge, ScopeBadge } from '@/app/components/IconLabel'
import EmptyState from '@/app/components/EmptyState'
import EventFilterTabs from '@/app/components/EventFilterTabs'
import EventListPager, { paginateItems } from '@/app/components/EventListPager'
import JiatingFamilyFilter from '@/app/components/JiatingFamilyFilter'
import { EventMetaChip, EventMetaItem, EventMetaRow } from '@/app/components/EventMeta'
import PageHeader from '@/app/components/PageHeader'
import { EVENT_TIMEZONE, formatEventDate, isEventPast, sortEventsByStartsAt } from '@/utils/datetime'
import {
  EVENT_FILTER_TABS,
  eventMatchesFilter,
  eventMatchesJiatingFamily,
  type EventFilterTabId,
} from '@/utils/events'
import { Calendar, MapPin, Plus, Star, Trash2, Users } from 'lucide-react'

interface Event {
  id: string
  name: string
  category: string
  point_value: number
  scope: string
  check_in_type: string
  starts_at: string
  location: string | null
  location_maps_url?: string | null
  check_in_code: string | null
  jt_family_id: string | null
  rsvp_deadline?: string | null
  publish_status?: 'draft' | 'scheduled' | 'published' | null
  publish_at?: string | null
}

interface SpectatorEvent {
  id: string
  name: string
  check_in_code: string | null
  check_in_type: string
  point_value: number
  starts_at: string
}

interface JtFamily {
  id: string
  name: string
  color: string | null
}

interface Props {
  events: Event[]
  attendanceCounts: Record<string, number>
  semester: { id: string; name: string } | null
  isAdmin: boolean
  spectatorByParentId: Record<string, SpectatorEvent>
  jtFamilies: JtFamily[]
  mixerFamiliesByEventId: Record<string, string[]>
  officerJtFamilyId: string | null
  eventsWithRsvpUpload?: Record<string, true>
}

const actionPrimaryClassName =
  'min-h-11 flex-1 rounded-xl border border-primary/30 bg-primary/10 px-4 py-2.5 text-sm font-semibold text-primary transition hover:border-primary/50 hover:bg-primary/20 sm:min-h-0 sm:flex-none sm:px-3 sm:py-2 sm:text-xs'

const actionSecondaryClassName =
  'min-h-11 flex-1 rounded-xl border border-home-border bg-white px-4 py-2.5 text-sm text-subtitle transition hover:border-primary/30 hover:bg-bg hover:text-text sm:min-h-0 sm:flex-none sm:px-3 sm:py-2 sm:text-xs'

const actionDangerClassName =
  'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-[#f5b0b0] bg-[#fff4f4] px-4 py-2.5 text-sm font-semibold leading-none text-[#c94b4b] transition hover:border-[#e88a8a] hover:bg-[#ffe8e8] sm:min-h-0 sm:px-3 sm:py-2 sm:text-xs'

export default function OfficerEventsClient({
  events,
  attendanceCounts,
  semester,
  isAdmin,
  spectatorByParentId,
  jtFamilies,
  mixerFamiliesByEventId,
  officerJtFamilyId,
  eventsWithRsvpUpload = {},
}: Props) {
  const router = useRouter()
  const [qrEvent, setQrEvent] = useState<(Event | SpectatorEvent) | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Event | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [publishingId, setPublishingId] = useState<string | null>(null)
  const [publishError, setPublishError] = useState<string | null>(null)
  const [filter, setFilter] = useState<EventFilterTabId>('all')
  const [search, setSearch] = useState('')
  const [showPast, setShowPast] = useState(false)
  const [upcomingPage, setUpcomingPage] = useState(1)
  const [pastPage, setPastPage] = useState(1)
  const [jiatingFamilyId, setJiatingFamilyId] = useState<string | null>(() => {
    if (
      officerJtFamilyId &&
      jtFamilies.some(f => f.id === officerJtFamilyId)
    ) {
      return officerJtFamilyId
    }
    return null
  })

  const matchesSearch = (e: Event, q: string) =>
    !q || e.name.toLowerCase().includes(q)

  const filteredByTabAndSearch = useMemo(() => {
    const q = search.trim().toLowerCase()
    return events.filter(e => {
      if (!eventMatchesFilter(e, filter)) return false
      if (!matchesSearch(e, q)) return false
      if (filter === 'jiating') {
        return eventMatchesJiatingFamily(e, jiatingFamilyId, mixerFamiliesByEventId)
      }
      return true
    })
  }, [events, filter, search, jiatingFamilyId, mixerFamiliesByEventId])

  const filterCounts = useMemo(() => {
    const q = search.trim().toLowerCase()
    const searched = events.filter(e => matchesSearch(e, q))
    const counts: Partial<Record<EventFilterTabId, number>> = {}
    for (const tab of EVENT_FILTER_TABS) {
      counts[tab.id] = searched.filter(
        e => !isEventPast(e.starts_at) && eventMatchesFilter(e, tab.id),
      ).length
    }
    return counts
  }, [events, search])

  const jiatingFamilyCounts = useMemo(() => {
    const q = search.trim().toLowerCase()
    const jiatingUpcoming = events.filter(
      e =>
        !isEventPast(e.starts_at) &&
        eventMatchesFilter(e, 'jiating') &&
        matchesSearch(e, q),
    )
    const counts: Record<string, number> = {}
    for (const family of jtFamilies) {
      counts[family.id] = jiatingUpcoming.filter(e =>
        eventMatchesJiatingFamily(e, family.id, mixerFamiliesByEventId),
      ).length
    }
    return {
      all: jiatingUpcoming.length,
      byFamily: counts,
    }
  }, [events, search, jtFamilies, mixerFamiliesByEventId])

  const upcomingEvents = useMemo(
    () => sortEventsByStartsAt(filteredByTabAndSearch.filter(e => !isEventPast(e.starts_at))),
    [filteredByTabAndSearch],
  )

  const pastEvents = useMemo(
    () => sortEventsByStartsAt(
      filteredByTabAndSearch.filter(e => isEventPast(e.starts_at)),
      'desc',
    ),
    [filteredByTabAndSearch],
  )

  useEffect(() => {
    setUpcomingPage(1)
    setPastPage(1)
  }, [filter, search, jiatingFamilyId])

  const upcomingPageData = paginateItems(upcomingEvents, upcomingPage)
  const pastPageData = paginateItems(pastEvents, pastPage)

  const closeDeleteModal = () => {
    if (deleting) return
    setDeleteTarget(null)
    setDeleteError(null)
  }

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return

    setDeleting(true)
    setDeleteError(null)

    const result = await deleteEvent(deleteTarget.id)

    setDeleting(false)
    if (!result.success) {
      setDeleteError(result.error ?? 'Failed to delete event.')
      return
    }

    setDeleteTarget(null)
    router.refresh()
  }

  const handlePublishNow = async (eventId: string) => {
    setPublishingId(eventId)
    setPublishError(null)
    const result = await publishEvent(eventId)
    setPublishingId(null)
    if (!result.success) {
      setPublishError(result.error ?? 'Failed to publish event.')
      return
    }
    router.refresh()
  }

  const checkInUrl = (code: string) =>
    typeof window !== 'undefined'
      ? `${window.location.origin}/checkin/${code}`
      : `/checkin/${code}`

  const renderEventCard = (event: Event, isPast: boolean) => {
    const count = attendanceCounts[event.id] ?? 0
    const spectator = spectatorByParentId[event.id]
    const spectatorCount = spectator ? (attendanceCounts[spectator.id] ?? 0) : 0
    const publishStatus = event.publish_status ?? 'published'
    const canPublishNow = publishStatus === 'draft' || publishStatus === 'scheduled'

    return (
      <div
        key={event.id}
        role="link"
        tabIndex={0}
        aria-label={`View ${event.name}`}
        onClick={() => router.push(`/officer/events/${event.id}`)}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            router.push(`/officer/events/${event.id}`)
          }
        }}
        className={`flex cursor-pointer flex-col gap-4 rounded-3xl border border-home-border bg-white p-5 shadow-sm transition hover:border-primary/25 hover:shadow-[0_8px_28px_rgba(71,121,184,0.1)] sm:flex-row sm:items-center ${isPast ? 'opacity-75' : ''}`}
      >
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-lg font-extrabold text-primary">
          {event.point_value}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-text">{event.name}</span>
            {publishStatus === 'draft' && (
              <span className="inline-flex items-center rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-semibold leading-none text-stone-700">
                Draft
              </span>
            )}
            {publishStatus === 'scheduled' && (
              <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold leading-none text-amber-900">
                Scheduled
              </span>
            )}
            {publishStatus === 'published' && !isPast && (
              <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold leading-none text-primary">
                Upcoming
              </span>
            )}
            {spectator && (
              <span className="inline-flex items-center rounded-full bg-bg px-2 py-0.5 text-[11px] font-semibold leading-none text-subtitle">
                Spectator QR
              </span>
            )}
          </div>
          {publishStatus === 'scheduled' && event.publish_at && (
            <p className="mt-1.5 text-xs text-amber-900">
              Publishes{' '}
              {new Date(event.publish_at).toLocaleString('en-US', {
                timeZone: EVENT_TIMEZONE,
                dateStyle: 'medium',
                timeStyle: 'short',
              })}{' '}
              CT
            </p>
          )}
          <EventMetaRow className="mt-2">
            <EventMetaItem>
              <IconLabel icon={Calendar} label={formatEventDate(event.starts_at)} size="sm" />
            </EventMetaItem>
            {event.location && (
              <EventMetaItem>
                <IconLabel
                  icon={MapPin}
                  label={event.location}
                  size="sm"
                  href={event.location_maps_url}
                />
              </EventMetaItem>
            )}
          </EventMetaRow>
          <EventMetaRow className="mt-1.5">
            <EventMetaChip>{event.category}</EventMetaChip>
            <EventMetaChip>
              <ScopeBadge scope={event.scope} />
            </EventMetaChip>
            <EventMetaChip>
              <CheckInTypeBadge checkInType={event.check_in_type} />
            </EventMetaChip>
            <EventMetaItem>
              <IconLabel icon={Users} label={`${count} attended`} size="sm" />
            </EventMetaItem>
            {spectator && (
              <EventMetaItem>
                <IconLabel
                  icon={Users}
                  label={`${spectatorCount} spectators`}
                  size="sm"
                />
              </EventMetaItem>
            )}
          </EventMetaRow>
          {event.check_in_type === 'rsvp_required' &&
            event.rsvp_deadline &&
            new Date(event.rsvp_deadline) <= new Date() &&
            !eventsWithRsvpUpload[event.id] && (
              <p className="mt-2 text-xs font-medium text-amber-800">
                RSVP deadline passed — open the event to upload the responses CSV for check-in tags.
              </p>
            )}
        </div>

        <div
          className="flex w-full shrink-0 flex-wrap items-center gap-2 sm:w-auto sm:justify-end"
          onClick={e => e.stopPropagation()}
          onKeyDown={e => e.stopPropagation()}
        >
          {canPublishNow && (
            <button
              type="button"
              onClick={() => void handlePublishNow(event.id)}
              disabled={publishingId === event.id}
              className={actionPrimaryClassName}
            >
              {publishingId === event.id ? 'Publishing…' : 'Publish now'}
            </button>
          )}
          {(event.check_in_type === 'officer' || event.check_in_type === 'rsvp_required') &&
            publishStatus === 'published' && (
            <button
              type="button"
              onClick={() => router.push(`/officer/events/${event.id}/checkin`)}
              className={actionPrimaryClassName}
            >
              Check In
            </button>
          )}
          {event.check_in_type === 'self' && event.check_in_code && publishStatus === 'published' && (
            <>
              <button
                type="button"
                onClick={() => setQrEvent(event)}
                className={actionPrimaryClassName}
              >
                Show QR
              </button>
              <button
                type="button"
                onClick={() => window.open(`/officer/events/${event.id}/qr`, '_blank')}
                className={actionSecondaryClassName}
              >
                Full Screen
              </button>
              <button
                type="button"
                onClick={() => window.open(`/officer/events/${event.id}/qr?print=1`, '_blank')}
                className={actionSecondaryClassName}
              >
                Print QR
              </button>
            </>
          )}
          {/* Allow officers to preview QR setup on drafts/scheduled */}
          {event.check_in_type === 'self' && event.check_in_code && publishStatus !== 'published' && (
            <button
              type="button"
              onClick={() => window.open(`/officer/events/${event.id}/qr`, '_blank')}
              className={actionSecondaryClassName}
            >
              Preview QR
            </button>
          )}
          {spectator?.check_in_code && publishStatus === 'published' && (
            <>
              <button
                type="button"
                onClick={() => setQrEvent(spectator)}
                className={actionSecondaryClassName}
              >
                Spectator QR
              </button>
              <button
                type="button"
                onClick={() => window.open(`/officer/events/${spectator.id}/qr`, '_blank')}
                className={actionSecondaryClassName}
              >
                Spectator Full Screen
              </button>
              <button
                type="button"
                onClick={() =>
                  window.open(`/officer/events/${spectator.id}/qr?print=1`, '_blank')
                }
                className={actionSecondaryClassName}
              >
                Print Spectator QR
              </button>
            </>
          )}
          {isAdmin && (
            <button
              type="button"
              onClick={() => {
                setDeleteTarget(event)
                setDeleteError(null)
              }}
              className={actionDangerClassName}
            >
              <Trash2 className="size-3.5 shrink-0" aria-hidden />
              Delete
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 lg:px-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          title="Officer Events"
          subtitle={`${semester?.name ?? 'Current Semester'} · ${events.length} events`}
        />
        <button
          onClick={() => router.push('/officer/events/new')}
          className="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#35679e]"
        >
          <Plus className="size-4" aria-hidden />
          New Event
        </button>
      </div>

      {publishError && (
        <div className="mb-4 rounded-2xl border border-[#f5b0b0] bg-[#fff4f4] px-4 py-3 text-sm text-[#c94b4b]">
          {publishError}
        </div>
      )}

      {events.length > 0 && (
        <>
          <input
            type="search"
            placeholder="Search events by name…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="mb-3 w-full rounded-xl border border-home-border bg-white px-4 py-3 text-sm text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
          />
          <EventFilterTabs
            value={filter}
            onChange={setFilter}
            counts={filterCounts}
            className={filter === 'jiating' ? 'mb-3' : 'mb-5'}
          />
          {filter === 'jiating' && (
            <JiatingFamilyFilter
              families={jtFamilies}
              value={jiatingFamilyId}
              onChange={setJiatingFamilyId}
              allCount={jiatingFamilyCounts.all}
              counts={jiatingFamilyCounts.byFamily}
            />
          )}
        </>
      )}

      {events.length === 0 && (
        <EmptyState
          icon={Calendar}
          title="No events yet"
          description="Create your first event using the button above."
        />
      )}

      {events.length > 0 && upcomingEvents.length === 0 && pastEvents.length === 0 && (
        <EmptyState
          icon={Calendar}
          title={search.trim() ? 'No matching events' : 'No events in this tab'}
          description={
            search.trim()
              ? 'Try a different name or clear the search.'
              : 'Try another filter — other categories may still have events.'
          }
        />
      )}

      {upcomingEvents.length > 0 && (
        <div className="mb-8">
          <EventListPager
            page={upcomingPageData.page}
            totalCount={upcomingPageData.totalCount}
            onPageChange={setUpcomingPage}
            className="mb-4"
          />
          <div className="flex flex-col gap-3">
            {upcomingPageData.items.map(event => renderEventCard(event, false))}
          </div>
          <EventListPager
            page={upcomingPageData.page}
            totalCount={upcomingPageData.totalCount}
            onPageChange={setUpcomingPage}
          />
        </div>
      )}

      {pastEvents.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => {
              setShowPast(p => {
                if (!p) setPastPage(1)
                return !p
              })
            }}
            className="mb-4 rounded-xl border border-home-border bg-white px-4 py-2 text-sm text-subtitle shadow-sm transition hover:border-primary/30 hover:text-primary"
          >
            {showPast ? '▲ Hide' : '▼ Show'} Past Events ({pastEvents.length})
          </button>

          {showPast && (
            <div>
              <EventListPager
                page={pastPageData.page}
                totalCount={pastPageData.totalCount}
                onPageChange={setPastPage}
                className="mb-4"
              />
              <div className="flex flex-col gap-3">
                {pastPageData.items.map(event => renderEventCard(event, true))}
              </div>
              <EventListPager
                page={pastPageData.page}
                totalCount={pastPageData.totalCount}
                onPageChange={setPastPage}
              />
            </div>
          )}
        </div>
      )}

      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={closeDeleteModal}
        >
          <div
            className="w-full max-w-md rounded-4xl border border-home-border bg-white p-6 shadow-xl sm:p-8"
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-event-title"
          >
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fff4f4]">
              <Trash2 className="size-5 text-[#c94b4b]" aria-hidden />
            </div>
            <h2 id="delete-event-title" className="text-center text-lg font-bold text-text">
              Delete this event?
            </h2>
            <p className="mt-2 text-center text-sm font-semibold text-text">{deleteTarget.name}</p>
            <p className="mt-3 text-center text-sm leading-6 text-subtitle">
              This permanently removes the event
              {(attendanceCounts[deleteTarget.id] ?? 0) > 0
                ? ` and ${attendanceCounts[deleteTarget.id]} attendance record${attendanceCounts[deleteTarget.id] === 1 ? '' : 's'}`
                : ''}
              . This cannot be undone.
            </p>
            {deleteError && (
              <p className="mt-4 rounded-2xl border border-[#f5b0b0] bg-[#fff4f4] px-4 py-3 text-center text-sm text-[#c94b4b]">
                {deleteError}
              </p>
            )}
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={deleting}
                onClick={closeDeleteModal}
                className="rounded-xl border border-home-border bg-white px-4 py-2.5 text-sm font-semibold text-subtitle transition hover:border-primary/30 hover:bg-bg hover:text-text disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={() => void handleConfirmDelete()}
                className="rounded-xl border border-[#f5b0b0] bg-[#fff4f4] px-4 py-2.5 text-sm font-semibold text-[#c94b4b] transition hover:border-[#e88a8a] hover:bg-[#ffe8e8] disabled:opacity-60"
              >
                {deleting ? 'Deleting…' : 'Delete Event'}
              </button>
            </div>
          </div>
        </div>
      )}

      {qrEvent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setQrEvent(null)}
        >
          <div
            className="w-full max-w-sm rounded-4xl border border-home-border bg-white p-8 text-center shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-text">{qrEvent.name}</h2>
            <div className="mx-auto mt-5 inline-block rounded-2xl bg-white p-5 shadow-sm">
              <QRCodeSVG
                value={checkInUrl(qrEvent.check_in_code!)}
                size={220}
                level="H"
              />
            </div>
            <p className="mt-4 flex flex-wrap items-center justify-center gap-3 text-sm text-subtitle">
              <IconLabel icon={Calendar} label={formatEventDate(qrEvent.starts_at)} size="sm" />
              <IconLabel
                icon={Star}
                label={`${qrEvent.point_value} pt`}
                size="sm"
                iconClassName="text-primary"
              />
            </p>
            <div className="mt-5 flex justify-center gap-3">
              <button
                type="button"
                onClick={() => window.open(`/officer/events/${qrEvent.id}/qr`, '_blank')}
                className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#35679e]"
              >
                Full Screen
              </button>
              <button
                type="button"
                onClick={() =>
                  window.open(`/officer/events/${qrEvent.id}/qr?print=1`, '_blank')
                }
                className="rounded-xl border border-home-border bg-white px-4 py-2 text-sm font-semibold text-text transition hover:border-primary/30 hover:text-primary"
              >
                Print QR
              </button>
              <button
                type="button"
                onClick={() => setQrEvent(null)}
                className="rounded-xl border border-home-border bg-white px-4 py-2 text-sm text-subtitle transition hover:border-primary/30 hover:text-text"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
