"use client";

import { ClipboardList, Clock, MapPin, UserX } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import EventRsvpPanel from "@/app/(dashboard)/(officer)/officer/events/components/EventRsvpPanel";
import { officerRemoveCheckIn } from "@/app/actions/attendance";
import {
  publishEvent,
  updateEventMixerFamilies,
  updateEventRsvp,
  updateEventSchedule,
} from "@/app/actions/events";
import { publishJiatingStandings } from "@/app/actions/jt-standings";
import type { EventRsvpRow } from "@/app/actions/rsvp";
import BackLink from "@/app/components/BackLink";
import EmptyState from "@/app/components/EmptyState";
import IconLabel, { CheckInMethodBadge } from "@/app/components/IconLabel";
import LocationAutocomplete from "@/app/components/LocationAutocomplete";
import CollapsibleSettings from "@/app/components/CollapsibleSettings";
import MemberAvatar from "@/app/components/MemberAvatar";
import { inputClassName, labelClassName } from "@/utils/constants";
import { EVENT_TIMEZONE, formatEventSchedule } from "@/utils/datetime";
import {
  eventTimestampToFormDate,
  eventTimestampToFormTime,
} from "@/utils/event-times";
import { isGeneralMeetingCategory, isMixerCategory } from "@/utils/events";

interface Event {
  id: string;
  name: string;
  category: string;
  point_value: number;
  check_in_type: string;
  starts_at: string;
  ends_at: string | null;
  location: string | null;
  location_maps_url?: string | null;
  description: string | null;
  check_in_code: string | null;
  rsvp_url: string | null;
  rsvp_deadline: string | null;
  publish_status?: "draft" | "scheduled" | "published" | null;
  publish_at?: string | null;
}

interface AttendanceRow {
  id: string;
  member_id: string;
  check_in_method: string;
  verified: boolean;
  counted: boolean;
  recorded_at: string;
  members: {
    id: string;
    full_name: string;
    profile_image_url: string | null;
  } | null;
}

interface PublishedSnapshot {
  id: string;
  snapshot_at: string;
  label: string | null;
}

interface JTFamily {
  id: string;
  name: string;
}

interface Props {
  event: Event;
  attendance: AttendanceRow[];
  attendanceLoadError?: string | null;
  publishedSnapshot: PublishedSnapshot | null;
  jtFamilies: JTFamily[];
  mixerFamilyIds: string[];
  spectatorEvent: {
    id: string;
    name: string;
    check_in_code: string | null;
    point_value: number;
  } | null;
  rsvpRows: EventRsvpRow[];
  rsvpMatchMembers: { id: string; full_name: string; email: string }[];
}

const btnPrimaryClassName =
  "rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#35679e] disabled:cursor-not-allowed disabled:opacity-60 sm:py-2";

const btnPrimaryOutlineClassName =
  "rounded-xl border border-primary/30 bg-primary/10 px-4 py-2.5 text-sm font-semibold text-primary transition hover:border-primary/50 hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-60 sm:py-2";

const btnSecondaryClassName =
  "rounded-xl border border-home-border bg-white px-4 py-2.5 text-sm font-semibold text-subtitle transition hover:border-primary/30 hover:bg-bg hover:text-text sm:py-2";

export default function EventDetailClient({
  event,
  attendance,
  attendanceLoadError = null,
  publishedSnapshot,
  jtFamilies,
  mixerFamilyIds,
  spectatorEvent,
  rsvpRows,
  rsvpMatchMembers,
}: Props) {
  const router = useRouter();
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [published, setPublished] = useState(publishedSnapshot);
  const [eventPublishing, setEventPublishing] = useState(false);
  const [eventPublishError, setEventPublishError] = useState<string | null>(
    null,
  );
  const publishStatus = event.publish_status ?? "published";
  const canPublishEvent =
    publishStatus === "draft" || publishStatus === "scheduled";
  const [rsvpUrl, setRsvpUrl] = useState(event.rsvp_url ?? "");
  const [rsvpDeadline, setRsvpDeadline] = useState(
    event.rsvp_deadline ? event.rsvp_deadline.slice(0, 16) : "",
  );
  const [rsvpSaving, setRsvpSaving] = useState(false);
  const [rsvpError, setRsvpError] = useState<string | null>(null);
  const [rsvpSaved, setRsvpSaved] = useState(false);
  const [selectedMixerFamilies, setSelectedMixerFamilies] =
    useState(mixerFamilyIds);
  const [mixerSaving, setMixerSaving] = useState(false);
  const [mixerError, setMixerError] = useState<string | null>(null);
  const [mixerSaved, setMixerSaved] = useState(false);
  const [eventDate, setEventDate] = useState(() =>
    eventTimestampToFormDate(event.starts_at),
  );
  const [startTime, setStartTime] = useState(() =>
    eventTimestampToFormTime(event.starts_at),
  );
  const [endTime, setEndTime] = useState(() =>
    event.ends_at ? eventTimestampToFormTime(event.ends_at) : "",
  );
  const [name, setName] = useState(event.name ?? "");
  const [location, setLocation] = useState(event.location ?? "");
  const [locationMapsUrl, setLocationMapsUrl] = useState<string | null>(
    event.location_maps_url ?? null,
  );
  const [description, setDescription] = useState(event.description ?? "");
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [scheduleSaved, setScheduleSaved] = useState(false);
  const [uncheckTarget, setUncheckTarget] = useState<AttendanceRow | null>(
    null,
  );
  const [uncheckError, setUncheckError] = useState<string | null>(null);
  const [uncheckSaving, setUncheckSaving] = useState(false);
  const isGm = isGeneralMeetingCategory(event.category);
  const isMixer = isMixerCategory(event.category);
  const isRsvpEvent = event.check_in_type === "rsvp_required";

  const closeUncheckModal = () => {
    if (uncheckSaving) return;
    setUncheckTarget(null);
    setUncheckError(null);
  };

  const confirmRemoveCheckIn = async () => {
    if (!uncheckTarget) return;

    setUncheckError(null);
    setUncheckSaving(true);

    const result = await officerRemoveCheckIn(
      event.id,
      uncheckTarget.member_id,
    );

    setUncheckSaving(false);
    if (!result.success) {
      setUncheckError(result.error ?? "Failed to remove check-in.");
      return;
    }

    setUncheckTarget(null);
    setUncheckError(null);
    router.refresh();
  };

  useEffect(() => {
    setName(event.name ?? "");
    setEventDate(eventTimestampToFormDate(event.starts_at));
    setStartTime(eventTimestampToFormTime(event.starts_at));
    setEndTime(event.ends_at ? eventTimestampToFormTime(event.ends_at) : "");
    setLocation(event.location ?? "");
    setLocationMapsUrl(event.location_maps_url ?? null);
    setDescription(event.description ?? "");
  }, [
    event.name,
    event.starts_at,
    event.ends_at,
    event.location,
    event.location_maps_url,
    event.description,
  ]);

  const toggleMixerFamily = (id: string) => {
    setSelectedMixerFamilies((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
    setMixerSaved(false);
    setMixerError(null);
  };

  const handleSaveRsvp = async () => {
    setRsvpSaving(true);
    setRsvpError(null);
    setRsvpSaved(false);

    const result = await updateEventRsvp(
      event.id,
      rsvpUrl.trim() || null,
      rsvpDeadline || null,
    );

    setRsvpSaving(false);
    if (!result.success) {
      setRsvpError(result.error ?? "Failed to save RSVP details.");
      return;
    }
    setRsvpSaved(true);
    router.refresh();
  };

  const handleSaveMixerFamilies = async () => {
    setMixerSaving(true);
    setMixerError(null);
    setMixerSaved(false);

    const result = await updateEventMixerFamilies(
      event.id,
      selectedMixerFamilies,
    );

    setMixerSaving(false);
    if (!result.success) {
      setMixerError(result.error ?? "Failed to save Mixer families.");
      return;
    }
    setMixerSaved(true);
    router.refresh();
  };

  const handleSaveSchedule = async () => {
    setScheduleSaving(true);
    setScheduleError(null);
    setScheduleSaved(false);

    const result = await updateEventSchedule(event.id, {
      name,
      eventDate,
      startTime,
      endTime: endTime.trim() || null,
      location,
      locationMapsUrl,
      description,
    });

    setScheduleSaving(false);
    if (!result.success) {
      setScheduleError(result.error ?? "Failed to save event details.");
      return;
    }
    setScheduleSaved(true);
    router.refresh();
  };

  const handlePublishEvent = async () => {
    setEventPublishing(true);
    setEventPublishError(null);
    const result = await publishEvent(event.id);
    setEventPublishing(false);
    if (!result.success) {
      setEventPublishError(result.error ?? "Failed to publish event.");
      return;
    }
    router.refresh();
  };

  const handlePublishStandings = async () => {
    if (
      !window.confirm(
        "Publish Jiating standings from current point totals? Members will see this snapshot on the leaderboard until the next General Meeting.",
      )
    ) {
      return;
    }

    setPublishing(true);
    setPublishError(null);

    const result = await publishJiatingStandings(event.id);
    setPublishing(false);

    if (!result.success) {
      setPublishError(result.error ?? "Failed to publish standings.");
      return;
    }

    setPublished({
      id: result.snapshotId,
      snapshot_at: new Date().toISOString(),
      label: event.name,
    });
  };

  return (
    <div className="mx-auto max-w-3xl px-6 py-8 lg:px-8">
      <BackLink
        href="/officer/events"
        label="Back to Events"
        className="mb-5"
      />

      <div className="mb-6 rounded-4xl border border-home-border bg-white p-6 shadow-sm">
        <div className="flex gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-2xl font-extrabold text-primary">
            {event.point_value}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold text-text">{event.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {publishStatus === "draft" && (
                <span className="inline-flex items-center rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-semibold leading-none text-stone-700">
                  Draft
                </span>
              )}
              {publishStatus === "scheduled" && (
                <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold leading-none text-amber-900">
                  Scheduled
                  {event.publish_at
                    ? ` · ${new Date(event.publish_at).toLocaleString("en-US", {
                        timeZone: EVENT_TIMEZONE,
                        dateStyle: "medium",
                        timeStyle: "short",
                      })} CT`
                    : ""}
                </span>
              )}
              {publishStatus === "published" && (
                <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold leading-none text-primary">
                  Published
                </span>
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-2 text-sm text-subtitle">
              <IconLabel
                icon={Clock}
                label={formatEventSchedule(event.starts_at, event.ends_at)}
                size="sm"
              />
              {event.location && (
                <IconLabel
                  icon={MapPin}
                  label={event.location}
                  size="sm"
                  href={event.location_maps_url}
                />
              )}
              <span className="rounded-md bg-bg px-2 py-0.5 text-xs">
                {event.category}
              </span>
            </div>
            {event.description && (
              <p className="mt-3 text-sm leading-6 text-subtitle">
                {event.description}
              </p>
            )}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {canPublishEvent && (
            <button
              type="button"
              onClick={() => void handlePublishEvent()}
              disabled={eventPublishing}
              className={btnPrimaryClassName}
            >
              {eventPublishing ? "Publishing…" : "Publish now"}
            </button>
          )}
          {publishStatus === "published" &&
            (event.check_in_type === "officer" ||
              event.check_in_type === "rsvp_required") && (
            <button
              type="button"
              onClick={() => router.push(`/officer/events/${event.id}/checkin`)}
              className={btnPrimaryClassName}
            >
              Check In Members
            </button>
          )}
          {event.check_in_type === "self" && event.check_in_code && (
            <button
              type="button"
              onClick={() =>
                window.open(`/officer/events/${event.id}/qr`, "_blank")
              }
              className={btnPrimaryOutlineClassName}
            >
              {publishStatus === "published"
                ? "Open QR Full Screen"
                : "Preview QR"}
            </button>
          )}
          {publishStatus === "published" &&
            event.check_in_type === "self" &&
            event.check_in_code && (
            <button
              type="button"
              onClick={() =>
                window.open(`/officer/events/${event.id}/qr?print=1`, "_blank")
              }
              className={btnSecondaryClassName}
            >
              Print QR Code
            </button>
          )}
          {publishStatus === "published" && spectatorEvent?.check_in_code && (
            <>
              <button
                type="button"
                onClick={() =>
                  window.open(`/officer/events/${spectatorEvent.id}/qr`, "_blank")
                }
                className={btnPrimaryOutlineClassName}
              >
                Spectator QR Full Screen
              </button>
              <button
                type="button"
                onClick={() =>
                  window.open(
                    `/officer/events/${spectatorEvent.id}/qr?print=1`,
                    "_blank",
                  )
                }
                className={btnSecondaryClassName}
              >
                Print Spectator QR
              </button>
            </>
          )}
          {event.rsvp_url && (
            <a
              href={event.rsvp_url}
              target="_blank"
              rel="noopener noreferrer"
              className={btnSecondaryClassName}
            >
              View RSVP Form
            </a>
          )}
          {isGm && !published && (
            <button
              type="button"
              onClick={() => void handlePublishStandings()}
              disabled={publishing}
              className={btnPrimaryOutlineClassName}
            >
              {publishing ? "Publishing…" : "Publish Jiating standings"}
            </button>
          )}
          {isGm && published && (
            <span className="inline-flex items-center rounded-xl border border-green-200 bg-green-50 px-4 py-2 text-sm font-medium text-green-700">
              Standings published
            </span>
          )}
        </div>
        {eventPublishError && (
          <p className="mt-3 text-sm text-red-600">{eventPublishError}</p>
        )}
        {publishError && (
          <p className="mt-3 text-sm text-red-600">{publishError}</p>
        )}
        <CollapsibleSettings
          title="Event details"
          defaultOpen
          summary={
            [
              event.name,
              formatEventSchedule(event.starts_at, event.ends_at),
              event.location,
              event.description ? "Has description" : null,
            ]
              .filter(Boolean)
              .join(" · ") || "Name, date, location, and description"
          }
        >
          <div>
            <label className={labelClassName} htmlFor="event-edit-name">
              Event name
            </label>
            <input
              id="event-edit-name"
              type="text"
              className={inputClassName}
              placeholder="e.g. First Friday March"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setScheduleSaved(false);
              }}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClassName} htmlFor="event-edit-date">
                Date
              </label>
              <input
                id="event-edit-date"
                type="date"
                className={inputClassName}
                value={eventDate}
                onChange={(e) => {
                  setEventDate(e.target.value);
                  setScheduleSaved(false);
                }}
              />
            </div>
            <div>
              <label className={labelClassName} htmlFor="event-edit-location">
                Location
              </label>
              <LocationAutocomplete
                id="event-edit-location"
                value={location}
                onChange={(value, meta) => {
                  setLocation(value);
                  setLocationMapsUrl(meta?.mapsUrl ?? null);
                  setScheduleSaved(false);
                }}
                placeholder="e.g. MSC 2406"
              />
            </div>
            <div>
              <label className={labelClassName} htmlFor="event-edit-start">
                Start time
              </label>
              <input
                id="event-edit-start"
                type="time"
                className={inputClassName}
                value={startTime}
                onChange={(e) => {
                  setStartTime(e.target.value);
                  setScheduleSaved(false);
                }}
              />
            </div>
            <div>
              <label className={labelClassName} htmlFor="event-edit-end">
                End time{" "}
                <span className="font-normal normal-case text-subtitle">
                  (optional)
                </span>
              </label>
              <input
                id="event-edit-end"
                type="time"
                className={inputClassName}
                value={endTime}
                onChange={(e) => {
                  setEndTime(e.target.value);
                  setScheduleSaved(false);
                }}
              />
            </div>
          </div>
          <div>
            <label className={labelClassName} htmlFor="event-edit-description">
              Description{" "}
              <span className="font-normal normal-case text-subtitle">
                (optional)
              </span>
            </label>
            <textarea
              id="event-edit-description"
              className={`${inputClassName} min-h-24 resize-y`}
              placeholder="What members should know about this event…"
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                setScheduleSaved(false);
              }}
            />
          </div>
          {scheduleError && (
            <p className="text-sm text-red-600">{scheduleError}</p>
          )}
          {scheduleSaved && (
            <p className="text-sm text-green-700">Event details saved.</p>
          )}
          <button
            type="button"
            onClick={() => void handleSaveSchedule()}
            disabled={scheduleSaving}
            className={btnPrimaryClassName}
          >
            {scheduleSaving ? "Saving…" : "Save event details"}
          </button>
        </CollapsibleSettings>
        {spectatorEvent && (
          <div className="mt-5 rounded-2xl border border-home-border bg-bg p-4">
            <div className="text-sm font-semibold text-text">
              Spectator check-in
            </div>
            <p className="mt-1 text-xs leading-5 text-subtitle">
              Linked QR event worth {spectatorEvent.point_value} pt
              {spectatorEvent.point_value === 1 ? "" : "s"} (capped at
              10/semester). Use the Spectator QR buttons above at the event.
            </p>
          </div>
        )}
        {isMixer && (
          <CollapsibleSettings
            title="Participating Jiatings"
            summary={`${selectedMixerFamilies.length} famil${selectedMixerFamilies.length === 1 ? "y" : "ies"} selected`}
          >
            <p className="text-xs leading-5 text-subtitle">
              Add families anytime. Removing a family that already has check-ins
              is blocked until those check-ins are cleared.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {jtFamilies.map((jt) => {
                const checked = selectedMixerFamilies.includes(jt.id);
                return (
                  <label
                    key={jt.id}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition ${
                      checked
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : "border-home-border bg-white text-text hover:border-primary/30"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleMixerFamily(jt.id)}
                      className="size-4 rounded border-home-border text-primary focus:ring-primary/30"
                    />
                    <span className="font-medium">{jt.name}</span>
                  </label>
                );
              })}
            </div>
            {mixerError && <p className="text-sm text-red-600">{mixerError}</p>}
            {mixerSaved && (
              <p className="text-sm text-green-700">
                Participating families saved.
              </p>
            )}
            <button
              type="button"
              onClick={() => void handleSaveMixerFamilies()}
              disabled={mixerSaving}
              className={btnPrimaryClassName}
            >
              {mixerSaving ? "Saving…" : "Save participating families"}
            </button>
          </CollapsibleSettings>
        )}
        {isRsvpEvent && (
          <CollapsibleSettings
            title="RSVP settings"
            summary={
              event.rsvp_url
                ? event.rsvp_deadline
                  ? `Form linked · deadline set`
                  : "Form linked"
                : "Add RSVP link and deadline"
            }
          >
            <div>
              <label className={labelClassName}>RSVP Link</label>
              <input
                className={inputClassName}
                placeholder="https://forms.gle/..."
                value={rsvpUrl}
                onChange={(e) => {
                  setRsvpUrl(e.target.value);
                  setRsvpSaved(false);
                }}
              />
            </div>
            <div>
              <label className={labelClassName}>RSVP Deadline</label>
              <input
                type="datetime-local"
                className={inputClassName}
                value={rsvpDeadline}
                onChange={(e) => {
                  setRsvpDeadline(e.target.value);
                  setRsvpSaved(false);
                }}
              />
            </div>
            {rsvpError && <p className="text-sm text-red-600">{rsvpError}</p>}
            {rsvpSaved && (
              <p className="text-sm text-green-700">RSVP details saved.</p>
            )}
            <button
              type="button"
              onClick={() => void handleSaveRsvp()}
              disabled={rsvpSaving}
              className={btnPrimaryClassName}
            >
              {rsvpSaving ? "Saving…" : "Save RSVP Details"}
            </button>
          </CollapsibleSettings>
        )}
        {isRsvpEvent && (
          <CollapsibleSettings
            title="RSVP CSV / check-in tags"
            summary={`${rsvpRows.length} row${rsvpRows.length === 1 ? "" : "s"} uploaded`}
          >
            <EventRsvpPanel
              eventId={event.id}
              rsvpDeadline={event.rsvp_deadline}
              initialRows={rsvpRows}
              matchMembers={rsvpMatchMembers}
              btnPrimaryClassName={btnPrimaryClassName}
              btnSecondaryClassName={btnSecondaryClassName}
            />
          </CollapsibleSettings>
        )}
        {isGm && published && (
          <p className="mt-3 text-xs text-subtitle">
            Published{" "}
            {new Date(published.snapshot_at).toLocaleString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
            {" · "}
            <button
              type="button"
              onClick={() => router.push("/leaderboard/standings")}
              className="font-medium text-primary hover:underline"
            >
              View on leaderboard
            </button>
          </p>
        )}
      </div>

      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-bold text-text">Attendance</h2>
        <span className="text-sm text-subtitle">
          {attendanceLoadError ? "—" : `${attendance.length} checked in`}
        </span>
      </div>

      <div className="overflow-hidden rounded-4xl border border-home-border bg-white shadow-sm">
        {attendanceLoadError && (
          <div className="px-5 py-6 text-sm text-red-600">
            Could not load attendance. Refresh the page to try again.
          </div>
        )}
        {!attendanceLoadError && attendance.length === 0 && (
          <EmptyState
            icon={ClipboardList}
            title="No check-ins yet"
            description="Members will appear here once they check in to this event."
            compact
          />
        )}
        {!attendanceLoadError &&
          attendance.map((row) => {
            const displayName = row.members?.full_name ?? "Unknown member";
            return (
              <div
                key={row.id}
                className="flex items-center gap-3 border-b border-home-border px-5 py-3 last:border-b-0 sm:gap-4"
              >
                <MemberAvatar
                  name={displayName}
                  profileImageUrl={row.members?.profile_image_url ?? null}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-text">
                    {displayName}
                  </div>
                  <div className="text-xs text-subtitle">
                    {new Date(row.recorded_at).toLocaleTimeString("en-US", {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
                  <span className="rounded-md bg-bg px-2 py-0.5 text-[11px] text-subtitle">
                    <CheckInMethodBadge checkInMethod={row.check_in_method} />
                  </span>
                  {!row.verified && (
                    <span className="rounded-md bg-orange-50 px-2 py-0.5 text-[11px] text-orange-600">
                      Unverified
                    </span>
                  )}
                  {!row.counted && (
                    <span className="rounded-md bg-red-50 px-2 py-0.5 text-[11px] text-red-500">
                      Cap reached
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setUncheckError(null);
                      setUncheckTarget(row);
                    }}
                    disabled={uncheckSaving}
                    className="rounded-xl border border-[#f5b0b0] bg-[#fff4f4] px-3 py-1.5 text-xs font-semibold text-[#c94b4b] transition hover:border-[#e88a8a] hover:bg-[#ffe8e8] disabled:opacity-60"
                  >
                    Remove
                  </button>
                </div>
              </div>
            );
          })}
      </div>

      {uncheckTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={closeUncheckModal}
        >
          <div
            className="w-full max-w-md rounded-4xl border border-home-border bg-white p-6 shadow-xl sm:p-8"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="remove-checkin-title"
          >
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fff4f4]">
              <UserX className="size-5 text-[#c94b4b]" aria-hidden />
            </div>
            <h2
              id="remove-checkin-title"
              className="text-center text-lg font-bold text-text"
            >
              Remove check-in?
            </h2>
            <p className="mt-2 text-center text-sm font-semibold text-text">
              {uncheckTarget.members?.full_name ?? "Unknown member"}
            </p>
            <p className="mt-3 text-center text-sm leading-6 text-subtitle">
              This removes their attendance for {event.name}
              {uncheckTarget.counted
                ? ` and deducts ${event.point_value} point${event.point_value === 1 ? "" : "s"} from their total.`
                : ". This check-in was not counting toward points (cap), so totals stay the same."}
            </p>
            {uncheckError && (
              <p className="mt-4 rounded-2xl border border-[#f5b0b0] bg-[#fff4f4] px-4 py-3 text-center text-sm text-[#c94b4b]">
                {uncheckError}
              </p>
            )}
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={uncheckSaving}
                onClick={closeUncheckModal}
                className="rounded-xl border border-home-border bg-white px-4 py-2.5 text-sm font-semibold text-subtitle transition hover:border-primary/30 hover:bg-bg hover:text-text disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={uncheckSaving}
                onClick={() => void confirmRemoveCheckIn()}
                className="rounded-xl border border-[#f5b0b0] bg-[#fff4f4] px-4 py-2.5 text-sm font-semibold text-[#c94b4b] transition hover:border-[#e88a8a] hover:bg-[#ffe8e8] disabled:opacity-60"
              >
                {uncheckSaving ? "Removing…" : "Remove Check-In"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
