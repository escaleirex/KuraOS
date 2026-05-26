import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { systemApi, type SystemResources } from '@/api/client'
import {
  Cpu, Memory, Monitor, HardDrive, WifiHigh, Thermometer, Fan, Lightning,
} from '@phosphor-icons/react'

// ── history ───────────────────────────────────────────────────────────────────
// Module-level so it survives component remounts (maximize/restore swaps JSX branch)

const MAX_H = 60

type HMap = Map<string, number[]>

const globalHist: HMap = new Map()

function push(map: HMap, key: string, val: number) {
  const a = map.get(key) ?? []
  a.push(val)
  if (a.length > MAX_H) a.shift()
  map.set(key, [...a])
}

// ── svg charts ────────────────────────────────────────────────────────────────

function Sparkline({ values, color, w = 64, h = 28, gid, max }: { values: number[]; color: string; w?: number; h?: number; gid: string; max?: number }) {
  if (values.length < 2) return <div style={{ width: w, height: h }} />
  const ceil = max ?? Math.max(...values, 0.1)
  const n = values.length
  const pts = values.map((v, i) => {
    const x = n > 1 ? (i / (n - 1)) * w : 0
    const y = h - (v / ceil) * (h - 2) - 1
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  const area = `M0,${h} L${pts.join(' L')} L${w},${h} Z`
  return (
    <svg width={w} height={h} style={{ overflow: 'visible', display: 'block' }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.45" />
          <stop offset="100%" stopColor={color} stopOpacity="0.03" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}

function AreaChart({ values, color, h = 110, gid, unit = '%', max }: { values: number[]; color: string; h?: number; gid: string; unit?: string; max?: number }) {
  const w = 600
  if (values.length < 2) return <div style={{ height: h, background: 'var(--kura-alpha-04)', borderRadius: 12 }} className="w-full animate-pulse" />

  const ceil = max ?? Math.max(...values, 0.1)
  const n = values.length
  const pts = values.map((v, i) => {
    const x = n > 1 ? (i / (n - 1)) * w : 0
    const y = h - (v / ceil) * (h - 4) - 2
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  const area = `M0,${h} L${pts.join(' L')} L${w},${h} Z`
  const lastVal = values[values.length - 1]

  return (
    <div className="rounded-xl overflow-hidden relative" style={{ background: 'var(--kura-alpha-04)', border: '1px solid var(--kura-alpha-06)' }}>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full" style={{ height: h }}>
        <defs>
          <linearGradient id={gid + '-a'} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.4" />
            <stop offset="100%" stopColor={color} stopOpacity="0.04" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#${gid + '-a'})`} />
        <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
      </svg>
      <div className="absolute bottom-2 left-3">
        <span className="text-xs text-white/40">{lastVal.toFixed(unit === '%' ? 1 : 0)} {unit}</span>
      </div>
      {/* grid lines at 100/75/50/25 */}
      <div className="absolute inset-0 pointer-events-none py-1">
        {[1, 0.75, 0.5, 0.25].map(f => {
          const v = ceil * f
          return f > 0 ? (
            <div key={f} className="absolute left-0 right-0 flex items-center gap-1" style={{ top: `${(1 - f) * 100}%` }}>
              <span className="text-[8px] text-white/15 w-5 text-right shrink-0">{v < 10 ? v.toFixed(1) : v.toFixed(0)}</span>
              <div className="flex-1 border-t border-white/[0.04]" />
            </div>
          ) : null
        })}
      </div>
    </div>
  )
}

// ── helpers ───────────────────────────────────────────────────────────────────

function fmtBytes(b: number): string {
  if (b >= 1024 ** 4) return `${(b / 1024 ** 4).toFixed(1)} TB`
  if (b >= 1024 ** 3) return `${(b / 1024 ** 3).toFixed(1)} GB`
  if (b >= 1024 ** 2) return `${(b / 1024 ** 2).toFixed(0)} MB`
  return `${(b / 1024).toFixed(0)} KB`
}

function fmtBps(bps: number): string {
  if (bps >= 1024 ** 2) return `${(bps / 1024 ** 2).toFixed(1)} MB/s`
  if (bps >= 1024) return `${(bps / 1024).toFixed(0)} KB/s`
  return `${bps.toFixed(0)} B/s`
}

function tempColor(t: number) {
  return t >= 80 ? '#ef4444' : t >= 65 ? '#f59e0b' : '#10b981'
}

function Prop({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-white/[0.05] last:border-0">
      <span className="text-xs text-white/40">{label}</span>
      <span className="text-xs text-white/75 tabular-nums font-mono">{value}</span>
    </div>
  )
}

// ── sidebar item ──────────────────────────────────────────────────────────────

function SidebarItem({
  icon: Icon, label, sublabel, values, color, active, onClick, gid, max,
}: {
  icon: React.FC<{ size?: number; className?: string }>
  label: string; sublabel?: string; values: number[]; color: string
  active: boolean; onClick: () => void; gid: string; max?: number
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-3 py-2.5 rounded-xl transition-all cursor-pointer flex flex-col gap-1.5"
      style={{ background: active ? 'var(--kura-alpha-09)' : 'transparent' }}
      onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'var(--kura-alpha-04)' }}
      onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
    >
      <div className="flex items-center gap-2">
        <Icon size={14} weight="fill" className="shrink-0" style={{ color: active ? color : 'var(--kura-alpha-50)' }} />
        <span className={`text-xs font-medium truncate ${active ? 'text-white' : 'text-white/60'}`}>{label}</span>
      </div>
      {sublabel && <p className="text-[10px] text-white/30 pl-5 truncate">{sublabel}</p>}
      <div className="pl-5">
        <Sparkline values={values} color={color} w={148} h={26} gid={gid} max={max} />
      </div>
    </button>
  )
}

// ── detail panels ─────────────────────────────────────────────────────────────

type Sel =
  | { kind: 'cpu' }
  | { kind: 'memory' }
  | { kind: 'gpu'; idx: number }
  | { kind: 'disk'; name: string }
  | { kind: 'net'; name: string }
  | { kind: 'sensors' }

function CPUDetail({ d, hist }: { d: SystemResources; hist: HMap }) {
  const { cpu } = d
  const avg = cpu.freq_mhz?.length ? cpu.freq_mhz.reduce((a, b) => a + b, 0) / cpu.freq_mhz.length : 0
  return (
    <div className="space-y-4">
      <div>
        <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2">Usage</p>
        <AreaChart values={hist.get('cpu.usage') ?? []} color="#3b82f6" gid="cpu-usage" unit="%" max={100} />
      </div>
      {cpu.temp_c !== undefined && cpu.temp_c > 0 && (
        <div>
          <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2">Temperature</p>
          <AreaChart values={hist.get('cpu.temp') ?? []} color={tempColor(cpu.temp_c)} h={80} gid="cpu-temp" unit="°C" max={100} />
        </div>
      )}
      <div>
        <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2">Properties</p>
        <div className="rounded-xl px-3" style={{ background: 'var(--kura-alpha-04)', border: '1px solid var(--kura-alpha-06)' }}>
          <Prop label="Physical Cores" value={String(cpu.cores)} />
          <Prop label="Logical Threads" value={String(cpu.threads)} />
          {avg > 0 && <Prop label="Avg Frequency" value={`${(avg / 1000).toFixed(2)} GHz`} />}
          {cpu.temp_c !== undefined && cpu.temp_c > 0 && <Prop label="Temperature" value={`${cpu.temp_c.toFixed(1)}°C`} />}
          {cpu.power_w !== undefined && cpu.power_w > 0 && <Prop label="Package Power" value={`${cpu.power_w.toFixed(1)} W`} />}
        </div>
      </div>
      {cpu.per_core && cpu.per_core.length > 0 && (
        <div>
          <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2">Per Core</p>
          <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${Math.min(4, cpu.per_core.length)}, 1fr)` }}>
            {cpu.per_core.map((v, i) => {
              const c = v > 80 ? '#ef4444' : v > 50 ? '#f59e0b' : '#3b82f6'
              return (
                <div key={i} className="rounded-lg p-2 space-y-1" style={{ background: 'var(--kura-alpha-04)' }}>
                  <div className="flex justify-between">
                    <span className="text-[9px] text-white/30">#{i}</span>
                    <span className="text-[9px] tabular-nums" style={{ color: c }}>{v.toFixed(0)}%</span>
                  </div>
                  <div className="h-[2px] rounded-full" style={{ background: 'var(--kura-alpha-07)' }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, v)}%`, background: c }} />
                  </div>
                  {cpu.freq_mhz?.[i] > 0 && (
                    <p className="text-[8px] text-white/20 tabular-nums text-right">{cpu.freq_mhz[i].toFixed(0)} MHz</p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function MemDetail({ d, hist }: { d: SystemResources; hist: HMap }) {
  const { memory: m } = d
  const pct = m.total_bytes > 0 ? (m.used_bytes / m.total_bytes) * 100 : 0
  return (
    <div className="space-y-4">
      <div>
        <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2">Usage</p>
        <AreaChart values={hist.get('mem.usage') ?? []} color="#8b5cf6" gid="mem-usage" unit="%" max={100} />
      </div>
      <div>
        <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2">Properties</p>
        <div className="rounded-xl px-3" style={{ background: 'var(--kura-alpha-04)', border: '1px solid var(--kura-alpha-06)' }}>
          <Prop label="Total" value={fmtBytes(m.total_bytes)} />
          <Prop label="Used" value={`${fmtBytes(m.used_bytes)} (${pct.toFixed(1)}%)`} />
          <Prop label="Available" value={fmtBytes(m.avail_bytes)} />
          <Prop label="Cached" value={fmtBytes(m.cached_bytes)} />
          <Prop label="Buffers" value={fmtBytes(m.buffer_bytes)} />
          {m.swap_total > 0 && <Prop label="Swap" value={`${fmtBytes(m.swap_used)} / ${fmtBytes(m.swap_total)}`} />}
        </div>
      </div>
    </div>
  )
}

function GPUDetail({ d, hist, idx }: { d: SystemResources; hist: HMap; idx: number }) {
  const g = d.gpus?.[idx]
  if (!g) return <p className="text-sm text-white/30">GPU not found</p>
  const vramPct = g.vram_total > 0 ? (g.vram_used / g.vram_total) * 100 : 0
  return (
    <div className="space-y-4">
      <div>
        <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2">GPU Usage</p>
        <AreaChart values={hist.get(`gpu.${idx}.usage`) ?? []} color="#06b6d4" gid={`gpu-${idx}-usage`} unit="%" max={100} />
      </div>
      <div>
        <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2">VRAM</p>
        <AreaChart values={hist.get(`gpu.${idx}.vram`) ?? []} color="#8b5cf6" h={80} gid={`gpu-${idx}-vram`} unit="%" max={100} />
      </div>
      {(g.encoder_pct !== undefined || g.decoder_pct !== undefined) && (
        <div>
          <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2">Encode / Decode</p>
          <div className="grid grid-cols-2 gap-2">
            {g.encoder_pct !== undefined && (
              <div className="rounded-xl px-3 py-2" style={{ background: 'var(--kura-alpha-04)', border: '1px solid var(--kura-alpha-06)' }}>
                <p className="text-[10px] text-white/30 mb-1">Encoder</p>
                <p className="text-xl font-bold text-white tabular-nums">{g.encoder_pct.toFixed(0)}%</p>
              </div>
            )}
            {g.decoder_pct !== undefined && (
              <div className="rounded-xl px-3 py-2" style={{ background: 'var(--kura-alpha-04)', border: '1px solid var(--kura-alpha-06)' }}>
                <p className="text-[10px] text-white/30 mb-1">Decoder</p>
                <p className="text-xl font-bold text-white tabular-nums">{g.decoder_pct.toFixed(0)}%</p>
              </div>
            )}
          </div>
        </div>
      )}
      <div>
        <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2">Properties</p>
        <div className="rounded-xl px-3" style={{ background: 'var(--kura-alpha-04)', border: '1px solid var(--kura-alpha-06)' }}>
          <Prop label="Driver" value={g.driver.toUpperCase()} />
          <Prop label="VRAM Used" value={`${fmtBytes(g.vram_used)} / ${fmtBytes(g.vram_total)} (${vramPct.toFixed(1)}%)`} />
          {g.temp_c !== undefined && g.temp_c > 0 && <Prop label="Temperature" value={`${g.temp_c.toFixed(1)}°C`} />}
          {g.power_w !== undefined && g.power_w > 0 && <Prop label="Power Draw" value={`${g.power_w.toFixed(1)} W`} />}
        </div>
      </div>
    </div>
  )
}

function DiskDetail({ d, hist, name }: { d: SystemResources; hist: HMap; name: string }) {
  const dk = d.disks.find(x => x.name === name)
  if (!dk) return <p className="text-sm text-white/30">Drive not found</p>
  const usedPct = dk.total_bytes && dk.used_bytes !== undefined ? (dk.used_bytes / dk.total_bytes) * 100 : 0
  return (
    <div className="space-y-4">
      <div>
        <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2">Read Speed</p>
        <AreaChart values={hist.get(`disk.${name}.read`) ?? []} color="#3b82f6" gid={`disk-${name}-r`} unit=" B/s" />
      </div>
      <div>
        <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2">Write Speed</p>
        <AreaChart values={hist.get(`disk.${name}.write`) ?? []} color="#8b5cf6" h={80} gid={`disk-${name}-w`} unit=" B/s" />
      </div>
      <div>
        <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2">Properties</p>
        <div className="rounded-xl px-3" style={{ background: 'var(--kura-alpha-04)', border: '1px solid var(--kura-alpha-06)' }}>
          {dk.mount_point && <Prop label="Mount Point" value={dk.mount_point} />}
          {dk.total_bytes !== undefined && dk.total_bytes > 0 && <Prop label="Capacity" value={fmtBytes(dk.total_bytes)} />}
          {dk.used_bytes !== undefined && <Prop label="Used" value={`${fmtBytes(dk.used_bytes)} (${usedPct.toFixed(1)}%)`} />}
          {dk.free_bytes !== undefined && <Prop label="Free" value={fmtBytes(dk.free_bytes)} />}
          {dk.temp_c !== undefined && dk.temp_c > 0 && <Prop label="Temperature" value={`${dk.temp_c.toFixed(1)}°C`} />}
        </div>
      </div>
    </div>
  )
}

function NetDetail({ d, hist, name }: { d: SystemResources; hist: HMap; name: string }) {
  const n = d.network.find(x => x.name === name)
  if (!n) return <p className="text-sm text-white/30">Interface not found</p>
  return (
    <div className="space-y-4">
      <div>
        <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2">Download (RX)</p>
        <AreaChart values={hist.get(`net.${name}.rx`) ?? []} color="#10b981" gid={`net-${name}-rx`} unit=" B/s" />
      </div>
      <div>
        <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2">Upload (TX)</p>
        <AreaChart values={hist.get(`net.${name}.tx`) ?? []} color="#f59e0b" h={80} gid={`net-${name}-tx`} unit=" B/s" />
      </div>
    </div>
  )
}

function SensorsDetail({ d }: { d: SystemResources }) {
  return (
    <div className="space-y-3">
      {d.sensors.map(chip => (
        <div key={chip.path}>
          <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2 font-mono">{chip.name}</p>
          <div className="rounded-xl px-3" style={{ background: 'var(--kura-alpha-04)', border: '1px solid var(--kura-alpha-06)' }}>
            {chip.sensors.map((s, i) => (
              <Prop key={i} label={s.label} value={`${s.value.toFixed(s.kind === 'fan' ? 0 : 1)} ${s.unit}${s.crit ? ` / ${s.crit.toFixed(0)}${s.unit} crit` : ''}`} />
            ))}
          </div>
        </div>
      ))}
      {d.sensors.length === 0 && <p className="text-sm text-white/30">No sensors detected</p>}
    </div>
  )
}

// ── main ──────────────────────────────────────────────────────────────────────

export function HardwarePage() {
  const [sel, setSel] = useState<Sel>({ kind: 'cpu' })

  const { data } = useQuery({
    queryKey: ['system-resources'],
    queryFn: () => systemApi.resources().then(r => r.data),
    refetchInterval: 2000,
  })

  // Accumulate history on every data update
  useEffect(() => {
    if (!data) return
    const h = globalHist
    const { cpu, memory: m, gpus, disks, network } = data

    push(h, 'cpu.usage', cpu.usage_pct)
    if (cpu.temp_c) push(h, 'cpu.temp', cpu.temp_c)
    if (cpu.power_w) push(h, 'cpu.power', cpu.power_w)

    const memPct = m.total_bytes > 0 ? (m.used_bytes / m.total_bytes) * 100 : 0
    push(h, 'mem.usage', memPct)

    gpus?.forEach((g, i) => {
      push(h, `gpu.${i}.usage`, g.usage_pct)
      const vp = g.vram_total > 0 ? (g.vram_used / g.vram_total) * 100 : 0
      push(h, `gpu.${i}.vram`, vp)
    })

    disks?.forEach(dk => {
      push(h, `disk.${dk.name}.read`, dk.read_bps)
      push(h, `disk.${dk.name}.write`, dk.write_bps)
    })

    network?.forEach(n => {
      push(h, `net.${n.name}.rx`, n.rx_bps)
      push(h, `net.${n.name}.tx`, n.tx_bps)
    })
  }, [data])

  if (!data) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-sm text-white/20">Connecting…</p>
      </div>
    )
  }

  const { cpu, memory: m, gpus, disks, network, sensors } = data
  const memPct = m.total_bytes > 0 ? (m.used_bytes / m.total_bytes) * 100 : 0

  // Detail panel title
  const detailTitle = (() => {
    if (sel.kind === 'cpu') return cpu.name
    if (sel.kind === 'memory') return `${fmtBytes(m.total_bytes)} RAM`
    if (sel.kind === 'gpu') return gpus?.[sel.idx]?.name ?? 'GPU'
    if (sel.kind === 'disk') {
      const dk = disks.find(d => d.name === sel.name)
      return dk?.total_bytes ? `${fmtBytes(dk.total_bytes)} Drive` : sel.name
    }
    if (sel.kind === 'net') return sel.name
    return 'Sensors'
  })()

  const detailSub = (() => {
    if (sel.kind === 'cpu') return 'Processor'
    if (sel.kind === 'memory') return 'Memory'
    if (sel.kind === 'gpu') return `GPU · ${gpus?.[sel.idx]?.driver?.toUpperCase()}`
    if (sel.kind === 'disk') {
      const dk = disks.find(d => d.name === sel.name)
      return dk?.mount_point ? `Mounted at ${dk.mount_point}` : `/dev/${sel.name}`
    }
    if (sel.kind === 'net') return 'Network Interface'
    return 'Hardware Sensors'
  })()

  return (
    <div className="h-full flex overflow-hidden text-white/90">

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <div
        className="w-[196px] shrink-0 flex flex-col gap-1 p-2 overflow-y-auto border-r"
        style={{ borderColor: 'var(--kura-alpha-06)' }}
      >
        <SidebarItem
          icon={Cpu} label="Processor"
          sublabel={`${cpu.usage_pct.toFixed(0)}%`}
          values={globalHist.get('cpu.usage') ?? []}
          color="#3b82f6"
          active={sel.kind === 'cpu'}
          onClick={() => setSel({ kind: 'cpu' })}
          gid="sb-cpu"
          max={100}
        />

        <SidebarItem
          icon={Memory} label="Memory"
          sublabel={`${fmtBytes(m.used_bytes)} / ${fmtBytes(m.total_bytes)}`}
          values={globalHist.get('mem.usage') ?? []}
          color="#8b5cf6"
          active={sel.kind === 'memory'}
          onClick={() => setSel({ kind: 'memory' })}
          gid="sb-mem"
          max={100}
        />

        {gpus?.map((g, i) => (
          <SidebarItem
            key={i}
            icon={Monitor} label={g.name.length > 18 ? g.name.split(' ').slice(0, 3).join(' ') : g.name}
            sublabel={`${g.usage_pct.toFixed(0)}% GPU`}
            values={globalHist.get(`gpu.${i}.usage`) ?? []}
            color="#06b6d4"
            active={sel.kind === 'gpu' && sel.idx === i}
            onClick={() => setSel({ kind: 'gpu', idx: i })}
            gid={`sb-gpu-${i}`}
            max={100}
          />
        ))}

        {disks.map(dk => {
          const usedPct = dk.total_bytes && dk.used_bytes !== undefined ? (dk.used_bytes / dk.total_bytes) * 100 : 0
          const color = usedPct > 90 ? '#ef4444' : usedPct > 75 ? '#f59e0b' : '#f97316'
          const label = dk.total_bytes ? fmtBytes(dk.total_bytes) + ' Drive' : dk.name
          return (
            <SidebarItem
              key={dk.name}
              icon={HardDrive} label={label}
              sublabel={dk.mount_point ?? `/dev/${dk.name}`}
              values={globalHist.get(`disk.${dk.name}.read`) ?? []}
              color={color}
              active={sel.kind === 'disk' && sel.name === dk.name}
              onClick={() => setSel({ kind: 'disk', name: dk.name })}
              gid={`sb-disk-${dk.name}`}
            />
          )
        })}

        {network.map(n => (
          <SidebarItem
            key={n.name}
            icon={WifiHigh} label={n.name}
            sublabel={`↓${fmtBps(n.rx_bps)} ↑${fmtBps(n.tx_bps)}`}
            values={globalHist.get(`net.${n.name}.rx`) ?? []}
            color="#10b981"
            active={sel.kind === 'net' && sel.name === n.name}
            onClick={() => setSel({ kind: 'net', name: n.name })}
            gid={`sb-net-${n.name}`}
          />
        ))}

        {sensors.length > 0 && (
          <SidebarItem
            icon={Thermometer} label="Sensors"
            sublabel={`${sensors.length} chip${sensors.length > 1 ? 's' : ''}`}
            values={[]}
            color="#f59e0b"
            active={sel.kind === 'sensors'}
            onClick={() => setSel({ kind: 'sensors' })}
            gid="sb-sensors"
          />
        )}
      </div>

      {/* ── Detail panel ────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3 border-b shrink-0" style={{ borderColor: 'var(--kura-alpha-06)' }}>
          <p className="text-sm font-semibold text-white truncate">{detailTitle}</p>
          <p className="text-[11px] text-white/35">{detailSub}</p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {sel.kind === 'cpu'     && <CPUDetail    d={data} hist={globalHist} />}
          {sel.kind === 'memory'  && <MemDetail    d={data} hist={globalHist} />}
          {sel.kind === 'gpu'     && <GPUDetail    d={data} hist={globalHist} idx={sel.idx} />}
          {sel.kind === 'disk'    && <DiskDetail   d={data} hist={globalHist} name={sel.name} />}
          {sel.kind === 'net'     && <NetDetail    d={data} hist={globalHist} name={sel.name} />}
          {sel.kind === 'sensors' && <SensorsDetail d={data} />}
        </div>
      </div>
    </div>
  )
}
