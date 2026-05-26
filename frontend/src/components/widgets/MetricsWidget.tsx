import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Thermometer, HardDrives, Lightning, Monitor } from '@phosphor-icons/react'
import { systemApi } from '@/api/client'
import { useWidgetStore, DEFAULT_METRICS_SETTINGS, type MetricsSettings, type WidgetInstance } from '@/stores/widgetStore'
import { WidgetShell } from './WidgetShell'

// ── module-level history (survives maximize/remounts) ─────────────────────────

type HMap = Map<string, number[]>
const hist: HMap = new Map()

// ── SVG micro-chart ───────────────────────────────────────────────────────────

function MiniChart({ hkey, color, h = 36, max: fixedMax }: { hkey: string; color: string; h?: number; max?: number }) {
  const values = hist.get(hkey) ?? []
  if (values.length < 2) return <div style={{ height: h }} className="w-full rounded" />
  const max = fixedMax ?? Math.max(...values, 0.1)
  const W = 300
  const n = values.length
  const pts = values.map((v, i) => {
    const x = n > 1 ? (i / (n - 1)) * W : 0
    const y = h - (v / max) * (h - 2) - 1
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  const area = `M0,${h} L${pts.join(' L')} L${W},${h} Z`
  const gid = `wg-${hkey.replace(/\W/g, '-')}`
  return (
    <svg viewBox={`0 0 ${W} ${h}`} preserveAspectRatio="none" className="w-full rounded overflow-hidden" style={{ height: h, display: 'block' }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.4" />
          <stop offset="100%" stopColor={color} stopOpacity="0.04" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  )
}

// ── shared primitives ─────────────────────────────────────────────────────────

function fmtBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(0)} MB`
  return `${(bytes / 1024).toFixed(0)} KB`
}

function fmtBps(bps: number): string {
  if (bps >= 1024 ** 2) return `${(bps / 1024 ** 2).toFixed(1)} MB/s`
  if (bps >= 1024)      return `${(bps / 1024).toFixed(0)} KB/s`
  return `${bps.toFixed(0)} B/s`
}

function fmtTemp(celsius: number, unit: 'celsius' | 'fahrenheit'): string {
  if (unit === 'fahrenheit') return `${(celsius * 9 / 5 + 32).toFixed(0)}°F`
  return `${celsius.toFixed(0)}°C`
}

function getTempColor(celsius: number): string | undefined {
  if (celsius >= 80) return '#ef4444'
  if (celsius >= 65) return '#f59e0b'
  return undefined
}

function Bar({
  label, value, sub, color, hkey, chartH, max,
}: {
  label: string; value: number; sub?: string; color: string
  hkey?: string; chartH?: number; max?: number
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex justify-between items-baseline">
        <span className="text-[9px] text-white/35 uppercase tracking-widest truncate max-w-[70%]">{label}</span>
        <div className="flex items-baseline gap-1">
          {sub && <span className="text-[9px] text-white/25 tabular-nums">{sub}</span>}
          <span className="text-[10px] text-white/65 tabular-nums font-medium">{Math.round(value)}%</span>
        </div>
      </div>
      <div className="h-[3px] rounded-full overflow-hidden" style={{ background: 'var(--kura-alpha-07)' }}>
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${Math.min(100, value)}%`, background: color, boxShadow: `0 0 5px ${color}77` }}
        />
      </div>
      {hkey && chartH && chartH > 0 && (
        <div className="mt-0.5" style={{ background: 'var(--kura-alpha-03)', borderRadius: 6 }}>
          <MiniChart hkey={hkey} color={color} h={chartH} max={max} />
        </div>
      )}
    </div>
  )
}

// ── content ───────────────────────────────────────────────────────────────────

const CELL_H = 96

function MetricsContent({ pixelH, settings }: { pixelH: number; settings: MetricsSettings }) {
  const [, tick] = useState(0)

  const { data: res } = useQuery({
    queryKey: ['system-resources'],
    queryFn: () => systemApi.resources().then(r => r.data),
    refetchInterval: settings.refreshInterval,
  })

  // Accumulate history and force re-render so charts update
  useEffect(() => {
    if (!res) return
    const { cpu, memory: m, gpus, disks, network } = res
    pushHWithLimit('cpu.usage', cpu.usage_pct)
    const memPct = m.total_bytes > 0 ? (m.used_bytes / m.total_bytes) * 100 : 0
    pushHWithLimit('mem.usage', memPct)
    if (mem && mem.swap_total > 0) {
      pushHWithLimit('mem.swap', mem.swap_used / mem.swap_total * 100)
    }
    gpus?.forEach((g, i) => pushHWithLimit(`gpu.${i}.usage`, g.usage_pct))
    disks?.forEach(dk => {
      const pct = dk.total_bytes && dk.used_bytes !== undefined
        ? (dk.used_bytes / dk.total_bytes!) * 100 : 0
      pushHWithLimit(`disk.${dk.name}.pct`, pct)
    })
    network?.forEach(n => pushHWithLimit(`net.${n.name}.rx`, n.rx_bps))
    tick(n => n + 1)
  }, [res])

  const maxH = settings.chartHistory
  function pushHWithLimit(key: string, val: number) {
    const a = hist.get(key) ?? []
    a.push(val)
    if (a.length > maxH) a.shift()
    hist.set(key, [...a])
  }

  const cpu  = res?.cpu
  const mem  = res?.memory
  const gpu  = res?.gpus?.[0]
  const disks = res?.disks ?? []
  const nets  = res?.network ?? []

  const memPct  = mem && mem.total_bytes > 0 ? (mem.used_bytes / mem.total_bytes) * 100 : 0
  const topDisk = [...disks].sort((a, b) => (b.read_bps + b.write_bps) - (a.read_bps + a.write_bps))[0]
  const topNet  = [...nets].sort((a, b) => (b.rx_bps + b.tx_bps) - (a.rx_bps + a.tx_bps))[0]

  // Responsive: 2 cells tall = small, 3 = medium charts, 4+ = large charts
  const chartH = settings.showCharts
    ? (pixelH >= CELL_H * 4 ? 52 : pixelH >= CELL_H * 3 ? 32 : 0)
    : 0

  return (
    <div
      className="w-full h-full rounded-2xl px-3.5 py-3 flex flex-col gap-2 select-none overflow-hidden"
      style={{
        background:     'var(--kura-glass)',
        backdropFilter: 'blur(20px) saturate(1.4)',
        border:         '1px solid var(--kura-alpha-07)',
        boxShadow:      '0 8px 32px rgba(0,0,0,0.45)',
      }}
    >
      <p className="text-[9px] text-white/20 uppercase tracking-widest shrink-0">System</p>

      {!res ? (
        <p className="text-[11px] text-white/20 my-auto text-center">Connecting…</p>
      ) : (
        <div className="flex flex-col gap-2 flex-1 overflow-hidden">

          {settings.showCpu && cpu && (
            <Bar
              label={cpu.name || 'CPU'}
              value={cpu.usage_pct}
              sub={cpu.freq_mhz?.length ? `${(cpu.freq_mhz.reduce((a, b) => a + b, 0) / cpu.freq_mhz.length / 1000).toFixed(1)} GHz` : undefined}
              color={settings.accentColor}
              hkey="cpu.usage"
              chartH={chartH}
              max={100}
            />
          )}

          {settings.showMemory && mem && (
            <Bar
              label="Memory"
              value={memPct}
              sub={mem.total_bytes > 0 ? `${fmtBytes(mem.used_bytes)} / ${fmtBytes(mem.total_bytes)}` : undefined}
              color="#8b5cf6"
              hkey="mem.usage"
              chartH={chartH}
              max={100}
            />
          )}

          {settings.showSwap && mem && mem.swap_total > 0 && (
            <Bar
              label="Swap"
              value={mem.swap_used / mem.swap_total * 100}
              sub={`${fmtBytes(mem.swap_used)} / ${fmtBytes(mem.swap_total)}`}
              color="#64748b"
              hkey="mem.swap"
              chartH={chartH}
              max={100}
            />
          )}

          {settings.showGpu && gpu && (
            <Bar
              label={gpu.name}
              value={gpu.usage_pct}
              sub={gpu.vram_total > 0 ? `${fmtBytes(gpu.vram_used)} VRAM` : undefined}
              color="#06b6d4"
              hkey="gpu.0.usage"
              chartH={chartH}
              max={100}
            />
          )}

          {settings.showDisks && disks.filter(dk => dk.total_bytes && dk.total_bytes > 0 && dk.used_bytes !== undefined).map(dk => {
            const pct   = dk.total_bytes! > 0 ? ((dk.used_bytes ?? 0) / dk.total_bytes!) * 100 : 0
            const label = dk.mount_point ?? dk.name
            const sub   = `${fmtBytes(dk.used_bytes ?? 0)} / ${fmtBytes(dk.total_bytes!)}`
            const color = pct > 90 ? '#ef4444' : pct > 75 ? '#f59e0b' : '#10b981'
            return (
              <Bar
                key={dk.name}
                label={label} value={pct} sub={sub} color={color}
                hkey={`disk.${dk.name}.pct`} chartH={chartH} max={100}
              />
            )
          })}

          {settings.showNetwork && nets.length > 0 && (
            <div className="border-t border-white/[0.05] pt-2">
              <p className="text-[9px] text-white/35 uppercase tracking-widest mb-1.5">Network</p>
              {nets.map(n => (
                <div key={n.name} className="flex justify-between items-baseline mb-1">
                  <span className="text-[9px] text-white/35 truncate max-w-[50%]">{n.name}</span>
                  <span className="text-[10px] text-white/50 tabular-nums">
                    ↓{fmtBps(n.rx_bps)} ↑{fmtBps(n.tx_bps)}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="border-t border-white/[0.05] mt-auto" />

          {settings.showFooter && (
            <div className="flex flex-wrap gap-x-3 gap-y-1 shrink-0">
              {cpu?.temp_c !== undefined && cpu.temp_c > 0 && (
                <span className="flex items-center gap-1 text-[10px] text-white/40">
                  <Thermometer size={11} weight="fill" />
                  <span style={{ color: getTempColor(cpu.temp_c) }}>
                    {fmtTemp(cpu.temp_c, settings.temperatureUnit)}
                  </span>
                </span>
              )}
              {cpu?.power_w !== undefined && cpu.power_w > 0 && (
                <span className="flex items-center gap-1 text-[10px] text-white/40">
                  <Lightning size={11} weight="fill" />
                  {cpu.power_w.toFixed(0)} W
                </span>
              )}
              {gpu?.temp_c !== undefined && gpu.temp_c > 0 && (
                <span className="flex items-center gap-1 text-[10px] text-white/40">
                  <Monitor size={11} weight="fill" />
                  {fmtTemp(gpu.temp_c, settings.temperatureUnit)}
                </span>
              )}
              {topDisk && (topDisk.read_bps > 0 || topDisk.write_bps > 0) && (
                <span className="flex items-center gap-1 text-[10px] text-white/40">
                  <HardDrives size={11} weight="fill" />
                  {fmtBps(topDisk.read_bps + topDisk.write_bps)}
                </span>
              )}
              {topNet && (topNet.rx_bps > 0 || topNet.tx_bps > 0) && (
                <span className="text-[10px] text-white/30 tabular-nums">
                  ↓{fmtBps(topNet.rx_bps)} ↑{fmtBps(topNet.tx_bps)}
                </span>
              )}
            </div>
          )}

        </div>
      )}
    </div>
  )
}

// ── shell ─────────────────────────────────────────────────────────────────────

export function MetricsWidget({ id }: { id: string }) {
  const widget = useWidgetStore((s: { widgets: WidgetInstance[] }) => s.widgets.find((w: WidgetInstance) => w.id === id))
  if (!widget) return null

  const pixelH = widget.h
  const settings = { ...DEFAULT_METRICS_SETTINGS, ...widget.settings?.metrics }

  return (
    <WidgetShell id={id}>
      <MetricsContent pixelH={pixelH} settings={settings} />
    </WidgetShell>
  )
}
