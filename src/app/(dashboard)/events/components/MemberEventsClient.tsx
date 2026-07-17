'use client'

import { useEffect, useMemo, useState } from 'react'
import IconLabel, { CategoryBadge, CheckInTypeBadge } from '@/app/components/IconLabel'
import EmptyState from '@/app/components/EmptyState'
import EventFilterTabs from '@/app/components/EventFilterTabs'
import EventListPager, { paginateItems } from '@/app/components/EventListPager'
import { EventMetaChip, EventMetaItem, EventMetaRow } from '@/app/components/EventMeta'
import PageHeader from '@/app/components/PageHeader'
import { formatEventSchedule, isEventPast, sortEventsByStartsAt } from '@/utils/datetime'
import {
  EVENT_FILTER_TABS,
  eventMatchesFilter,
  isManualPointsCheckIn,
  type EventFilterTabId,
} from '@/utils/events'
import { Calendar, Clock, MapPin, X } from 'lucide-react'

interface Event {
  id: string
  name: string
  category: string
  point_value: number
  scope: string
  check_in_type: string
  starts_at: string
  ends_at: string | null
  location: string | null
  location_maps_url?: string | null
  description: string | null
  rsvp_url: string | null
  rsvp_deadline: string | null
}

interface Props {
  events: Event[]
  attendedIds: Set<string>
  rsvpedIds: Set<string>
  /** Per-member earned points when attendance.point_value_override is set. */
  earnedPointsByEventId: Record<string, number>
  semester: { name: string } | null
}

function displayPoints(
  event: Event,
  earnedPointsByEventId: Record<string, number>,
) {
  return earnedPointsByEventId[event.id] ?? event.point_value
}

function EventCard({
  event,
  attended,
  rsvped,
  points,
  onOpen,
}: {
  event: Event
  attended: boolean
  rsvped: boolean
  points: number
  onOpen: () => void
}) {
  const isPast = isEventPast(event.starts_at, event.ends_at)
  const dateOnly = isManualPointsCheckIn(event.check_in_type)
  const rsvpOpen = event.rsvp_url && event.rsvp_deadline && new Date(event.rsvp_deadline) > new Date()
  const rsvpClosed = event.rsvp_url && event.rsvp_deadline && new Date(event.rsvp_deadline) <= new Date()

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`View details for ${event.name}`}
      onClick={onOpen}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen()
        }
      }}
      className={`flex w-full cursor-pointer items-center gap-4 rounded-3xl border border-home-border bg-white px-5 py-4 text-left shadow-sm transition hover:border-primary/25 hover:shadow-[0_8px_28px_rgba(71,121,184,0.1)] ${
        isPast && !attended ? 'opacity-[0.65]' : ''
      }`}
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-lg font-extrabold text-primary">
        {points}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
          <span className="text-sm font-semibold text-text">{event.name}</span>
          {attended && (
            <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold leading-none text-primary">
              ✓ Attended
            </span>
          )}
          {rsvped && (
            <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold leading-none text-green-800">
              RSVPed
            </span>
          )}
        </div>
        <EventMetaRow className="mt-2">
          <EventMetaItem>
            <IconLabel
              icon={Clock}
              label={formatEventSchedule(event.starts_at, event.ends_at, { dateOnly })}
              size="sm"
            />
          </EventMetaItem>
          {!dateOnly && event.location && (
            <EventMetaItem>
              <IconLabel
                icon={MapPin}
                label={event.location}
                size="sm"
                href={event.location_maps_url}
                onClick={e => e.stopPropagation()}
              />
            </EventMetaItem>
          )}
          <EventMetaChip>
            <CheckInTypeBadge checkInType={event.check_in_type} />
          </EventMetaChip>
        </EventMetaRow>
      </div>

      {rsvpOpen && (
        <a
          href={event.rsvp_url!}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          className="shrink-0 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#35679e]"
        >
          Sign Up
        </a>
      )}
      {rsvpClosed && (
        <span className="shrink-0 rounded-xl border border-home-border bg-bg px-4 py-2 text-sm font-medium text-subtitle">
          RSVP Closed
        </span>
      )}
    </div>
  )
}

function EventDetailModal({
  event,
  attended,
  rsvped,
  points,
  onClose,
}: {
  event: Event
  attended: boolean
  rsvped: boolean
  points: number
  onClose: () => void
}) {
  const rsvpOpen = event.rsvp_url && event.rsvp_deadline && new Date(event.rsvp_deadline) > new Date()
  const rsvpClosed = event.rsvp_url && event.rsvp_deadline && new Date(event.rsvp_deadline) <= new Date()
  const dateOnly = isManualPointsCheckIn(event.check_in_type)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-4xl border border-home-border bg-white p-6 shadow-xl sm:p-8"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="member-event-detail-title"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2
                id="member-event-detail-title"
                className="text-xl font-bold text-text"
              >
                {event.name}
              </h2>
              {attended && (
                <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold leading-none text-primary">
                  ✓ Attended
                </span>
              )}
              {rsvped && (
                <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold leading-none text-green-800">
                  RSVPed
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-subtitle">
              {points} pt{points === 1 ? '' : 's'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-xl border border-home-border bg-bg p-2 text-subtitle transition hover:border-primary/30 hover:text-primary"
            aria-label="Close"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>

        <div className="mt-5 flex flex-col gap-3 text-sm text-text">
          <div className="flex items-center">
            <CategoryBadge category={event.category} />
          </div>
          <div className="flex items-center">
            <IconLabel
              icon={Clock}
              label={formatEventSchedule(event.starts_at, event.ends_at, { dateOnly })}
            />
          </div>
          {!dateOnly && event.location && (
            <div className="flex items-center">
              <IconLabel
                icon={MapPin}
                label={event.location}
                href={event.location_maps_url}
              />
            </div>
          )}
          <div className="flex items-center">
            <CheckInTypeBadge checkInType={event.check_in_type} />
          </div>
        </div>

        {event.description ? (
          <p className="mt-5 whitespace-pre-wrap text-sm leading-6 text-subtitle">
            {event.description}
          </p>
        ) : (
          <p className="mt-5 text-sm italic text-subtitle">No description provided.</p>
        )}

        {event.rsvp_url && (
          <div className="mt-6 rounded-2xl border border-home-border bg-bg p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-subtitle">
              RSVP
            </div>
            {event.rsvp_deadline && (
              <p className="mt-1 text-sm text-text">
                Deadline:{' '}
                {new Date(event.rsvp_deadline).toLocaleString(undefined, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </p>
            )}
            {rsvpOpen && (
              <a
                href={event.rsvp_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#35679e]"
              >
                Open RSVP form
              </a>
            )}
            {rsvpClosed && (
              <p className="mt-2 text-sm font-medium text-subtitle">RSVP is closed.</p>
            )}
            {!event.rsvp_deadline && (
              <a
                href={event.rsvp_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#35679e]"
              >
                Open RSVP form
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default function MemberEventsClient({
  events,
  attendedIds,
  rsvpedIds,
  earnedPointsByEventId,
  semester,
}: Props) {
  const [showPast, setShowPast] = useState(false)
  const [filter, setFilter] = useState<EventFilterTabId>('all')
  const [search, setSearch] = useState('')
  const [upcomingPage, setUpcomingPage] = useState(1)
  const [pastPage, setPastPage] = useState(1)
  const [detailEvent, setDetailEvent] = useState<Event | null>(null)

  const filteredEvents = useMemo(() => {
    const q = search.trim().toLowerCase()
    return events.filter(e => {
      if (!eventMatchesFilter(e, filter)) return false
      if (!q) return true
      return e.name.toLowerCase().includes(q)
    })
  }, [events, filter, search])

  const filterCounts = useMemo(() => {
    const q = search.trim().toLowerCase()
    const searched = q
      ? events.filter(e => e.name.toLowerCase().includes(q))
      : events
    const counts: Partial<Record<EventFilterTabId, number>> = {}
    for (const tab of EVENT_FILTER_TABS) {
      counts[tab.id] = searched.filter(
        e => !isEventPast(e.starts_at, e.ends_at) && eventMatchesFilter(e, tab.id),
      ).length
    }
    return counts
  }, [events, search])

  const upcoming = useMemo(
    () => sortEventsByStartsAt(filteredEvents.filter(e => !isEventPast(e.starts_at, e.ends_at))),
    [filteredEvents],
  )
  const past = useMemo(
    () => sortEventsByStartsAt(
      filteredEvents.filter(e => isEventPast(e.starts_at, e.ends_at)),
      'desc',
    ),
    [filteredEvents],
  )

  useEffect(() => {
    setUpcomingPage(1)
    setPastPage(1)
  }, [filter, search])

  const upcomingPageData = paginateItems(upcoming, upcomingPage)
  const pastPageData = paginateItems(past, pastPage)

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 lg:px-8">
      <PageHeader
        title="Events"
        subtitle={semester?.name ?? 'Current Semester'}
        className="mb-6"
      />

      {events.length > 0 && (
        <>
          <input
            type="search"
            placeholder="Search events by name…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="mb-3 w-full rounded-xl border border-home-border bg-white px-4 py-3 text-sm text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
          />
          <EventFilterTabs value={filter} onChange={setFilter} counts={filterCounts} />
        </>
      )}

      {events.length === 0 && (
        <EmptyState
          icon={Calendar}
          title="No upcoming events this semester"
          description="Check back later — officers will post events here as they're scheduled."
        />
      )}

      {events.length > 0 && upcoming.length === 0 && past.length === 0 && (
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

      {upcoming.length > 0 && (
        <div className="mb-8">
          <EventListPager
            page={upcomingPageData.page}
            totalCount={upcomingPageData.totalCount}
            onPageChange={setUpcomingPage}
            className="mb-4"
          />
          <div className="flex flex-col gap-3">
            {upcomingPageData.items.map(event => (
              <EventCard
                key={event.id}
                event={event}
                attended={attendedIds.has(event.id)}
                rsvped={rsvpedIds.has(event.id)}
                points={displayPoints(event, earnedPointsByEventId)}
                onOpen={() => setDetailEvent(event)}
              />
            ))}
          </div>
          <EventListPager
            page={upcomingPageData.page}
            totalCount={upcomingPageData.totalCount}
            onPageChange={setUpcomingPage}
          />
        </div>
      )}

      {past.length > 0 && (
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
            {showPast ? '▲ Hide' : '▼ Show'} Past Events ({past.length})
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
                {pastPageData.items.map(event => (
                  <EventCard
                    key={event.id}
                    event={event}
                    attended={attendedIds.has(event.id)}
                    rsvped={rsvpedIds.has(event.id)}
                    points={displayPoints(event, earnedPointsByEventId)}
                    onOpen={() => setDetailEvent(event)}
                  />
                ))}
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

      {detailEvent && (
        <EventDetailModal
          event={detailEvent}
          attended={attendedIds.has(detailEvent.id)}
          rsvped={rsvpedIds.has(detailEvent.id)}
          points={displayPoints(detailEvent, earnedPointsByEventId)}
          onClose={() => setDetailEvent(null)}
        />
      )}
    </div>
  )
}
