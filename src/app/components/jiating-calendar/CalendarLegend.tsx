"use client";

import { Check } from "lucide-react";
import {
  type CalendarFamily,
  LAYER_KINDS,
  LAYER_META,
  type LayerKind,
  type LayerVisibility,
} from "@/utils/jiating-calendar-view";
import { familyColor } from "./shared";

interface Props {
  families: CalendarFamily[];
  checked: ReadonlySet<string>;
  onToggle: (familyId: string) => void;
  onOnly: (familyId: string) => void;
  onSetAll: (checked: boolean) => void;
  layers: LayerVisibility;
  onToggleLayer: (layer: LayerKind) => void;
  /** Visible-week event counts per family id, plus each layer kind. */
  counts: Record<string, number>;
}

function LegendCheckbox({
  label,
  color,
  checked,
  count,
  onToggle,
  onOnly,
}: {
  label: string;
  color: string;
  checked: boolean;
  count: number;
  onToggle: () => void;
  onOnly?: () => void;
}) {
  return (
    <li className="group flex items-center gap-1">
      <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-xl px-2 py-1.5 text-sm transition hover:bg-bg">
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          className="peer sr-only"
        />
        <span
          className="flex size-4 shrink-0 items-center justify-center rounded border-2 peer-focus-visible:ring-2 peer-focus-visible:ring-primary/40"
          style={{
            borderColor: color,
            background: checked ? color : "transparent",
          }}
          aria-hidden
        >
          {checked && <Check className="size-3 text-white" strokeWidth={3} />}
        </span>
        <span
          className={`min-w-0 flex-1 truncate font-semibold ${checked ? "text-text" : "text-subtitle"}`}
        >
          {label}
        </span>
        <span className="tabular-nums text-xs text-subtitle">{count}</span>
      </label>
      {onOnly && (
        <button
          type="button"
          onClick={onOnly}
          className="shrink-0 rounded-lg px-1.5 py-1 text-[11px] font-semibold text-primary transition hover:bg-primary/10 focus:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
          aria-label={`Show only ${label}`}
        >
          Only
        </button>
      )}
    </li>
  );
}

export default function CalendarLegend({
  families,
  checked,
  onToggle,
  onOnly,
  onSetAll,
  layers,
  onToggleLayer,
  counts,
}: Props) {
  const allChecked = families.every((f) => checked.has(f.id));
  return (
    <div className="rounded-3xl border border-home-border bg-surface p-3 shadow-sm">
      <div className="mb-1 flex items-center justify-between px-2">
        <h2 className="text-xs font-bold uppercase tracking-wide text-subtitle">
          Jiatings
        </h2>
        <button
          type="button"
          onClick={() => onSetAll(!allChecked)}
          className="rounded-lg px-1.5 py-1 text-[11px] font-semibold text-primary transition hover:bg-primary/10"
        >
          {allChecked ? "Clear" : "All"}
        </button>
      </div>
      <ul className="grid grid-cols-2 gap-x-2 lg:grid-cols-1">
        {families.map((family) => (
          <LegendCheckbox
            key={family.id}
            label={family.name}
            color={familyColor(family)}
            checked={checked.has(family.id)}
            count={counts[family.id] ?? 0}
            onToggle={() => onToggle(family.id)}
            onOnly={() => onOnly(family.id)}
          />
        ))}
      </ul>
      <div className="my-2 border-t border-home-border" />
      <ul>
        {LAYER_KINDS.map((layer) => (
          <LegendCheckbox
            key={layer}
            label={LAYER_META[layer].label}
            color={LAYER_META[layer].color}
            checked={layers[layer]}
            count={counts[layer] ?? 0}
            onToggle={() => onToggleLayer(layer)}
          />
        ))}
      </ul>
    </div>
  );
}
