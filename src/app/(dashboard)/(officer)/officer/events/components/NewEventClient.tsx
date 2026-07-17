"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createEvent, type EventPublishMode } from "@/app/actions/events";
import BackLink from "@/app/components/BackLink";
import IconLabel, {
  CheckInTypeBadge,
  ScopeBadge,
} from "@/app/components/IconLabel";
import LocationAutocomplete from "@/app/components/LocationAutocomplete";
import PageHeader from "@/app/components/PageHeader";
import {
  CHECKIN_TYPE_LABELS,
  inputClassName,
  labelClassName,
} from "@/utils/constants";
import {
  applyCategoryDefaults,
  EVENT_CATEGORIES,
  type EventCategory,
  getCategoryConfig,
  getCategoryOwnerHint,
  isMixerCategory,
  isPhilanthropyCategory,
} from "@/utils/events";
import { CHECKIN_TYPE_ICONS } from "@/utils/icons";

interface JTFamily {
  id: string;
  name: string;
}

interface Props {
  semesterId: string;
  semesterName: string;
  jtFamilies: JTFamily[];
  officerJtFamilyId: string | null;
  createdBy: string;
}

const DEFAULT_CATEGORY: EventCategory = "General Meeting";

const BASE_CHECK_IN_OPTIONS = [
  {
    value: "officer" as const,
    label: CHECKIN_TYPE_LABELS.officer,
    icon: CHECKIN_TYPE_ICONS.officer,
  },
  {
    value: "self" as const,
    label: CHECKIN_TYPE_LABELS.self,
    icon: CHECKIN_TYPE_ICONS.self,
  },
  {
    value: "rsvp_required" as const,
    label: CHECKIN_TYPE_LABELS.rsvp_required,
    icon: CHECKIN_TYPE_ICONS.rsvp_required,
  },
];

const MANUAL_POINTS_OPTION = {
  value: "manual_points" as const,
  label: CHECKIN_TYPE_LABELS.manual_points,
  icon: CHECKIN_TYPE_ICONS.manual_points,
};

const checkInTypeBtn = (active: boolean) =>
  `inline-flex min-h-11 w-full items-center justify-center rounded-xl border px-3 py-2.5 text-sm font-medium leading-none transition ${
    active
      ? "border-primary bg-primary/10 text-primary"
      : "border-home-border bg-white text-subtitle hover:border-primary/30"
  }`;

export default function NewEventClient({
  semesterId,
  semesterName,
  jtFamilies,
  officerJtFamilyId,
  createdBy,
}: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mixerFamilyIds, setMixerFamilyIds] = useState<string[]>(
    officerJtFamilyId ? [officerJtFamilyId] : [],
  );
  const [form, setForm] = useState(() => {
    const defaults = applyCategoryDefaults(DEFAULT_CATEGORY, {
      scope: "org",
      check_in_type: "officer",
      has_spectators: false,
    });
    return {
      name: "",
      category: DEFAULT_CATEGORY,
      point_value: defaults.point_value,
      scope: defaults.scope,
      jt_family_id: officerJtFamilyId ?? "",
      check_in_type: defaults.check_in_type,
      event_date: "",
      start_time: "",
      end_time: "",
      location: "",
      location_maps_url: null as string | null,
      description: "",
      rsvp_url: "",
      rsvp_deadline: "",
      has_spectators: defaults.has_spectators,
      schedule_date: "",
      schedule_time: "",
    };
  });

  const set = (key: string, value: string | boolean) =>
    setForm((f) => ({ ...f, [key]: value }));

  const categoryConfig = getCategoryConfig(form.category);
  const categoryOwnerHint = getCategoryOwnerHint(form.category);
  const fixedCheckIn = categoryConfig?.checkInType;
  const effectiveCheckIn = fixedCheckIn ?? form.check_in_type;
  const isSports = categoryConfig?.allowSpectators === true;
  const isJTSpecific = form.scope === "jt_specific";
  const isMixer = isMixerCategory(form.category);
  const isPhilanthropy = isPhilanthropyCategory(form.category);
  const isRSVP = effectiveCheckIn === "rsvp_required";
  const isSelf = effectiveCheckIn === "self";
  const isCsvImport = effectiveCheckIn === "csv_import";
  const isManualPoints = effectiveCheckIn === "manual_points";
  const checkInOptions = isPhilanthropy
    ? [...BASE_CHECK_IN_OPTIONS, MANUAL_POINTS_OPTION]
    : BASE_CHECK_IN_OPTIONS;

  const toggleMixerFamily = (id: string) => {
    setMixerFamilyIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleCategoryChange = (category: string) => {
    setForm((f) => {
      const next = applyCategoryDefaults(category as EventCategory, {
        scope: f.scope,
        check_in_type: f.check_in_type,
        has_spectators: f.has_spectators,
      });
      // manual_points is Philanthropy-only; drop it when leaving that category
      // unless the new category fixes check-in type.
      const config = getCategoryConfig(category);
      if (
        !config?.checkInType &&
        next.check_in_type === "manual_points" &&
        category !== "Philanthropy"
      ) {
        next.check_in_type = "officer";
      }
      return { ...f, ...next };
    });
  };

  const handleSubmit = async (publishMode: EventPublishMode) => {
    setSubmitting(true);
    setError(null);

    if (isMixer && mixerFamilyIds.length < 2) {
      setError("Select at least two Jiatings for a Mixer.");
      setSubmitting(false);
      return;
    }

    if (publishMode === "schedule") {
      if (!form.schedule_date || !form.schedule_time) {
        setError("Enter a publish date and time (Central Time) to schedule.");
        setSubmitting(false);
        return;
      }
    }

    const result = await createEvent({
      semesterId,
      name: form.name,
      category: form.category,
      pointValue: parseInt(form.point_value),
      scope: form.scope,
      jtFamilyId: isJTSpecific ? form.jt_family_id : null,
      jtFamilyIds: isMixer ? mixerFamilyIds : [],
      checkInType: effectiveCheckIn,
      eventDate: form.event_date,
      startTime: isManualPoints ? "" : form.start_time,
      endTime: isManualPoints ? null : form.end_time.trim() || null,
      location: isManualPoints ? "" : form.location.trim(),
      locationMapsUrl: isManualPoints ? null : form.location_maps_url || null,
      description: form.description.trim() || null,
      rsvpUrl: isRSVP && form.rsvp_url ? form.rsvp_url.trim() : null,
      rsvpDeadline: isRSVP && form.rsvp_deadline ? form.rsvp_deadline : null,
      createdBy,
      hasSpectators: isSports && form.has_spectators,
      publishMode,
      scheduleDate: form.schedule_date || null,
      scheduleTime: form.schedule_time || null,
    });

    setSubmitting(false);
    if (!result.success) {
      setError(result.error ?? "Failed to create event.");
      return;
    }
    router.replace("/officer/events");
  };

  return (
    <div className="mx-auto max-w-2xl px-6 py-8 lg:px-8">
      <BackLink href="/officer/events" label="Back to Events" />
      <PageHeader title="New Event" subtitle={semesterName} />

      <div className="mt-6 flex flex-col gap-5 rounded-4xl border border-home-border bg-white p-6 shadow-sm">
        <div>
          <label className={labelClassName}>Event Name *</label>
          <input
            className={inputClassName}
            placeholder="e.g. First Friday March"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
          />
        </div>

        <div>
          <label className={labelClassName}>Category *</label>
          <select
            className={`${inputClassName} cursor-pointer`}
            value={form.category}
            onChange={(e) => handleCategoryChange(e.target.value)}
          >
            {EVENT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          {categoryConfig && (
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-subtitle">
              <span className="rounded-md bg-bg px-2 py-1">
                {isManualPoints
                  ? "Variable pts"
                  : `${categoryConfig.pointValue} pt${
                      categoryConfig.pointValue === 1 ? "" : "s"
                    }`}
              </span>
              <span className="rounded-md bg-bg px-2 py-1">
                <ScopeBadge scope={categoryConfig.scope} />
              </span>
              {fixedCheckIn && (
                <span className="rounded-md bg-bg px-2 py-1">
                  <CheckInTypeBadge checkInType={effectiveCheckIn} />
                </span>
              )}
            </div>
          )}
          {categoryOwnerHint && (
            <p className="mt-2 text-xs leading-5 text-subtitle">
              {categoryOwnerHint}.
            </p>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className={isManualPoints ? "sm:col-span-2" : undefined}>
            <label className={labelClassName}>Date *</label>
            <input
              type="date"
              className={inputClassName}
              value={form.event_date}
              onChange={(e) => set("event_date", e.target.value)}
            />
          </div>
          {!isManualPoints && (
            <div>
              <label className={labelClassName}>Start Time *</label>
              <input
                type="time"
                className={inputClassName}
                value={form.start_time}
                onChange={(e) => set("start_time", e.target.value)}
              />
            </div>
          )}
        </div>

        {!isManualPoints && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClassName}>
                End Time{" "}
                <span className="font-normal normal-case text-subtitle">
                  (optional)
                </span>
              </label>
              <input
                type="time"
                className={inputClassName}
                value={form.end_time}
                onChange={(e) => set("end_time", e.target.value)}
              />
            </div>
            <div>
              <label className={labelClassName}>Location *</label>
              <LocationAutocomplete
                value={form.location}
                onChange={(value, meta) => {
                  setForm(f => ({
                    ...f,
                    location: value,
                    location_maps_url: meta?.mapsUrl ?? null,
                  }))
                }}
                placeholder="e.g. MSC 2406"
                required
              />
            </div>
          </div>
        )}

        {isManualPoints && (
          <p className="-mt-2 text-xs text-subtitle">
            Manual points are date-only (no time or location) — for virtual
            opportunities like Dare Week donations.
          </p>
        )}

        {isJTSpecific && (
          <div>
            <label className={labelClassName}>JT Family *</label>
            <select
              className={`${inputClassName} cursor-pointer`}
              value={form.jt_family_id}
              onChange={(e) => set("jt_family_id", e.target.value)}
            >
              <option value="">Select JT family…</option>
              {jtFamilies.map((jt) => (
                <option key={jt.id} value={jt.id}>
                  {jt.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {isMixer && (
          <div>
            <label className={labelClassName}>Participating Jiatings *</label>
            <p className="mb-3 text-xs leading-5 text-subtitle">
              Select the families in this Mixer. Check-in will only show tabs
              for these families.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {jtFamilies.map((jt) => {
                const checked = mixerFamilyIds.includes(jt.id);
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
          </div>
        )}

        {!fixedCheckIn && (
          <div>
            <label className={labelClassName}>Check-in Type *</label>
            <div
              className={`grid gap-2 ${
                checkInOptions.length >= 4
                  ? "grid-cols-2"
                  : "sm:grid-cols-3"
              }`}
            >
              {checkInOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => set("check_in_type", opt.value)}
                  className={checkInTypeBtn(form.check_in_type === opt.value)}
                >
                  <IconLabel
                    icon={opt.icon}
                    label={opt.label}
                    size="sm"
                    className="justify-center"
                    iconClassName={
                      form.check_in_type === opt.value
                        ? "text-primary"
                        : "text-subtitle"
                    }
                    labelClassName={
                      form.check_in_type === opt.value
                        ? "whitespace-nowrap text-primary"
                        : "whitespace-nowrap"
                    }
                  />
                </button>
              ))}
            </div>
            {isSelf && (
              <p className="mt-2 text-xs text-subtitle">
                A QR code is generated automatically when the event is created.
              </p>
            )}
            {isManualPoints && (
              <p className="mt-2 text-xs text-subtitle">
                After publishing, upload a CSV with name, email, and points per
                member. Variable amounts count toward Philanthropy (CSA).
              </p>
            )}
          </div>
        )}

        {fixedCheckIn === "self" && (
          <p className="text-xs text-subtitle">
            Members scan a QR code to check themselves in.
          </p>
        )}

        {isCsvImport && (
          <p className="text-xs text-subtitle">
            After publishing, upload the shared Google Form CSV. Only rows whose
            Organization contains &ldquo;CSA&rdquo; are checked in (3 pts each).
          </p>
        )}

        {isRSVP && (
          <div className="space-y-4 rounded-2xl border border-home-border bg-bg p-4">
            <p className="text-xs text-subtitle">
              RSVP link and deadline are optional now — you can add them later
              from the event detail page once the form is ready.
            </p>
            <div>
              <label className={labelClassName}>
                RSVP Link{" "}
                <span className="font-normal normal-case text-subtitle">
                  (optional)
                </span>
              </label>
              <input
                className={inputClassName}
                placeholder="https://forms.gle/..."
                value={form.rsvp_url}
                onChange={(e) => set("rsvp_url", e.target.value)}
              />
            </div>
            <div>
              <label className={labelClassName}>
                RSVP Deadline{" "}
                <span className="font-normal normal-case text-subtitle">
                  (optional)
                </span>
              </label>
              <input
                type="datetime-local"
                className={inputClassName}
                value={form.rsvp_deadline}
                onChange={(e) => set("rsvp_deadline", e.target.value)}
              />
            </div>
          </div>
        )}

        {isSports && (
          <div className="flex items-center justify-between rounded-2xl border border-home-border bg-bg p-4">
            <div>
              <div className="text-sm font-semibold text-text">
                Enable Spectator Check-in
              </div>
              <div className="mt-1 text-xs text-subtitle">
                Separate QR event worth 1 pt (capped at 10/semester)
              </div>
            </div>
            <button
              type="button"
              onClick={() => set("has_spectators", !form.has_spectators)}
              className={`relative h-6 w-11 rounded-full transition ${form.has_spectators ? "bg-primary" : "bg-home-border"}`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${form.has_spectators ? "left-[1.35rem]" : "left-0.5"}`}
              />
            </button>
          </div>
        )}

        <div>
          <label className={labelClassName}>
            Description{" "}
            <span className="font-normal normal-case text-subtitle">
              (optional)
            </span>
          </label>
          <textarea
            className={`${inputClassName} min-h-24 resize-y`}
            placeholder="Additional details…"
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
          />
        </div>

        {error && (
          <div className="rounded-2xl border border-[#f5b0b0] bg-[#fff4f4] p-3">
            <p className="text-sm text-[#c94b4b]">{error}</p>
          </div>
        )}

        <div className="rounded-2xl border border-home-border bg-bg p-4">
          <label className={labelClassName}>
            Schedule publish{" "}
            <span className="font-normal normal-case text-subtitle">
              (optional — Central Time)
            </span>
          </label>
          <p className="mb-3 text-xs leading-5 text-subtitle">
            Set a date and time, then use Schedule Publish. Leave blank to draft
            or publish immediately.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClassName} htmlFor="schedule-date">
                Publish date
              </label>
              <input
                id="schedule-date"
                type="date"
                className={inputClassName}
                value={form.schedule_date}
                onChange={(e) => set("schedule_date", e.target.value)}
              />
            </div>
            <div>
              <label className={labelClassName} htmlFor="schedule-time">
                Publish time
              </label>
              <input
                id="schedule-time"
                type="time"
                className={inputClassName}
                value={form.schedule_time}
                onChange={(e) => set("schedule_time", e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          <button
            type="button"
            onClick={() => void handleSubmit("draft")}
            disabled={submitting}
            className="rounded-xl border border-home-border bg-white px-4 py-3 text-[15px] font-semibold text-subtitle transition hover:border-primary/30 hover:text-text disabled:opacity-60"
          >
            {submitting ? "Saving…" : "Draft Event"}
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit("schedule")}
            disabled={submitting}
            className="rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-[15px] font-semibold text-primary transition hover:bg-primary/20 disabled:opacity-60"
          >
            {submitting ? "Scheduling…" : "Schedule Publish"}
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit("publish")}
            disabled={submitting}
            className="rounded-xl bg-primary px-4 py-3 text-[15px] font-semibold text-white disabled:bg-[#9cb8d8]"
          >
            {submitting ? "Publishing…" : "Publish Event"}
          </button>
        </div>
      </div>
    </div>
  );
}
