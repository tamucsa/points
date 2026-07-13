'use client'

import { useEffect, useMemo, useState } from 'react'
import IconLabel, { CheckInTypeBadge } from '@/app/components/IconLabel'
import EmptyState from '@/app/components/EmptyState'
import EventFilterTabs from '@/app/components/EventFilterTabs'
import EventListPager, { paginateItems } from '@/app/components/EventListPager'
import { EventMetaChip, EventMetaItem, EventMetaRow } from '@/app/components/EventMeta'
import PageHeader from '@/app/components/PageHeader'
import { formatEventSchedule, isEventPast, sortEventsByStartsAt } from '@/utils/datetime'
import {
  EVENT_FILTER_TABS,
  eventMatchesFilter,
  type EventFilterTabId,
} from '@/utils/events'
import { Calendar, Clock, MapPin } from 'lucide-react'

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
  rsvp_url: string | null
  rsvp_deadline: string | null
}

interface Props {
  events: Event[]
  attendedIds: Set<string>
  semester: { name: string } | null
}

function EventCard({ event, attended }: { event: Event; attended: boolean }) {
  const isPast = isEventPast(event.starts_at)
  const rsvpOpen = event.rsvp_url && event.rsvp_deadline && new Date(event.rsvp_deadline) > new Date()
  const rsvpClosed = event.rsvp_url && event.rsvp_deadline && new Date(event.rsvp_deadline) <= new Date()

  return (
    <div
      className="flex items-center gap-4 rounded-3xl border border-home-border bg-white px-5 py-4 shadow-sm"
      style={{ opacity: isPast && !attended ? 0.65 : 1 }}
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-lg font-extrabold text-primary">
        {event.point_value}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-text">{event.name}</span>
          {attended && (
            <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold leading-none text-primary">
              ✓ Attended
            </span>
          )}
        </div>
        <EventMetaRow className="mt-2">
          <EventMetaItem>
            <IconLabel icon={Clock} label={formatEventSchedule(event.starts_at, event.ends_at)} size="sm" />
          </EventMetaItem>
          {event.location && (
            <EventMetaItem>
              <IconLabel icon={MapPin} label={event.location} size="sm" />
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

export default function MemberEventsClient({ events, attendedIds, semester }: Props) {
  const [showPast, setShowPast] = useState(false)
  const [filter, setFilter] = useState<EventFilterTabId>('all')
  const [search, setSearch] = useState('')
  const [upcomingPage, setUpcomingPage] = useState(1)
  const [pastPage, setPastPage] = useState(1)

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
        e => !isEventPast(e.starts_at) && eventMatchesFilter(e, tab.id),
      ).length
    }
    return counts
  }, [events, search])

  const upcoming = useMemo(
    () => sortEventsByStartsAt(filteredEvents.filter(e => !isEventPast(e.starts_at))),
    [filteredEvents],
  )
  const past = useMemo(
    () => sortEventsByStartsAt(
      filteredEvents.filter(e => isEventPast(e.starts_at)),
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
    </div>
  )
}
