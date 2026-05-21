import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Check } from '@phosphor-icons/react'
import { useWidgetStore, DEFAULT_METRICS_SETTINGS, type MetricsSettings } from '@/stores/widgetStore'
import { MetricsContent } from './MetricsContent'
import { CELL_W, CELL_H } from '@/shared/gridConstants'

interface Props {
  id: string
  onClose: () => void
}

const COLOR_PRESETS = [
  { label: 'Blue',    value: '#3b82f6' },
  { label: 'Purple',  value: '#8b5cf6' },
  { label: 'Cyan',    value: '#06b6d4' },
  { label: 'Green',   value: '#10b981' },
  { label: 'Orange',  value: '#f59e0b' },
  { label: 'Red',     value: '#ef4444' },
  { label: 'Pink',    value: '#ec4899' },
  { label: 'Indigo',  value: '#6366f1' },
]

const GRID_COLS = 8
const GRID_ROWS = 6

function GridResizer({
  cols, rows,
  onChange,
}: {
  cols: number
  rows: number
  onChange: (c: number, r: number) => void
}) {
  const [hovered, setHovered] = useState<{ c: number; r: number } | null>(null)
  const [dragging, setDragging] = useState(false)
  const [selecting, setSelecting] = useState<{ c: number; r: number } | null>(null)
  const gridRef = useRef<HTMLDivElement>(null)

  function handleMouseDown(c: number, r: number) {
    setDragging(true)
    setSelecting({ c, r })
    onChange(c + 1, r + 1)
  }

  function handleMouseEnter(c: number, r: number) {
    setHovered({ c, r })
    if (dragging) {
      setSelecting({ c, r })
      onChange(c + 1, r + 1)
    }
  }

  function handleMouseUp() {
    setDragging(false)
    setSelecting(null)
  }

  useEffect(() => {
    window.addEventListener('mouseup', handleMouseUp)
    return () => window.removeEventListener('mouseup', handleMouseUp)
  }, [])

  const selC = selecting?.c ?? hovered?.c ?? -1
  const selR = selecting?.r ?? hovered?.r ?? -1

  return (
    <div>
      <div
        ref={gridRef}
        className="grid gap-[2px] select-none"
        style={{
          gridTemplateColumns: `repeat(${GRID_COLS}, 24px)`,
          gridTemplateRows: `repeat(${GRID_ROWS}, 20px)`,
        }}
        onMouseLeave={() => setHovered(null)}
      >
        {Array.from({ length: GRID_ROWS }, (_, r) =>
          Array.from({ length: GRID_COLS }, (_, c) => {
            const active = c <= selC && r <= selR
            const hover = c <= (hovered?.c ?? -1) && r <= (hovered?.r ?? -1)
            return (
              <div
                key={`${c}-${r}`}
                onMouseDown={() => handleMouseDown(c, r)}
                onMouseEnter={() => handleMouseEnter(c, r)}
                className="rounded-sm cursor-pointer transition-colors duration-75"
                style={{
                  background: active
                    ? 'rgba(99,102,241,0.6)'
                    : hover
                    ? 'rgba(99,102,241,0.2)'
                    : 'rgba(255,255,255,0.06)',
                  border: active
                    ? '1px solid rgba(99,102,241,0.8)'
                    : '1px solid rgba(255,255,255,0.04)',
                }}
              />
            )
          }),
        )}
      </div>
      <div className="mt-2 text-[10px] text-white/40 text-center tabular-nums">
        {cols} × {rows} cells — {cols * CELL_W} × {rows * CELL_H}px
      </div>
    </div>
  )
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="relative w-8 h-4 rounded-full transition-colors cursor-pointer"
      style={{ background: checked ? 'rgba(99,102,241,0.7)' : 'rgba(255,255,255,0.1)' }}
    >
      <motion.div
        className="absolute top-0.5 w-3 h-3 rounded-full bg-white"
        animate={{ left: checked ? 18 : 2 }}
        transition={{ duration: 0.15 }}
      />
    </button>
  )
}

function SettingsColumn({
  settings, update,
  widgetCols, widgetRows, onResize,
}: {
  settings: MetricsSettings
  update: <K extends keyof MetricsSettings>(key: K, value: MetricsSettings[K]) => void
  widgetCols: number
  widgetRows: number
  onResize: (c: number, r: number) => void
}) {
  return (
    <div className="w-[360px] shrink-0 overflow-y-auto p-5 flex flex-col gap-5" style={{ borderRight: '1px solid rgba(255,255,255,0.06)' }}>
      {/* Grid Resizer */}
      <section>
        <h3 className="text-[10px] uppercase tracking-widest text-white/30 mb-3">Size</h3>
        <GridResizer cols={widgetCols} rows={widgetRows} onChange={onResize} />
      </section>

      {/* Metrics Visibility */}
      <section>
        <h3 className="text-[10px] uppercase tracking-widest text-white/30 mb-3">Visibility</h3>
        <div className="flex flex-col gap-2.5">
          {[
            { key: 'showCpu' as const, label: 'CPU Usage' },
            { key: 'showMemory' as const, label: 'Memory' },
            { key: 'showGpu' as const, label: 'GPU' },
            { key: 'showDisks' as const, label: 'Disks' },
            { key: 'showNetwork' as const, label: 'Network' },
            { key: 'showSwap' as const, label: 'Swap' },
          ].map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between">
              <span className="text-xs text-white/70">{label}</span>
              <Toggle checked={settings[key]} onChange={v => update(key, v)} />
            </div>
          ))}
        </div>
      </section>

      {/* Display Options */}
      <section>
        <h3 className="text-[10px] uppercase tracking-widest text-white/30 mb-3">Display</h3>
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-white/70">Show Charts</span>
            <Toggle checked={settings.showCharts} onChange={v => update('showCharts', v)} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-white/70">Show Footer Stats</span>
            <Toggle checked={settings.showFooter} onChange={v => update('showFooter', v)} />
          </div>
        </div>
      </section>

      {/* Refresh Interval */}
      <section>
        <h3 className="text-[10px] uppercase tracking-widest text-white/30 mb-3">Refresh Interval</h3>
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: '1s', value: 1000 },
            { label: '3s', value: 3000 },
            { label: '5s', value: 5000 },
            { label: '10s', value: 10000 },
          ].map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => update('refreshInterval', opt.value)}
              className="py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer"
              style={{
                background: settings.refreshInterval === opt.value
                  ? 'rgba(99,102,241,0.25)'
                  : 'rgba(255,255,255,0.04)',
                color: settings.refreshInterval === opt.value ? '#818cf8' : 'rgba(255,255,255,0.5)',
                border: settings.refreshInterval === opt.value
                  ? '1px solid rgba(99,102,241,0.4)'
                  : '1px solid rgba(255,255,255,0.06)',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </section>

      {/* Chart History */}
      <section>
        <h3 className="text-[10px] uppercase tracking-widest text-white/30 mb-3">Chart History</h3>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: '30 pts', value: 30 },
            { label: '60 pts', value: 60 },
            { label: '120 pts', value: 120 },
          ].map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => update('chartHistory', opt.value)}
              className="py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer"
              style={{
                background: settings.chartHistory === opt.value
                  ? 'rgba(99,102,241,0.25)'
                  : 'rgba(255,255,255,0.04)',
                color: settings.chartHistory === opt.value ? '#818cf8' : 'rgba(255,255,255,0.5)',
                border: settings.chartHistory === opt.value
                  ? '1px solid rgba(99,102,241,0.4)'
                  : '1px solid rgba(255,255,255,0.06)',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </section>

      {/* Temperature Unit */}
      <section>
        <h3 className="text-[10px] uppercase tracking-widest text-white/30 mb-3">Temperature Unit</h3>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'Celsius (°C)', value: 'celsius' as const },
            { label: 'Fahrenheit (°F)', value: 'fahrenheit' as const },
          ].map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => update('temperatureUnit', opt.value)}
              className="py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer"
              style={{
                background: settings.temperatureUnit === opt.value
                  ? 'rgba(99,102,241,0.25)'
                  : 'rgba(255,255,255,0.04)',
                color: settings.temperatureUnit === opt.value ? '#818cf8' : 'rgba(255,255,255,0.5)',
                border: settings.temperatureUnit === opt.value
                  ? '1px solid rgba(99,102,241,0.4)'
                  : '1px solid rgba(255,255,255,0.06)',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </section>

      {/* Accent Color */}
      <section>
        <h3 className="text-[10px] uppercase tracking-widest text-white/30 mb-3">Accent Color</h3>
        <div className="grid grid-cols-4 gap-2">
          {COLOR_PRESETS.map(color => (
            <button
              key={color.value}
              type="button"
              onClick={() => update('accentColor', color.value)}
              className="flex items-center gap-2 py-1.5 px-2 rounded-lg text-xs transition-colors cursor-pointer"
              style={{
                background: settings.accentColor === color.value
                  ? 'rgba(255,255,255,0.08)'
                  : 'transparent',
                border: settings.accentColor === color.value
                  ? '1px solid rgba(255,255,255,0.15)'
                  : '1px solid transparent',
              }}
            >
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ background: color.value }}
              />
              <span className="text-white/60 truncate">{color.label}</span>
              {settings.accentColor === color.value && (
                <Check size={12} className="text-white/80 ml-auto" />
              )}
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}

export function MetricsSettingsPanel({ id, onClose }: Props) {
  const { configureWidget, getWidgetSettings, widgets, resizeWidget } = useWidgetStore()
  const existing = getWidgetSettings(id)?.metrics ?? {}
  const widget = widgets.find(w => w.id === id)
  const [settings, setSettings] = useState<MetricsSettings>({
    ...DEFAULT_METRICS_SETTINGS,
    ...existing,
  })
  const [widgetCols, setWidgetCols] = useState(widget ? Math.round(widget.w / CELL_W) : 3)
  const [widgetRows, setWidgetRows] = useState(widget ? Math.round(widget.h / CELL_H) : 2)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function update<K extends keyof MetricsSettings>(key: K, value: MetricsSettings[K]) {
    const next = { ...settings, [key]: value }
    setSettings(next)
    configureWidget(id, { metrics: next })
  }

  function handleResize(c: number, r: number) {
    setWidgetCols(c)
    setWidgetRows(r)
    if (widget) {
      resizeWidget(id, c * CELL_W, r * CELL_H, widget.x, widget.y)
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.1 }}
        className="fixed inset-0 z-[10000] flex items-center justify-center"
        style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(12px)', pointerEvents: 'auto' }}
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.15 }}
          className="flex rounded-2xl overflow-hidden"
          style={{
            width: '900px',
            height: '580px',
            background: 'rgba(12,14,22,0.82)',
            backdropFilter: 'blur(32px) saturate(1.5)',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 24px 64px rgba(0,0,0,0.7), 0 0 0 0.5px rgba(255,255,255,0.04) inset',
            pointerEvents: 'auto',
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Left: Settings */}
          <SettingsColumn
            settings={settings}
            update={update}
            widgetCols={widgetCols}
            widgetRows={widgetRows}
            onResize={handleResize}
          />

          {/* Right: Live Preview */}
          <div className="flex-1 flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
              <h2 className="text-sm font-semibold text-white/90">Preview</h2>
              <button
                type="button"
                onClick={onClose}
                className="w-6 h-6 rounded-full flex items-center justify-center text-white/40 hover:text-white/80
                           hover:bg-white/[0.07] transition-colors cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>

            {/* Preview area */}
            <div className="flex-1 flex items-center justify-center p-8" style={{ background: 'rgba(0,0,0,0.2)' }}>
              <div className="w-[380px] h-[320px]">
                <MetricsContent pixelH={320} settings={settings} maxHistory={60} />
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
