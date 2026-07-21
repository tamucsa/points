"use client";

import { type KeyboardEvent, useEffect, useId, useRef, useState } from "react";
import { inputClassName } from "@/utils/constants";

type Suggestion = {
  placeId: string;
  primaryText: string;
  secondaryText: string;
};

export type LocationChangeMeta = {
  /** Google Maps URI when a Place suggestion was selected; null for free text. */
  mapsUrl: string | null;
};

type Props = {
  id?: string;
  value: string;
  onChange: (value: string, meta?: LocationChangeMeta) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
};

function newSessionToken() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function LocationAutocomplete({
  id,
  value,
  onChange,
  placeholder = "e.g. MSC 2406",
  required,
  disabled,
  className = inputClassName,
}: Props) {
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const sessionTokenRef = useRef(newSessionToken());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [selecting, setSelecting] = useState(false);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setHighlight(-1);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  function clearSuggestions() {
    setSuggestions([]);
    setOpen(false);
    setHighlight(-1);
    setLoadingSuggestions(false);
  }

  function scheduleFetch(query: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    abortRef.current?.abort();

    const trimmed = query.trim();
    if (trimmed.length < 2) {
      clearSuggestions();
      return;
    }

    debounceRef.current = setTimeout(async () => {
      const controller = new AbortController();
      abortRef.current = controller;
      setLoadingSuggestions(true);

      try {
        const response = await fetch("/api/places/autocomplete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            input: trimmed,
            sessionToken: sessionTokenRef.current,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          clearSuggestions();
          return;
        }

        const data = (await response.json()) as {
          suggestions?: Suggestion[];
          disabled?: boolean;
        };

        if (data.disabled) {
          clearSuggestions();
          return;
        }

        const next = data.suggestions ?? [];
        setSuggestions(next);
        setOpen(next.length > 0);
        setHighlight(next.length > 0 ? 0 : -1);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        clearSuggestions();
      } finally {
        if (abortRef.current === controller) {
          setLoadingSuggestions(false);
        }
      }
    }, 280);
  }

  async function selectSuggestion(suggestion: Suggestion) {
    setSelecting(true);
    clearSuggestions();

    // Place name only (not full address). Maps link comes from Place Details.
    const fallbackName = suggestion.primaryText;

    try {
      const response = await fetch("/api/places/details", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          placeId: suggestion.placeId,
          sessionToken: sessionTokenRef.current,
        }),
      });

      if (response.ok) {
        const data = (await response.json()) as {
          location?: string;
          mapsUrl?: string | null;
        };
        onChange(data.location?.trim() || fallbackName, {
          mapsUrl: data.mapsUrl?.trim() || null,
        });
      } else {
        onChange(fallbackName, { mapsUrl: null });
      }
    } catch {
      onChange(fallbackName, { mapsUrl: null });
    } finally {
      sessionTokenRef.current = newSessionToken();
      setSelecting(false);
    }
  }

  function onInputChange(next: string) {
    // Free-text edits clear any previous Place Maps link.
    onChange(next, { mapsUrl: null });
    scheduleFetch(next);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) {
      if (event.key === "Escape") clearSuggestions();
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlight((prev) => (prev + 1) % suggestions.length);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlight((prev) => (prev <= 0 ? suggestions.length - 1 : prev - 1));
      return;
    }

    if (event.key === "Enter" && highlight >= 0) {
      event.preventDefault();
      void selectSuggestion(suggestions[highlight]);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      clearSuggestions();
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <input
        id={id}
        type="text"
        className={className}
        placeholder={placeholder}
        value={value}
        required={required}
        disabled={disabled || selecting}
        autoComplete="off"
        onChange={(e) => onInputChange(e.target.value)}
        onFocus={() => {
          if (suggestions.length > 0) setOpen(true);
        }}
        onKeyDown={onKeyDown}
      />

      {open && suggestions.length > 0 && (
        <div
          id={listboxId}
          className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-home-border bg-surface py-1 shadow-theme-md"
        >
          {suggestions.map((suggestion, index) => {
            const active = index === highlight;
            return (
              <button
                key={suggestion.placeId}
                id={`${listboxId}-option-${index}`}
                type="button"
                className={`block w-full px-3 py-2.5 text-left ${
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-text hover:bg-bg"
                }`}
                onMouseEnter={() => setHighlight(index)}
                onMouseDown={(event) => {
                  event.preventDefault();
                  void selectSuggestion(suggestion);
                }}
              >
                <div className="text-sm font-medium leading-5">
                  {suggestion.primaryText}
                </div>
                {suggestion.secondaryText && (
                  <div className="mt-0.5 text-xs leading-4 text-subtitle">
                    {suggestion.secondaryText}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      <p className="mt-1.5 text-xs leading-5 text-subtitle">
        {selecting || loadingSuggestions
          ? selecting
            ? "Applying place…"
            : "Searching places…"
          : "Pick a suggestion for a map pin, or type a room name."}
      </p>
    </div>
  );
}
