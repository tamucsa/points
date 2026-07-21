'use client'

import { useEffect, useId, useRef, useState } from 'react'

interface Props {
  value: string
  onChange: (hex: string) => void
  label?: string
  disabled?: boolean
  className?: string
}

const PRESETS = [
  '#D87A80',
  '#5A9EC8',
  '#825E3E',
  '#A26EB8',
  '#5E554C',
  '#C2992D',
  '#4779B8',
  '#4f6ef7',
  '#2F855A',
  '#C05621',
  '#718096',
  '#1A202C',
]

function normalizeHex(raw: string): string | null {
  const trimmed = raw.trim()
  const withHash = trimmed.startsWith('#') ? trimmed : `#${trimmed}`
  if (!/^#[0-9A-Fa-f]{6}$/.test(withHash)) return null
  return withHash.toLowerCase()
}

function hexToHsv(hex: string): { h: number; s: number; v: number } {
  const r = Number.parseInt(hex.slice(1, 3), 16) / 255
  const g = Number.parseInt(hex.slice(3, 5), 16) / 255
  const b = Number.parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  let h = 0
  if (d !== 0) {
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60
    else if (max === g) h = ((b - r) / d + 2) * 60
    else h = ((r - g) / d + 4) * 60
  }
  const s = max === 0 ? 0 : d / max
  return { h, s, v: max }
}

function hsvToHex(h: number, s: number, v: number): string {
  const c = v * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = v - c
  let r = 0
  let g = 0
  let b = 0
  if (h < 60) { r = c; g = x }
  else if (h < 120) { r = x; g = c }
  else if (h < 180) { g = c; b = x }
  else if (h < 240) { g = x; b = c }
  else if (h < 300) { r = x; b = c }
  else { r = c; b = x }
  const toHex = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

function hueBackground(h: number) {
  return `hsl(${h} 100% 50%)`
}

export default function ColorPickerField({
  value,
  onChange,
  label = 'Color',
  disabled,
  className = '',
}: Props) {
  const id = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const svRef = useRef<HTMLDivElement>(null)
  const hueRef = useRef<HTMLDivElement>(null)
  const hex = normalizeHex(value) ?? '#4f6ef7'
  const [text, setText] = useState(hex.toUpperCase())
  const [open, setOpen] = useState(false)
  const [hsv, setHsv] = useState(() => hexToHsv(hex))
  const hsvRef = useRef(hsv)
  const dragging = useRef<'sv' | 'hue' | null>(null)
  const onChangeRef = useRef(onChange)

  useEffect(() => {
    hsvRef.current = hsv
  }, [hsv])

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    setText(hex.toUpperCase())
    if (!dragging.current) {
      const next = hexToHsv(hex)
      setHsv(next)
      hsvRef.current = next
    }
  }, [hex])

  useEffect(() => {
    if (!open) return

    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const commitHsv = (next: { h: number; s: number; v: number }) => {
    hsvRef.current = next
    setHsv(next)
    onChangeRef.current(hsvToHex(next.h, next.s, next.v))
  }

  const updateSvFromPointer = (clientX: number, clientY: number) => {
    const el = svRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const s = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
    const v = Math.min(1, Math.max(0, 1 - (clientY - rect.top) / rect.height))
    commitHsv({ ...hsvRef.current, s, v })
  }

  const updateHueFromPointer = (clientX: number) => {
    const el = hueRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const h = Math.min(360, Math.max(0, ((clientX - rect.left) / rect.width) * 360))
    commitHsv({ ...hsvRef.current, h })
  }

  useEffect(() => {
    if (!open) return

    const onMove = (e: PointerEvent) => {
      if (dragging.current === 'sv') updateSvFromPointer(e.clientX, e.clientY)
      if (dragging.current === 'hue') updateHueFromPointer(e.clientX)
    }
    const onUp = () => {
      dragging.current = null
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [open])

  return (
    <div ref={rootRef} className={`relative flex flex-col gap-1 text-sm ${className}`}>
      {label ? (
        <span id={`${id}-label`} className="font-medium text-text">
          {label}
        </span>
      ) : null}

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={disabled}
          aria-labelledby={label ? `${id}-label` : undefined}
          aria-label={label || 'Pick color'}
          aria-expanded={open}
          aria-haspopup="dialog"
          title="Pick color"
          onClick={() => setOpen(o => !o)}
          className="h-10 w-10 shrink-0 rounded-xl border border-home-border shadow-sm ring-1 ring-black/5 transition hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-60"
          style={{ backgroundColor: hex }}
        />
        <input
          type="text"
          value={text}
          disabled={disabled}
          spellCheck={false}
          autoComplete="off"
          maxLength={7}
          aria-label={`${label || 'Color'} hex`}
          className="w-[7.5rem] rounded-xl border border-home-border bg-surface px-3 py-2.5 font-mono text-sm uppercase tracking-wide text-text shadow-sm focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
          onChange={e => {
            const raw = e.target.value
            setText(raw)
            const next = normalizeHex(raw)
            if (next) onChange(next)
          }}
          onBlur={() => {
            const next = normalizeHex(text)
            if (next) {
              onChange(next)
              setText(next.toUpperCase())
            } else {
              setText(hex.toUpperCase())
            }
          }}
        />
      </div>

      {open && !disabled && (
        <div
          role="dialog"
          aria-label="Color picker"
          className="absolute left-0 top-[calc(100%+0.5rem)] z-50 w-[14.5rem] rounded-2xl border border-home-border bg-surface p-3 shadow-theme-md"
        >
          <div
            ref={svRef}
            className="relative h-36 w-full cursor-crosshair touch-none overflow-hidden rounded-xl"
            style={{
              backgroundColor: hueBackground(hsv.h),
              backgroundImage:
                'linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent)',
            }}
            onPointerDown={e => {
              e.preventDefault()
              dragging.current = 'sv'
              ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
              updateSvFromPointer(e.clientX, e.clientY)
            }}
          >
            <span
              className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.35)]"
              style={{
                left: `${hsv.s * 100}%`,
                top: `${(1 - hsv.v) * 100}%`,
                backgroundColor: hex,
              }}
            />
          </div>

          <div
            ref={hueRef}
            className="relative mt-3 h-3 w-full cursor-pointer touch-none rounded-full"
            style={{
              background:
                'linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)',
            }}
            onPointerDown={e => {
              e.preventDefault()
              dragging.current = 'hue'
              ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
              updateHueFromPointer(e.clientX)
            }}
          >
            <span
              className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.35)]"
              style={{
                left: `${(hsv.h / 360) * 100}%`,
                backgroundColor: hueBackground(hsv.h),
              }}
            />
          </div>

          <div className="mt-3 grid grid-cols-6 gap-1.5">
            {PRESETS.map(preset => {
              const selected = preset.toLowerCase() === hex
              return (
                <button
                  key={preset}
                  type="button"
                  title={preset}
                  aria-label={`Use ${preset}`}
                  aria-pressed={selected}
                  onClick={() => onChange(preset.toLowerCase())}
                  className={`h-6 w-full rounded-md border transition ${
                    selected
                      ? 'border-text ring-2 ring-primary/35'
                      : 'border-black/10 hover:scale-105'
                  }`}
                  style={{ backgroundColor: preset }}
                />
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
