import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { systemApi } from '@/api/client'
import {
  Gear, Users, Shield, ArrowsClockwise, Info, Bell,
  Plus, Trash, QrCode, Lock, CheckCircle, Key,
  Clock, Globe, TerminalWindow, Warning, WifiHigh,
  PaintBrush, BatteryHigh, AppWindow, MagnifyingGlass,
  Cloud, FolderSimple, Translate, CalendarBlank, Desktop,
  Robot, Sparkle, Network, SunHorizon, Moon,
  HardDrive, X, Eye, EyeSlash,
  Lightning, Wind, Leaf,
  GoogleLogo, DropboxLogo,
  Play, Stop, ArrowUp, Prohibit, ArrowClockwise,
  Cpu, Memory, GraphicsCard, At,
} from '@phosphor-icons/react'

// ── types ─────────────────────────────────────────────────────────────────────

type Section =
  | 'appearance' | 'network' | 'smb' | 'online-accounts'
  | 'power' | 'apps' | 'search' | 'notifications'
  | 'users' | 'security' | 'ssh'
  | 'region' | 'datetime' | 'remote-desktop' | 'axis'
  | 'about' | 'updates'

interface SystemUser {
  username: string
  role: 'admin' | 'user'
  email: string
  samba: boolean
  lastLogin: string
}

interface SmbShare {
  id: number
  name: string
  path: string
  comment: string
  writable: boolean
  guest: boolean
  browseable: boolean
}

// ── helpers ───────────────────────────────────────────────────────────────────

function fmtBytes(b: number): string {
  if (b >= 1024 ** 4) return `${(b / 1024 ** 4).toFixed(1)} TB`
  if (b >= 1024 ** 3) return `${(b / 1024 ** 3).toFixed(1)} GB`
  if (b >= 1024 ** 2) return `${(b / 1024 ** 2).toFixed(0)} MB`
  return `${(b / 1024).toFixed(0)} KB`
}

// ── sidebar ───────────────────────────────────────────────────────────────────

interface NavItemDef {
  id: Section
  label: string
  icon: React.FC<{ size?: number | string; weight?: string; style?: React.CSSProperties; className?: string }>
  color: string
  sub: string
}

interface NavGroup {
  label: string
  items: NavItemDef[]
}

const NAV: NavGroup[] = [
  {
    label: 'Personalization',
    items: [
      { id: 'appearance',      label: 'Appearance',       icon: PaintBrush,      color: '#ec4899', sub: 'Theme, colors and scale' },
    ],
  },
  {
    label: 'Network & Services',
    items: [
      { id: 'network',         label: 'Network',           icon: WifiHigh,        color: '#3b82f6', sub: 'Wi-Fi and Ethernet' },
      { id: 'smb',             label: 'SMB Shares',        icon: FolderSimple,    color: '#f59e0b', sub: 'Samba / CIFS' },
      { id: 'online-accounts', label: 'Online Accounts',   icon: Cloud,           color: '#06b6d4', sub: 'Google Drive, S3, Dropbox' },
    ],
  },
  {
    label: 'System',
    items: [
      { id: 'power',           label: 'Power',             icon: BatteryHigh,     color: '#10b981', sub: 'Performance profile, WoL' },
      { id: 'apps',            label: 'Apps & Services',   icon: AppWindow,       color: '#8b5cf6', sub: 'Startup, restart, update' },
      { id: 'search',          label: 'Search',            icon: MagnifyingGlass, color: '#f97316', sub: 'AI-assisted file search' },
      { id: 'notifications',   label: 'Notifications',     icon: Bell,            color: '#eab308', sub: 'Alerts and events' },
      { id: 'axis',            label: 'Axis AI',           icon: Robot,           color: '#a78bfa', sub: 'Models, inference, API keys' },
    ],
  },
  {
    label: 'Account & Security',
    items: [
      { id: 'users',           label: 'Users',             icon: Users,           color: '#a78bfa', sub: 'Local accounts and permissions' },
      { id: 'security',        label: 'Security',          icon: Shield,          color: '#10b981', sub: '2FA and authentication' },
      { id: 'ssh',             label: 'SSH Access',        icon: TerminalWindow,  color: '#64748b', sub: 'OpenSSH, keys, port' },
    ],
  },
  {
    label: 'Advanced',
    items: [
      { id: 'region',          label: 'Region & Language', icon: Translate,       color: '#6366f1', sub: 'Language, regional formats' },
      { id: 'datetime',        label: 'Date & Time',       icon: CalendarBlank,   color: '#0ea5e9', sub: 'Timezone, NTP' },
      { id: 'remote-desktop',  label: 'Remote Desktop',    icon: Desktop,         color: '#14b8a6', sub: 'VNC, RDP, graphical environment' },
      { id: 'about',           label: 'About',             icon: Info,            color: '#3b82f6', sub: 'KuraOS v1.0.3' },
      { id: 'updates',         label: 'Updates',           icon: ArrowsClockwise, color: '#06b6d4', sub: 'Firmware and patches' },
    ],
  },
]

const DETAIL: Record<Section, { title: string; sub: string }> = {
  appearance:        { title: 'Appearance',               sub: 'Visual theme, accent color and UI scale' },
  network:           { title: 'Network',                  sub: 'Wi-Fi, Ethernet, DNS and interface configuration' },
  smb:               { title: 'SMB Shares',               sub: 'Manage Samba / CIFS shares on the local network' },
  'online-accounts': { title: 'Online Accounts',          sub: 'External backup — Google Drive, S3, Dropbox' },
  power:             { title: 'Power',                    sub: 'Performance profile, spindown and Wake-on-LAN' },
  apps:              { title: 'Apps & Services',          sub: 'Automatic startup, restart on error and package management' },
  search:            { title: 'Smart Search',             sub: 'AI-assisted file search on the NAS' },
  notifications:     { title: 'Notifications',            sub: 'System alerts and events' },
  axis:              { title: 'Axis AI',                  sub: 'Inference mode, Ollama models and cloud API keys' },
  users:             { title: 'Users & Accounts',         sub: 'Manage local accounts and Samba permissions' },
  security:          { title: 'Security',                 sub: 'Two-factor authentication (2FA / TOTP)' },
  ssh:               { title: 'SSH Access',               sub: 'OpenSSH server, keys and authentication' },
  region:            { title: 'Region & Language',        sub: 'Language, date, number and currency formats' },
  datetime:          { title: 'Date & Time',              sub: 'Timezone, NTP sync and clock' },
  'remote-desktop':  { title: 'Remote Desktop',           sub: 'VNC / RDP — remote graphical access to the server' },
  about:             { title: 'About KuraOS',             sub: 'Version, hardware and system information' },
  updates:           { title: 'Updates',                  sub: 'Firmware, security patches and components' },
}

// ── shared primitives ─────────────────────────────────────────────────────────

function Toggle({ on, onChange, color = '#3b82f6' }: { on: boolean; onChange: () => void; color?: string }) {
  return (
    <div
      onClick={onChange}
      className="relative w-10 h-5 rounded-full transition-colors cursor-pointer shrink-0"
      style={{ background: on ? color : 'rgba(255,255,255,0.1)' }}
    >
      <div
        className="absolute top-1 w-3 h-3 rounded-full bg-white transition-all duration-150"
        style={{ left: on ? '24px' : '4px' }}
      />
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-2.5 border-b border-white/[0.05] last:border-0">
      <span className="text-xs text-white/40">{label}</span>
      <span className="text-xs text-white/75 tabular-nums font-mono">{value}</span>
    </div>
  )
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-xl px-4 py-1 ${className}`}
      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
    >
      {children}
    </div>
  )
}

function SLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2">{children}</p>
}

function RowToggle({ label, sub, on, onChange, color }: { label: string; sub?: string; on: boolean; onChange: () => void; color?: string }) {
  return (
    <div className="py-3 flex items-center gap-3 border-b border-white/[0.05] last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-white">{label}</p>
        {sub && <p className="text-[10px] text-white/30 mt-0.5">{sub}</p>}
      </div>
      <Toggle on={on} onChange={onChange} color={color} />
    </div>
  )
}

function Input({ value, onChange, placeholder, type = 'text', className = '', mono = false }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string; className?: string; mono?: boolean
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500/50 transition-colors ${mono ? 'font-mono' : ''} ${className}`}
    />
  )
}

// Animated modal
function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        className="absolute inset-0 bg-black/50 backdrop-blur-md"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        onClick={onClose}
      />
      <motion.div
        className="relative rounded-2xl p-5 w-full max-w-sm"
        style={{
          background: 'rgba(12,14,22,0.82)',
          backdropFilter: 'blur(32px) saturate(1.5)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.6), 0 0 0 0.5px rgba(255,255,255,0.04) inset',
        }}
        initial={{ opacity: 0, scale: 0.94, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 8 }}
        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      >
        <button onClick={onClose} className="absolute top-4 right-4 text-white/25 hover:text-white/60 cursor-pointer transition-colors">
          <X size={14} />
        </button>
        {children}
      </motion.div>
    </div>
  )
}

function NavItem({ def, active, onClick }: { def: NavItemDef; active: boolean; onClick: () => void }) {
  const Icon = def.icon
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-3 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-3"
      style={{ background: active ? 'rgba(255,255,255,0.09)' : 'transparent' }}
      onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)' }}
      onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
    >
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-all"
        style={{
          background: active ? `${def.color}22` : 'rgba(255,255,255,0.05)',
          border: active ? `1px solid ${def.color}30` : '1px solid transparent',
        }}
      >
        <Icon size={13} weight="fill" style={{ color: active ? def.color : 'rgba(255,255,255,0.35)' }} />
      </div>
      <div className="min-w-0">
        <p className={`text-[11px] font-medium truncate leading-tight ${active ? 'text-white' : 'text-white/55'}`}>{def.label}</p>
        <p className="text-[9px] text-white/20 truncate mt-0.5 leading-tight">{def.sub}</p>
      </div>
    </button>
  )
}

// ── panels ────────────────────────────────────────────────────────────────────

// 1. Aparência
function AppearancePanel() {
  const [theme, setTheme]     = useState<'dark' | 'light' | 'auto'>('dark')
  const [accent, setAccent]   = useState('#3b82f6')
  const [scale, setScale]     = useState('100')
  const [density, setDensity] = useState<'comfortable' | 'compact'>('comfortable')

  const accents = ['#3b82f6','#8b5cf6','#ec4899','#10b981','#f59e0b','#ef4444','#06b6d4','#f97316']

  return (
    <div className="space-y-5">
      <div>
        <SLabel>Theme</SLabel>
        <div className="grid grid-cols-3 gap-2">
          {([['dark','Dark',Moon],['light','Light',SunHorizon],['auto','Auto',Sparkle]] as const).map(([val, label, Icon]) => (
            <button
              key={val}
              onClick={() => setTheme(val)}
              className="flex flex-col items-center gap-2 py-4 rounded-xl cursor-pointer transition-all"
              style={{
                background: theme === val ? 'rgba(59,130,246,0.1)' : 'rgba(255,255,255,0.04)',
                border: theme === val ? '1px solid rgba(59,130,246,0.3)' : '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <Icon size={20} weight="fill" style={{ color: theme === val ? '#3b82f6' : 'rgba(255,255,255,0.35)' }} />
              <span className={`text-xs font-medium ${theme === val ? 'text-sky-400' : 'text-white/40'}`}>{label}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <SLabel>Accent Color</SLabel>
        <Card>
          <div className="py-3 flex items-center gap-3 flex-wrap">
            {accents.map(c => (
              <button
                key={c}
                onClick={() => setAccent(c)}
                className="w-7 h-7 rounded-full cursor-pointer transition-all"
                style={{
                  background: c,
                  outline: accent === c ? `2px solid ${c}` : 'none',
                  outlineOffset: 2,
                  boxShadow: accent === c ? `0 0 10px ${c}60` : 'none',
                }}
              />
            ))}
            <label className="ml-1 flex items-center gap-1.5 cursor-pointer text-[10px] text-white/30">
              <input type="color" value={accent} onChange={e => setAccent(e.target.value)} className="w-5 h-5 rounded cursor-pointer bg-transparent border-0" />
              Custom
            </label>
          </div>
        </Card>
      </div>

      <div>
        <SLabel>Scale & Density</SLabel>
        <Card>
          <div className="py-3 border-b border-white/[0.05] flex items-center gap-3">
            <span className="text-xs text-white flex-1">UI Scale</span>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={75}
                max={125}
                step={5}
                value={scale}
                onChange={e => setScale(e.target.value)}
                className="appearance-none w-32 h-1.5 rounded-full cursor-pointer"
                style={{ background: `linear-gradient(to right, #3b82f6 ${((Number(scale) - 75) / 50) * 100}%, rgba(255,255,255,0.1) ${((Number(scale) - 75) / 50) * 100}%)` }}
              />
              <span className="text-xs text-white/60 tabular-nums font-mono w-10 text-right">{scale}%</span>
            </div>
          </div>
          <div className="py-3 flex items-center gap-3">
            <span className="text-xs text-white flex-1">UI Density</span>
            <div className="flex gap-1">
              {([['comfortable','Comfortable'],['compact','Compact']] as const).map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => setDensity(val)}
                  className="px-2.5 py-1 rounded-lg text-[10px] font-medium cursor-pointer transition-all"
                  style={{
                    background: density === val ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.05)',
                    color: density === val ? '#3b82f6' : 'rgba(255,255,255,0.35)',
                    border: density === val ? '1px solid rgba(59,130,246,0.3)' : '1px solid transparent',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}

// 2. Rede
interface EthConfig {
  mode: 'dhcp' | 'static'
  ip: string
  subnet: string
  gateway: string
  dns1: string
  dns2: string
}

function NetworkPanel() {
  const [tab, setTab]     = useState<'wifi' | 'eth'>('wifi')
  const [wifiOn, setWifiOn] = useState(true)
  const [expandedIface, setExpandedIface] = useState<string | null>('eth0')
  const [ethConfigs, setEthConfigs] = useState<Record<string, EthConfig>>({
    eth0: { mode: 'static', ip: '192.168.1.100', subnet: '255.255.255.0', gateway: '192.168.1.1', dns1: '1.1.1.1', dns2: '8.8.8.8' },
    eth1: { mode: 'dhcp',   ip: '',              subnet: '',               gateway: '',              dns1: '',       dns2: '' },
  })

  const wifiNets = [
    { ssid: 'CasaDoEscaleirex', signal: 90, secured: true, connected: true },
    { ssid: 'Vodafone-5G-A3F2', signal: 65, secured: true, connected: false },
    { ssid: 'MEO-WiFi',          signal: 40, secured: true, connected: false },
    { ssid: 'NOS_Guest',         signal: 25, secured: false, connected: false },
  ]

  const ethIfaces = [
    { name: 'eth0', speed: '1 Gbps', status: 'up' as const },
    { name: 'eth1', speed: '—',      status: 'down' as const },
  ]

  function SignalBars({ pct }: { pct: number }) {
    const color = pct > 70 ? '#10b981' : pct > 40 ? '#f59e0b' : '#ef4444'
    return (
      <div className="flex items-end gap-0.5 h-3.5">
        {[25, 50, 75, 100].map(t => (
          <div key={t} className="w-1 rounded-sm" style={{ height: `${t}%`, background: pct >= t ? color : 'rgba(255,255,255,0.12)' }} />
        ))}
      </div>
    )
  }

  const patchEth = (name: string, patch: Partial<EthConfig>) =>
    setEthConfigs(prev => ({ ...prev, [name]: { ...prev[name], ...patch } }))

  return (
    <div className="space-y-4">
      <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: 'rgba(255,255,255,0.05)' }}>
        {([['wifi','Wi-Fi'],['eth','Ethernet']] as const).map(([val, label]) => (
          <button
            key={val}
            onClick={() => setTab(val)}
            className="px-4 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all"
            style={{
              background: tab === val ? 'rgba(255,255,255,0.12)' : 'transparent',
              color: tab === val ? 'white' : 'rgba(255,255,255,0.4)',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'wifi' && (
        <>
          <Card><RowToggle label="Wi-Fi" sub="Enable wireless adapter" on={wifiOn} onChange={() => setWifiOn(p => !p)} color="#3b82f6" /></Card>
          {wifiOn && (
            <div>
              <SLabel>Available Networks</SLabel>
              <div className="space-y-1.5">
                {wifiNets.map(n => (
                  <div
                    key={n.ssid}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl"
                    style={{ background: n.connected ? 'rgba(59,130,246,0.08)' : 'rgba(255,255,255,0.04)', border: n.connected ? '1px solid rgba(59,130,246,0.2)' : '1px solid rgba(255,255,255,0.06)' }}
                  >
                    <SignalBars pct={n.signal} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-white truncate">{n.ssid}</p>
                      <p className="text-[10px] text-white/30 mt-0.5">{n.secured ? 'Secured (WPA2)' : 'Open'} · {n.signal}%</p>
                    </div>
                    {n.connected
                      ? <span className="text-[10px] font-bold text-sky-400 px-2 py-0.5 rounded-full" style={{ background: 'rgba(59,130,246,0.15)' }}>Connected</span>
                      : <button className="text-[10px] text-white/40 hover:text-white/70 cursor-pointer transition-colors">Connect</button>
                    }
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'eth' && (
        <div className="space-y-2">
          <SLabel>Ethernet Interfaces</SLabel>
          {ethIfaces.map(iface => {
            const cfg = ethConfigs[iface.name]
            const expanded = expandedIface === iface.name
            return (
              <div
                key={iface.name}
                className="rounded-xl overflow-hidden"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
              >
                {/* Header row */}
                <button
                  className="w-full flex items-center gap-3 px-4 py-3 cursor-pointer text-left transition-colors hover:bg-white/[0.02]"
                  onClick={() => setExpandedIface(expanded ? null : iface.name)}
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: iface.status === 'up' ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.05)' }}>
                    <Network size={14} weight="fill" style={{ color: iface.status === 'up' ? '#10b981' : 'rgba(255,255,255,0.2)' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-white">{iface.name}</p>
                    <p className="text-[10px] text-white/30 mt-0.5 font-mono">{cfg.mode === 'static' ? cfg.ip || '—' : 'DHCP'} · {iface.speed}</p>
                  </div>
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase mr-2" style={iface.status === 'up' ? { background: 'rgba(16,185,129,0.12)', color: '#10b981' } : { background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.3)' }}>
                    {iface.status}
                  </span>
                  <span className="text-white/20 text-xs">{expanded ? '▲' : '▼'}</span>
                </button>

                {/* Config panel */}
                <AnimatePresence>
                  {expanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 pt-2 space-y-4 border-t border-white/[0.05]">
                        {/* DHCP / Static */}
                        <div className="space-y-2">
                          <label className="text-[10px] text-white/35 uppercase tracking-wide">IP Mode</label>
                          <div className="flex gap-1 p-1 rounded-lg w-fit" style={{ background: 'rgba(255,255,255,0.05)' }}>
                            {(['dhcp','static'] as const).map(m => (
                              <button
                                key={m}
                                onClick={() => patchEth(iface.name, { mode: m })}
                                className="px-4 py-1 rounded-md text-xs font-medium cursor-pointer transition-all"
                                style={{ background: cfg.mode === m ? 'rgba(59,130,246,0.25)' : 'transparent', color: cfg.mode === m ? '#93c5fd' : 'rgba(255,255,255,0.4)' }}
                              >
                                {m === 'dhcp' ? 'DHCP (Auto)' : 'Static'}
                              </button>
                            ))}
                          </div>
                        </div>

                        {cfg.mode === 'static' && (
                          <div className="grid grid-cols-3 gap-2">
                            <div className="space-y-1">
                              <label className="text-[10px] text-white/35">IP Address</label>
                              <Input value={cfg.ip}      onChange={v => patchEth(iface.name, { ip: v })}      placeholder="192.168.1.100" mono />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] text-white/35">Subnet Mask</label>
                              <Input value={cfg.subnet}  onChange={v => patchEth(iface.name, { subnet: v })}  placeholder="255.255.255.0" mono />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] text-white/35">Gateway</label>
                              <Input value={cfg.gateway} onChange={v => patchEth(iface.name, { gateway: v })} placeholder="192.168.1.1" mono />
                            </div>
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <label className="text-[10px] text-white/35">Primary DNS</label>
                            <Input value={cfg.dns1} onChange={v => patchEth(iface.name, { dns1: v })} placeholder="1.1.1.1" mono />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] text-white/35">Secondary DNS</label>
                            <Input value={cfg.dns2} onChange={v => patchEth(iface.name, { dns2: v })} placeholder="8.8.8.8" mono />
                          </div>
                        </div>

                        <div className="flex justify-end">
                          <button className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold cursor-pointer transition-colors">
                            Save
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// 3. Partilhas SMB
function SmbPanel() {
  const [shares, setShares] = useState<SmbShare[]>([
    { id: 1, name: 'Media',  path: '/srv/nas/media',  comment: 'Movies and music',       writable: true,  guest: false, browseable: true  },
    { id: 2, name: 'Backup', path: '/srv/nas/backup', comment: 'Security copies',        writable: true,  guest: false, browseable: false },
    { id: 3, name: 'Public', path: '/srv/nas/public', comment: 'Public share',           writable: false, guest: true,  browseable: true  },
  ])
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing]     = useState<SmbShare | null>(null)
  const [form, setForm]           = useState({ name: '', path: '/srv/nas/', comment: '', writable: true, guest: false, browseable: true })

  const openAdd  = () => { setEditing(null); setForm({ name: '', path: '/srv/nas/', comment: '', writable: true, guest: false, browseable: true }); setShowModal(true) }
  const openEdit = (s: SmbShare) => { setEditing(s); setForm({ name: s.name, path: s.path, comment: s.comment, writable: s.writable, guest: s.guest, browseable: s.browseable }); setShowModal(true) }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (editing) setShares(prev => prev.map(s => s.id === editing.id ? { ...s, ...form } : s))
    else setShares(prev => [...prev, { id: Date.now(), ...form }])
    setShowModal(false)
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <SLabel>Active Shares</SLabel>
          <button onClick={openAdd} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600/80 hover:bg-amber-600 text-white font-medium text-xs transition-colors cursor-pointer mb-2">
            <Plus size={11} weight="bold" /> New Share
          </button>
        </div>
        <div className="space-y-1.5">
          {shares.map(s => (
            <div key={s.id} className="flex items-center gap-3 px-4 py-3 rounded-xl group" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(245,158,11,0.1)' }}>
                <FolderSimple size={15} weight="fill" style={{ color: '#f59e0b' }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-white">{s.name}</span>
                  {s.guest && <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}>Guest</span>}
                  {!s.writable && <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.35)' }}>Read-only</span>}
                </div>
                <p className="text-[10px] text-white/30 mt-0.5 font-mono truncate">{s.path}</p>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => openEdit(s)} className="p-1.5 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/5 cursor-pointer transition-colors"><Gear size={12} /></button>
                <button onClick={() => setShares(prev => prev.filter(x => x.id !== s.id))} className="p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 cursor-pointer transition-colors"><Trash size={12} /></button>
              </div>
            </div>
          ))}
        </div>
        <div>
          <SLabel>Global Samba Configuration</SLabel>
          <Card>
            <Row label="Workgroup"           value="WORKGROUP" />
            <Row label="NetBIOS name"        value="KURAOS" />
            <Row label="Min SMB version"     value="SMB2" />
            <Row label="DOS attributes"      value="Disabled (POSIX safe)" />
          </Card>
        </div>
      </div>

      <AnimatePresence>
        {showModal && (
          <Modal onClose={() => setShowModal(false)}>
            <h3 className="font-bold text-base text-white mb-4">{editing ? 'Edit Share' : 'New SMB Share'}</h3>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-white/35 uppercase tracking-wide">Nome</label>
                  <Input value={form.name} onChange={v => setForm(p => ({ ...p, name: v }))} placeholder="Media" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-white/35 uppercase tracking-wide">Comment</label>
                  <Input value={form.comment} onChange={v => setForm(p => ({ ...p, comment: v }))} placeholder="Descrição" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-white/35 uppercase tracking-wide">Caminho (Path)</label>
                <Input value={form.path} onChange={v => setForm(p => ({ ...p, path: v }))} mono />
              </div>
              <div className="space-y-2 pt-1">
                {([['writable','Write access'],['guest','Guest access'],['browseable','Visible on network']] as const).map(([k, label]) => (
                  <label key={k} className="flex items-center justify-between cursor-pointer">
                    <span className="text-xs text-white/60">{label}</span>
                    <Toggle on={form[k]} onChange={() => setForm(p => ({ ...p, [k]: !p[k] }))} color="#f59e0b" />
                  </label>
                ))}
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-white/5">
                <button type="button" onClick={() => setShowModal(false)} className="px-3 py-1.5 rounded-lg hover:bg-white/5 text-white/50 text-xs font-semibold cursor-pointer">Cancel</button>
                <button type="submit" className="px-3 py-1.5 rounded-lg bg-amber-600/80 hover:bg-amber-600 text-white text-xs font-semibold cursor-pointer">Save</button>
              </div>
            </form>
          </Modal>
        )}
      </AnimatePresence>
    </>
  )
}

// 4. Online Accounts
function OnlineAccountsPanel() {
  const [accounts, setAccounts] = useState([
    { id: 1, provider: 'google',    name: 'escaleirex@gmail.com',       connected: true,  purpose: 'Photos & Docs Backup' },
    { id: 2, provider: 's3',        name: 'kura-nas-backup (eu-west-1)', connected: true,  purpose: 'Full Backup' },
    { id: 3, provider: 'dropbox',   name: '—',                          connected: false, purpose: '' },
    { id: 4, provider: 'backblaze', name: '—',                          connected: false, purpose: '' },
  ])

  const meta: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    google:    { label: 'Google Drive',  color: '#ea4335', icon: <GoogleLogo size={16} weight="fill" /> },
    s3:        { label: 'Amazon S3',     color: '#f59e0b', icon: <Cloud size={16} weight="fill" /> },
    dropbox:   { label: 'Dropbox',       color: '#0061ff', icon: <DropboxLogo size={16} weight="fill" /> },
    backblaze: { label: 'Backblaze B2',  color: '#ef4444', icon: <HardDrive size={16} weight="fill" /> },
  }

  return (
    <div className="space-y-4">
      <SLabel>External Backup Accounts</SLabel>
      <div className="space-y-1.5">
        {accounts.map(a => {
          const m = meta[a.provider]
          return (
            <div key={a.id} className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${m.color}15`, border: `1px solid ${m.color}25`, color: m.color }}>{m.icon}</div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-white">{m.label}</p>
                <p className="text-[10px] text-white/30 mt-0.5 truncate">{a.connected ? `${a.name}${a.purpose ? ` · ${a.purpose}` : ''}` : 'Not connected'}</p>
              </div>
              <button
                onClick={() => setAccounts(prev => prev.map(x => x.id === a.id ? { ...x, connected: !x.connected } : x))}
                className="shrink-0 px-3 py-1.5 rounded-lg text-[10px] font-semibold cursor-pointer transition-all"
                style={a.connected ? { background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' } : { background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                {a.connected ? 'Disconnect' : 'Connect'}
              </button>
            </div>
          )
        })}
      </div>
      <div className="px-4 py-3 rounded-xl text-[11px] text-white/35 leading-relaxed" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
        Backup tasks are configured in the Storage app. Here you only manage access credentials for external accounts.
      </div>
    </div>
  )
}

// 5. Power (no suspend — it's a server)
function PowerPanel() {
  const [profile, setProfile]   = useState<'performance' | 'balanced' | 'saver'>('balanced')
  const [wol, setWol]           = useState(true)
  const [spindown, setSpindown] = useState('30')

  const profiles = [
    { id: 'performance', label: 'Performance',  sub: 'No CPU frequency limit, fans at maximum', icon: Lightning, color: '#ef4444' },
    { id: 'balanced',    label: 'Balanced',      sub: 'Balances speed and power consumption',   icon: Wind,      color: '#3b82f6' },
    { id: 'saver',       label: 'Power Saver',   sub: 'Low frequency, quiet fans',              icon: Leaf,      color: '#10b981' },
  ] as const

  return (
    <div className="space-y-5">
      <div>
        <SLabel>Power Profile</SLabel>
        <div className="space-y-1.5">
          {profiles.map(p => {
            const Icon = p.icon
            const active = profile === p.id
            return (
              <button key={p.id} onClick={() => setProfile(p.id)} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all text-left" style={{ background: active ? `${p.color}0d` : 'rgba(255,255,255,0.04)', border: active ? `1px solid ${p.color}30` : '1px solid rgba(255,255,255,0.06)' }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${p.color}15` }}>
                  <Icon size={15} weight="fill" style={{ color: p.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-semibold ${active ? 'text-white' : 'text-white/60'}`}>{p.label}</p>
                  <p className="text-[10px] text-white/30 mt-0.5">{p.sub}</p>
                </div>
                <div className="w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center" style={{ borderColor: active ? p.color : 'rgba(255,255,255,0.2)' }}>
                  {active && <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />}
                </div>
              </button>
            )
          })}
        </div>
      </div>
      <div>
        <SLabel>Disks</SLabel>
        <Card>
          <div className="py-3 flex items-center gap-3">
            <HardDrive size={13} style={{ color: 'rgba(255,255,255,0.3)' }} />
            <span className="text-xs text-white flex-1">Spindown after inactivity</span>
            <select value={spindown} onChange={e => setSpindown(e.target.value)} className="bg-slate-800 border border-white/10 rounded-lg px-2 py-1 text-xs text-white">
              <option value="0">Never</option>
              <option value="10">10 minutes</option>
              <option value="30">30 minutes</option>
              <option value="60">1 hour</option>
              <option value="180">3 hours</option>
            </select>
          </div>
        </Card>
      </div>
      <div>
        <SLabel>Network</SLabel>
        <Card><RowToggle label="Wake-on-LAN" sub="Power on remotely via Ethernet magic packet" on={wol} onChange={() => setWol(p => !p)} color="#10b981" /></Card>
      </div>
    </div>
  )
}

// 6. Apps & Services — service manager
interface ServiceDef {
  id: string
  label: string
  sub: string
  running: boolean
  startup: boolean
  restartOnError: boolean
  critical: boolean
  version?: string
  updateAvailable?: boolean
}

function AppsPanel() {
  const [services, setServices] = useState<ServiceDef[]>([
    { id: 'samba',     label: 'Samba / SMB',      sub: 'Windows file server',               running: true,  startup: true,  restartOnError: true,  critical: true,  version: '4.17.12' },
    { id: 'nfs',       label: 'NFS Server',        sub: 'NFS exports for Linux/macOS',       running: true,  startup: true,  restartOnError: true,  critical: false, version: '2.6.4' },
    { id: 'docker',    label: 'Docker Engine',     sub: 'OCI container engine',              running: true,  startup: true,  restartOnError: true,  critical: false, version: '26.1.4' },
    { id: 'tailscale', label: 'Tailscale',         sub: 'Zero-config mesh VPN',              running: true,  startup: true,  restartOnError: false, critical: false, version: '1.68.1', updateAvailable: true },
    { id: 'nginx',     label: 'Nginx',             sub: 'Reverse proxy and web server',      running: false, startup: false, restartOnError: false, critical: false, version: '1.25.3' },
    { id: 'jellyfin',  label: 'Jellyfin',          sub: 'Personal media server',             running: false, startup: false, restartOnError: false, critical: false, version: '10.9.7', updateAvailable: true },
    { id: 'nextcloud', label: 'Nextcloud',         sub: 'Personal cloud and sync',           running: false, startup: false, restartOnError: false, critical: false, version: '29.0.2' },
  ])

  const patch = (id: string, delta: Partial<ServiceDef>) =>
    setServices(prev => prev.map(s => s.id === id ? { ...s, ...delta } : s))

  return (
    <div className="space-y-4">
      <SLabel>Services & Applications</SLabel>
      <div className="space-y-2">
        {services.map(s => (
          <div
            key={s.id}
            className="rounded-xl overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            {/* Top row */}
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="w-2 h-2 rounded-full shrink-0" style={{ background: s.running ? '#10b981' : 'rgba(255,255,255,0.15)' }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-white">{s.label}</span>
                  {s.version && <span className="text-[9px] text-white/25 font-mono">v{s.version}</span>}
                  {s.critical && <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>Critical</span>}
                  {s.updateAvailable && <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(6,182,212,0.1)', color: '#06b6d4' }}>Update</span>}
                </div>
                <p className="text-[10px] text-white/30 mt-0.5">{s.sub}</p>
              </div>
              {/* Action buttons */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => patch(s.id, { running: !s.running })}
                  className="p-1.5 rounded-lg cursor-pointer transition-colors"
                  title={s.running ? 'Stop' : 'Start'}
                  style={{ background: s.running ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)', color: s.running ? '#ef4444' : '#10b981' }}
                >
                  {s.running ? <Stop size={12} weight="fill" /> : <Play size={12} weight="fill" />}
                </button>
                {s.updateAvailable && (
                  <button
                    onClick={() => patch(s.id, { updateAvailable: false })}
                    className="p-1.5 rounded-lg cursor-pointer transition-colors text-sky-400 hover:bg-sky-500/10"
                    title="Update"
                  >
                    <ArrowUp size={12} weight="bold" />
                  </button>
                )}
                {!s.critical && (
                  <button
                    onClick={() => setServices(prev => prev.filter(x => x.id !== s.id))}
                    className="p-1.5 rounded-lg cursor-pointer transition-colors text-white/20 hover:text-red-400 hover:bg-red-500/10"
                    title="Uninstall"
                  >
                    <Prohibit size={12} />
                  </button>
                )}
              </div>
            </div>

            {/* Toggles row */}
            <div className="flex items-center gap-6 px-4 py-2 border-t border-white/[0.04]">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <Toggle on={s.startup} onChange={() => patch(s.id, { startup: !s.startup })} color="#3b82f6" />
                <span className="text-[10px] text-white/35">Start on startup</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <Toggle on={s.restartOnError} onChange={() => patch(s.id, { restartOnError: !s.restartOnError })} color="#f59e0b" />
                <span className="text-[10px] text-white/35">Restart on error</span>
              </label>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// 7. Search — AI file search (UGREEN-style)
function SearchPanel() {
  const [aiSearch, setAiSearch]       = useState(true)
  const [axisModel, setAxisModel]     = useState('groq/llama-3.3-70b')
  const [showKey, setShowKey]         = useState(false)
  const [apiKey, setApiKey]           = useState('sk-••••••••••••••••••••••••••••••')
  const [schedule, setSchedule]       = useState('daily')
  const [scopeContent, setScopeContent] = useState(false)

  const indexedPaths = [
    { path: '/srv/nas/media',   label: 'Media',   enabled: true  },
    { path: '/srv/nas/backup',  label: 'Backup',  enabled: false },
    { path: '/srv/nas/public',  label: 'Public',  enabled: true  },
    { path: 'Docker Volumes',   label: 'Docker',  enabled: false },
  ]
  const [paths, setPaths] = useState(indexedPaths)

  return (
    <div className="space-y-5">
      <div>
        <SLabel>AI Search</SLabel>
        <Card>
          <RowToggle label="AI-Assisted File Search" sub="Uses Axis to find files by content, context or natural language" on={aiSearch} onChange={() => setAiSearch(p => !p)} color="#f97316" />
          {aiSearch && (
            <>
              <div className="py-3 border-t border-white/[0.05] flex items-center gap-3">
                <span className="text-xs text-white flex-1">AI Model</span>
                <select value={axisModel} onChange={e => setAxisModel(e.target.value)} className="bg-slate-800 border border-white/10 rounded-lg px-2 py-1 text-xs text-white max-w-[200px]">
                  <optgroup label="Groq (Cloud)"><option value="groq/llama-3.3-70b">Llama 3.3 70B</option><option value="groq/mixtral-8x7b">Mixtral 8x7B</option></optgroup>
                  <optgroup label="Local (Ollama)"><option value="ollama/llama3.2">Llama 3.2 (Local)</option><option value="ollama/mistral">Mistral 7B (Local)</option></optgroup>
                </select>
              </div>
              <div className="py-3 border-t border-white/[0.05] space-y-1.5">
                <label className="text-[10px] text-white/35 uppercase tracking-wide">API Key</label>
                <div className="flex gap-2">
                  <input type={showKey ? 'text' : 'password'} value={apiKey} onChange={e => setApiKey(e.target.value)} className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-orange-500/50" />
                  <button onClick={() => setShowKey(p => !p)} className="p-2 rounded-lg text-white/30 hover:text-white/60 transition-colors cursor-pointer" style={{ background: 'rgba(255,255,255,0.05)' }}>
                    {showKey ? <EyeSlash size={13} /> : <Eye size={13} />}
                  </button>
                </div>
              </div>
            </>
          )}
        </Card>
      </div>

      <div>
        <SLabel>Search Scope</SLabel>
        <Card>
          <RowToggle label="Index file content" sub="Text, PDFs and documents — content search (slower)" on={scopeContent} onChange={() => setScopeContent(p => !p)} color="#f97316" />
        </Card>
      </div>

      <div>
        <SLabel>Indexed Locations</SLabel>
        <div className="space-y-1.5">
          {paths.map((p, i) => (
            <div key={p.path} className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <FolderSimple size={13} weight="fill" style={{ color: p.enabled ? '#f97316' : 'rgba(255,255,255,0.2)' }} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-white">{p.label}</p>
                <p className="text-[10px] text-white/30 mt-0.5 font-mono">{p.path}</p>
              </div>
              <Toggle on={p.enabled} onChange={() => setPaths(prev => prev.map((x, j) => j === i ? { ...x, enabled: !x.enabled } : x))} color="#f97316" />
            </div>
          ))}
        </div>
      </div>

      <div>
        <SLabel>Indexing Schedule</SLabel>
        <Card>
          <div className="py-3 flex items-center gap-3">
            <span className="text-xs text-white flex-1">Frequency</span>
            <select value={schedule} onChange={e => setSchedule(e.target.value)} className="bg-slate-800 border border-white/10 rounded-lg px-2 py-1 text-xs text-white">
              <option value="realtime">Real-time (inotify)</option>
              <option value="hourly">Every hour</option>
              <option value="daily">Daily (03:00)</option>
              <option value="weekly">Weekly</option>
            </select>
          </div>
        </Card>
      </div>
    </div>
  )
}

// 8. Notifications
function NotificationsPanel() {
  const [alerts, setAlerts] = useState({ diskFull: true, raidDegraded: true, backupFail: true, updateAvail: true, loginFail: false, tempCrit: true, dockerDown: false })
  type K = keyof typeof alerts

  const items: { key: K; label: string; sub: string; color: string }[] = [
    { key: 'diskFull',     label: 'Disk Almost Full',        sub: 'Storage usage > 90%',                  color: '#f97316' },
    { key: 'raidDegraded', label: 'RAID Degraded',           sub: 'Disk failure or removal from array',   color: '#ef4444' },
    { key: 'backupFail',   label: 'Backup Failure',          sub: 'External backup did not complete',     color: '#ef4444' },
    { key: 'updateAvail',  label: 'Updates Available',       sub: 'New security patches',                 color: '#06b6d4' },
    { key: 'loginFail',    label: 'Authentication Failure',  sub: 'Multiple failed login attempts',       color: '#f59e0b' },
    { key: 'tempCrit',     label: 'Critical Temperature',    sub: 'Hardware above safe threshold',        color: '#ef4444' },
    { key: 'dockerDown',   label: 'Docker Container Stopped', sub: 'Service went down unexpectedly',      color: '#8b5cf6' },
  ]

  return (
    <div className="space-y-4">
      <SLabel>System Alerts</SLabel>
      <div className="space-y-1.5">
        {items.map(({ key, label, sub, color }) => (
          <div key={key} className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="w-2 h-2 rounded-full shrink-0" style={{ background: alerts[key] ? color : 'rgba(255,255,255,0.15)' }} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-white">{label}</p>
              <p className="text-[10px] text-white/30 mt-0.5">{sub}</p>
            </div>
            <Toggle on={alerts[key]} onChange={() => setAlerts(prev => ({ ...prev, [key]: !prev[key] }))} color={color} />
          </div>
        ))}
      </div>
    </div>
  )
}

// 9. Axis AI settings
function AxisPanel() {
  const [mode, setMode]           = useState<'auto' | 'local' | 'cloud'>('auto')
  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434')
  const [localModel, setLocalModel] = useState('qwen3:8b')
  const [preferred, setPreferred] = useState<'groq' | 'openai' | 'anthropic' | 'openrouter'>('groq')
  const [keys, setKeys] = useState({ groq: '', openai: '', anthropic: '', openrouter: '' })
  const [visible, setVisible] = useState({ groq: false, openai: false, anthropic: false, openrouter: false })
  const [saved, setSaved]         = useState(false)

  const handleSave = () => { setSaved(true); setTimeout(() => setSaved(false), 3000) }

  const providers: { id: keyof typeof keys; label: string; placeholder: string; isDefault: boolean }[] = [
    { id: 'groq',        label: 'Groq',        placeholder: 'gsk_••••••••••••••••••••••••••••••', isDefault: preferred === 'groq' },
    { id: 'openai',      label: 'OpenAI',      placeholder: 'sk-proj-••••••••••••••••••••••••••••••••', isDefault: preferred === 'openai' },
    { id: 'anthropic',   label: 'Anthropic',   placeholder: 'sk-ant-••••••••••••••••••••••••••••••••', isDefault: preferred === 'anthropic' },
    { id: 'openrouter',  label: 'OpenRouter',  placeholder: 'sk-or-••••••••••••••••••••••••••••••••', isDefault: preferred === 'openrouter' },
  ]

  return (
    <div className="space-y-5">
      {/* Inference mode */}
      <div>
        <SLabel>Inference Mode</SLabel>
        <div className="grid grid-cols-3 gap-2">
          {([['auto','Auto','Uses local if hardware score ≥ 2'],['local','Local','Ollama only (offline)'],['cloud','Cloud','Cloud API only']] as const).map(([val, label, sub]) => (
            <button
              key={val}
              onClick={() => setMode(val)}
              className="flex flex-col gap-1 p-3 rounded-xl cursor-pointer transition-all text-left"
              style={{ background: mode === val ? 'rgba(167,139,250,0.1)' : 'rgba(255,255,255,0.04)', border: mode === val ? '1px solid rgba(167,139,250,0.3)' : '1px solid rgba(255,255,255,0.06)' }}
            >
              <span className={`text-xs font-semibold ${mode === val ? 'text-purple-300' : 'text-white/50'}`}>{label}</span>
              <span className="text-[9px] text-white/25 leading-relaxed">{sub}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Local / Ollama */}
      {(mode === 'auto' || mode === 'local') && (
        <div>
          <SLabel>Local Models (Ollama)</SLabel>
          <Card>
            <div className="py-3 border-b border-white/[0.05] space-y-1.5">
              <label className="text-[10px] text-white/35 uppercase tracking-wide">Ollama URL</label>
              <Input value={ollamaUrl} onChange={setOllamaUrl} mono placeholder="http://localhost:11434" />
            </div>
            <div className="py-3 flex items-center gap-3">
              <span className="text-xs text-white flex-1">Default model</span>
              <select value={localModel} onChange={e => setLocalModel(e.target.value)} className="bg-slate-800 border border-white/10 rounded-lg px-2 py-1 text-xs text-white">
                <option value="qwen3:8b">qwen3:8b (recommended)</option>
                <option value="llama3.2:3b">llama3.2:3b (lightweight)</option>
                <option value="llama3.2:8b">llama3.2:8b</option>
                <option value="mistral:7b">mistral:7b</option>
                <option value="phi3:mini">phi3:mini (very lightweight)</option>
                <option value="gemma2:9b">gemma2:9b</option>
                <option value="deepseek-r1:8b">deepseek-r1:8b</option>
              </select>
            </div>
          </Card>
        </div>
      )}

      {/* Cloud providers */}
      {(mode === 'auto' || mode === 'cloud') && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <SLabel>Cloud Providers</SLabel>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] text-white/30">Preferred provider</span>
              <select value={preferred} onChange={e => setPreferred(e.target.value as typeof preferred)} className="bg-slate-800 border border-white/10 rounded-lg px-2 py-1 text-[10px] text-white">
                <option value="groq">Groq</option>
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
                <option value="openrouter">OpenRouter</option>
              </select>
            </div>
          </div>
          <div className="space-y-2">
            {providers.map(p => (
              <div key={p.id} className="rounded-xl px-4 py-3 space-y-2" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-white">{p.label}</span>
                  {p.isDefault && <span className="text-[9px] px-1.5 py-0.5 rounded font-bold" style={{ background: 'rgba(167,139,250,0.15)', color: '#a78bfa' }}>Default</span>}
                </div>
                <div className="flex gap-2">
                  <input
                    type={visible[p.id] ? 'text' : 'password'}
                    value={keys[p.id]}
                    onChange={e => setKeys(prev => ({ ...prev, [p.id]: e.target.value }))}
                    placeholder={p.placeholder}
                    className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-purple-500/50"
                  />
                  <button onClick={() => setVisible(prev => ({ ...prev, [p.id]: !prev[p.id] }))} className="p-2 rounded-lg text-white/30 hover:text-white/60 transition-colors cursor-pointer shrink-0" style={{ background: 'rgba(255,255,255,0.05)' }}>
                    {visible[p.id] ? <EyeSlash size={13} /> : <Eye size={13} />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-end gap-3 pt-1">
        {saved && <span className="text-xs text-emerald-400 flex items-center gap-1.5"><CheckCircle size={13} weight="fill" />Configuration saved</span>}
        <button onClick={handleSave} className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs cursor-pointer transition-colors">
          Save Configuration
        </button>
      </div>
    </div>
  )
}

// 10. Users
function UsersPanel() {
  const [users, setUsers] = useState<SystemUser[]>([
    { username: 'admin',      role: 'admin', email: 'admin@kura.local',          samba: true,  lastLogin: 'Today, 11:20' },
    { username: 'escaleirex', role: 'admin', email: 'daniel@escaleira.dev',      samba: true,  lastLogin: 'Yesterday, 20:45' },
    { username: 'guest_user', role: 'user',  email: '',                          samba: false, lastLogin: 'Never' },
  ])
  const [showModal, setShowModal]   = useState(false)
  const [newName, setNewName]       = useState('')
  const [newEmail, setNewEmail]     = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newConfirm, setNewConfirm] = useState('')
  const [newRole, setNewRole]       = useState<'admin' | 'user'>('user')
  const [newSamba, setNewSamba]     = useState(true)
  const [showPwd, setShowPwd]       = useState(false)

  const closeModal = () => { setShowModal(false); setNewName(''); setNewEmail(''); setNewPassword(''); setNewConfirm(''); setShowPwd(false) }

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword !== newConfirm) return
    setUsers(prev => [...prev, { username: newName, role: newRole, email: newEmail, samba: newSamba, lastLogin: 'Never' }])
    closeModal()
  }

  const pwdMismatch = newConfirm.length > 0 && newPassword !== newConfirm

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <SLabel>Local Accounts</SLabel>
          <button onClick={() => setShowModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-medium text-xs transition-colors cursor-pointer mb-2">
            <Plus size={11} weight="bold" /> Create Account
          </button>
        </div>
        <div className="space-y-1.5">
          {users.map(user => (
            <div key={user.username} className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0" style={{ background: user.role === 'admin' ? 'rgba(139,92,246,0.15)' : 'rgba(255,255,255,0.08)', color: user.role === 'admin' ? '#8b5cf6' : 'rgba(255,255,255,0.5)' }}>
                {user.username[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-white">{user.username}</span>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase" style={user.role === 'admin' ? { background: 'rgba(139,92,246,0.12)', color: '#8b5cf6', border: '1px solid rgba(139,92,246,0.2)' } : { background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.4)' }}>
                    {user.role}
                  </span>
                </div>
                <p className="text-[10px] text-white/25 mt-0.5">{user.email || 'No email'} · Login: {user.lastLogin}</p>
              </div>
              <label className="flex items-center gap-2 cursor-pointer select-none shrink-0">
                <span className="text-[10px] text-white/30">Samba</span>
                <Toggle on={user.samba} onChange={() => setUsers(prev => prev.map(u => u.username === user.username ? { ...u, samba: !u.samba } : u))} color="#10b981" />
              </label>
              {user.username !== 'admin' && (
                <button onClick={() => setUsers(prev => prev.filter(u => u.username !== user.username))} className="shrink-0 p-1.5 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer">
                  <Trash size={13} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {showModal && (
          <Modal onClose={closeModal}>
            <h3 className="font-bold text-base text-white mb-4">Create New Account</h3>
            <form onSubmit={handleAdd} className="space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] text-white/35 uppercase tracking-wide">Username</label>
                <Input value={newName} onChange={setNewName} placeholder="example" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-white/35 uppercase tracking-wide flex items-center gap-1"><At size={10} /> Email (optional)</label>
                <Input value={newEmail} onChange={setNewEmail} placeholder="user@email.com" type="email" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-white/35 uppercase tracking-wide">Password</label>
                <div className="flex gap-2">
                  <Input value={newPassword} onChange={setNewPassword} placeholder="••••••••" type={showPwd ? 'text' : 'password'} />
                  <button type="button" onClick={() => setShowPwd(p => !p)} className="p-2 rounded-lg text-white/30 hover:text-white/60 cursor-pointer shrink-0" style={{ background: 'rgba(255,255,255,0.05)' }}>
                    {showPwd ? <EyeSlash size={13} /> : <Eye size={13} />}
                  </button>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-white/35 uppercase tracking-wide">Confirm Password</label>
                <Input value={newConfirm} onChange={setNewConfirm} placeholder="••••••••" type={showPwd ? 'text' : 'password'} className={pwdMismatch ? 'border-red-500/50' : ''} />
                {pwdMismatch && <p className="text-[10px] text-red-400">Passwords do not match</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-white/35 uppercase tracking-wide">Role</label>
                  <select value={newRole} onChange={e => setNewRole(e.target.value as 'admin' | 'user')} className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white">
                    <option value="user">User</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-white/35 uppercase tracking-wide">Samba Access</label>
                  <select value={newSamba ? 'true' : 'false'} onChange={e => setNewSamba(e.target.value === 'true')} className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white">
                    <option value="true">Allowed</option>
                    <option value="false">Blocked</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-white/5">
                <button type="button" onClick={closeModal} className="px-3 py-1.5 rounded-lg hover:bg-white/5 text-white/50 text-xs font-semibold cursor-pointer">Cancel</button>
                <button type="submit" disabled={pwdMismatch || !newName || !newPassword} className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold cursor-pointer">Create Account</button>
              </div>
            </form>
          </Modal>
        )}
      </AnimatePresence>
    </>
  )
}

// 11. Security
function SecurityPanel() {
  const [twoFaEnabled, setTwoFaEnabled] = useState(false)
  const [show2faModal, setShow2faModal] = useState(false)
  const [verifyCode, setVerifyCode]     = useState('')

  const handleEnable2fa = (e: React.FormEvent) => { e.preventDefault(); setTwoFaEnabled(true); setShow2faModal(false); setVerifyCode('') }

  return (
    <>
      <div className="space-y-5">
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={twoFaEnabled ? { background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.15)' } : { background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.15)' }}>
          {twoFaEnabled ? <CheckCircle size={16} weight="fill" style={{ color: '#10b981' }} /> : <Warning size={16} weight="fill" style={{ color: '#ef4444' }} />}
          <div>
            <p className="text-xs font-semibold" style={{ color: twoFaEnabled ? '#10b981' : '#ef4444' }}>{twoFaEnabled ? 'Account protected with 2FA' : 'No additional authentication'}</p>
            <p className="text-[10px] text-white/30 mt-0.5">{twoFaEnabled ? 'TOTP active' : 'We recommend enabling 2FA'}</p>
          </div>
        </div>
        <div>
          <SLabel>Two-Factor Authentication</SLabel>
          <Card>
            <div className="py-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}>
                <Lock size={16} weight="fill" style={{ color: '#10b981' }} />
              </div>
              <div className="flex-1"><p className="text-xs font-semibold text-white">TOTP</p><p className="text-[10px] text-white/30 mt-0.5">Google Authenticator, Authy, Bitwarden...</p></div>
              <button onClick={() => twoFaEnabled ? setTwoFaEnabled(false) : setShow2faModal(true)} className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors" style={twoFaEnabled ? { background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' } : { background: 'rgba(16,185,129,0.12)', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)' }}>
                {twoFaEnabled ? 'Disable' : 'Enable'}
              </button>
            </div>
          </Card>
        </div>
        <div>
          <SLabel>Password Policies</SLabel>
          <Card>
            <Row label="Minimum length"        value="12 characters" />
            <Row label="Uppercase required"    value="Yes" />
            <Row label="Numbers required"      value="Yes" />
            <Row label="Expiration"            value="Never" />
          </Card>
        </div>
      </div>
      <AnimatePresence>
        {show2faModal && (
          <Modal onClose={() => setShow2faModal(false)}>
            <h3 className="font-bold text-base text-white mb-4 text-center">Set up 2FA</h3>
            <form onSubmit={handleEnable2fa} className="space-y-4 flex flex-col items-center">
              <div className="p-3 bg-white rounded-xl"><QrCode size={140} className="text-slate-900" /></div>
              <p className="text-[11px] text-white/40 text-center leading-relaxed px-2">Scan the QR code with Google Authenticator or Authy and enter the 6-digit code.</p>
              <div className="space-y-1 w-full">
                <label className="text-[10px] text-white/35 uppercase tracking-wide">Verification Code</label>
                <input type="text" placeholder="000000" value={verifyCode} onChange={e => setVerifyCode(e.target.value)} className="w-full text-center bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white font-mono tracking-[0.5em] focus:outline-none focus:border-sky-500/50" maxLength={6} required autoFocus />
              </div>
              <div className="flex justify-end gap-2 w-full pt-2 border-t border-white/5">
                <button type="button" onClick={() => setShow2faModal(false)} className="px-3 py-1.5 rounded-lg hover:bg-white/5 text-white/50 text-xs font-semibold cursor-pointer">Cancel</button>
                <button type="submit" className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold cursor-pointer">Enable 2FA</button>
              </div>
            </form>
          </Modal>
        )}
      </AnimatePresence>
    </>
  )
}

// 12. SSH
function SshPanel() {
  const [sshEnabled, setSshEnabled]       = useState(true)
  const [port, setPort]                   = useState('22')
  const [passwordAuth, setPasswordAuth]   = useState(false)
  const [rootLogin, setRootLogin]         = useState(false)
  const [keys] = useState([
    { id: 1, comment: 'escaleirex@desktop', fingerprint: 'SHA256:xK3nP8...aQ2m', added: '2026-04-10' },
    { id: 2, comment: 'escaleirex@laptop',  fingerprint: 'SHA256:rT7wL1...bF9j', added: '2026-05-01' },
  ])

  return (
    <div className="space-y-5">
      <div>
        <SLabel>OpenSSH Server</SLabel>
        <Card>
          <RowToggle label="Enable SSH server" sub="Remote access via terminal" on={sshEnabled} onChange={() => setSshEnabled(p => !p)} color="#3b82f6" />
          {sshEnabled && (
            <div className="py-3 border-t border-white/[0.05] flex items-center gap-3">
              <span className="text-xs text-white flex-1">Port</span>
              <input type="text" value={port} onChange={e => setPort(e.target.value)} className="w-20 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white font-mono text-center focus:outline-none focus:border-sky-500/50" />
            </div>
          )}
        </Card>
      </div>
      {sshEnabled && (
        <>
          <div>
            <SLabel>Authentication</SLabel>
            <Card>
              <RowToggle label="Password authentication" sub="Disable to use keys only" on={passwordAuth} onChange={() => setPasswordAuth(p => !p)} color="#f59e0b" />
              <RowToggle label="Root login" sub="Not recommended in production" on={rootLogin} onChange={() => setRootLogin(p => !p)} color="#ef4444" />
            </Card>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <SLabel>Authorized SSH Keys</SLabel>
              <button className="flex items-center gap-1 text-[10px] text-sky-400 hover:text-sky-300 cursor-pointer transition-colors mb-2"><Plus size={10} weight="bold" /> Add</button>
            </div>
            <div className="space-y-1.5">
              {keys.map(k => (
                <div key={k.id} className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <Key size={13} style={{ color: 'rgba(255,255,255,0.3)' }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-white">{k.comment}</p>
                    <p className="text-[10px] text-white/30 mt-0.5 font-mono truncate">{k.fingerprint} · {k.added}</p>
                  </div>
                  <button className="p-1.5 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"><Trash size={12} /></button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// 13. Region & Language
function RegionPanel() {
  const [language, setLanguage]       = useState('en-US')
  const [dateFormat, setDateFormat]   = useState('MM/DD/YYYY')
  const [timeFormat, setTimeFormat]   = useState('24h')
  const [currency, setCurrency]       = useState('USD')
  const [numberFormat, setNumberFormat] = useState('en')

  return (
    <div className="space-y-5">
      <div>
        <SLabel>System Language</SLabel>
        <Card>
          <div className="py-3 flex items-center gap-3">
            <Translate size={13} style={{ color: 'rgba(99,102,241,0.7)' }} />
            <span className="text-xs text-white flex-1">Interface Language</span>
            <select value={language} onChange={e => setLanguage(e.target.value)} className="bg-slate-800 border border-white/10 rounded-lg px-2 py-1 text-xs text-white">
              <option value="en-US">English (US)</option>
              <option value="en-GB">English (UK)</option>
              <option value="pt-PT">Português (Portugal)</option>
              <option value="pt-BR">Português (Brasil)</option>
              <option value="es">Español</option>
              <option value="fr">Français</option>
              <option value="de">Deutsch</option>
            </select>
          </div>
        </Card>
      </div>
      <div>
        <SLabel>Regional Formats</SLabel>
        <Card>
          <div className="py-2.5 border-b border-white/[0.05] flex items-center gap-3">
            <span className="text-xs text-white/40 flex-1">Date format</span>
            <select value={dateFormat} onChange={e => setDateFormat(e.target.value)} className="bg-slate-800 border border-white/10 rounded-lg px-2 py-1 text-xs text-white">
              <option value="MM/DD/YYYY">MM/DD/YYYY (US)</option>
              <option value="DD/MM/YYYY">DD/MM/YYYY (Europe)</option>
              <option value="YYYY-MM-DD">YYYY-MM-DD (ISO 8601)</option>
            </select>
          </div>
          <div className="py-2.5 border-b border-white/[0.05] flex items-center gap-3">
            <span className="text-xs text-white/40 flex-1">Time format</span>
            <div className="flex gap-1">
              {(['24h','12h'] as const).map(v => (
                <button key={v} onClick={() => setTimeFormat(v)} className="px-3 py-1 rounded-lg text-xs font-medium cursor-pointer transition-all" style={{ background: timeFormat === v ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.05)', color: timeFormat === v ? '#818cf8' : 'rgba(255,255,255,0.35)', border: timeFormat === v ? '1px solid rgba(99,102,241,0.3)' : '1px solid transparent' }}>{v}</button>
              ))}
            </div>
          </div>
          <div className="py-2.5 border-b border-white/[0.05] flex items-center gap-3">
            <span className="text-xs text-white/40 flex-1">Currency</span>
            <select value={currency} onChange={e => setCurrency(e.target.value)} className="bg-slate-800 border border-white/10 rounded-lg px-2 py-1 text-xs text-white">
              <option value="USD">USD ($)</option><option value="EUR">EUR (€)</option><option value="GBP">GBP (£)</option><option value="BRL">BRL (R$)</option>
            </select>
          </div>
          <div className="py-2.5 flex items-center gap-3">
            <span className="text-xs text-white/40 flex-1">Decimal separator</span>
            <select value={numberFormat} onChange={e => setNumberFormat(e.target.value)} className="bg-slate-800 border border-white/10 rounded-lg px-2 py-1 text-xs text-white">
              <option value="en">Period — 1,234.56</option>
              <option value="pt">Comma — 1.234,56</option>
            </select>
          </div>
        </Card>
      </div>
    </div>
  )
}

// 14. Date & Time
function DateTimePanel() {
  const [ntpEnabled, setNtpEnabled] = useState(true)
  const [ntpServer, setNtpServer]   = useState('pool.ntp.org')
  const [timezone, setTimezone]     = useState('America/New_York')

  return (
    <div className="space-y-5">
      <div>
        <SLabel>Timezone</SLabel>
        <Card>
          <div className="py-3 flex items-center gap-3">
            <Globe size={13} style={{ color: 'rgba(14,165,233,0.7)' }} />
            <span className="text-xs text-white flex-1">Timezone</span>
            <select value={timezone} onChange={e => setTimezone(e.target.value)} className="bg-slate-800 border border-white/10 rounded-lg px-2 py-1 text-xs text-white max-w-[180px]">
              <option value="America/New_York">New York (UTC-5)</option>
              <option value="America/Sao_Paulo">São Paulo (UTC-3)</option>
              <option value="Europe/Lisbon">Lisbon (UTC+0)</option>
              <option value="Europe/London">London (UTC+0)</option>
              <option value="Europe/Paris">Paris (UTC+1)</option>
              <option value="Asia/Tokyo">Tokyo (UTC+9)</option>
              <option value="UTC">UTC</option>
            </select>
          </div>
        </Card>
      </div>
      <div>
        <SLabel>NTP Sync</SLabel>
        <Card>
          <RowToggle label="Sync time automatically" sub="Uses NTP to keep exact time" on={ntpEnabled} onChange={() => setNtpEnabled(p => !p)} color="#0ea5e9" />
          {ntpEnabled && (
            <div className="py-3 border-t border-white/[0.05] flex items-center gap-3">
              <Clock size={13} style={{ color: 'rgba(14,165,233,0.5)' }} />
              <span className="text-xs text-white/60 flex-1">NTP Server</span>
              <input type="text" value={ntpServer} onChange={e => setNtpServer(e.target.value)} className="w-40 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white font-mono focus:outline-none focus:border-sky-500/50" />
            </div>
          )}
        </Card>
      </div>
      {!ntpEnabled && (
        <div>
          <SLabel>Manual Date & Time</SLabel>
          <Card>
            <div className="py-3 grid grid-cols-2 gap-3">
              <div className="space-y-1"><label className="text-[10px] text-white/35">Date</label><input type="date" defaultValue="2026-05-21" className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none" /></div>
              <div className="space-y-1"><label className="text-[10px] text-white/35">Time</label><input type="time" defaultValue="14:30" className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none" /></div>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}

// 15. Remote Desktop
function RemoteDesktopPanel() {
  const [rdpEnabled, setRdpEnabled] = useState(false)
  const [vncEnabled, setVncEnabled] = useState(false)
  const [de, setDe]                 = useState<'xfce' | 'openbox' | 'kde' | 'gnome'>('xfce')
  const [resolution, setResolution] = useState('1920x1080')
  const [autoInstall, setAutoInstall] = useState(true)

  const desktops = [
    { id: 'xfce',    label: 'XFCE',       sub: 'Lightweight and fast, ideal for servers', size: '~400 MB' },
    { id: 'openbox', label: 'Openbox',     sub: 'Minimalist, window manager only',         size: '~80 MB'  },
    { id: 'kde',     label: 'KDE Plasma',  sub: 'Full-featured and modern',                size: '~1.2 GB' },
    { id: 'gnome',   label: 'GNOME',       sub: 'Familiar and polished',                   size: '~900 MB' },
  ] as const

  return (
    <div className="space-y-5">
      <div>
        <SLabel>Protocols</SLabel>
        <Card>
          <RowToggle label="RDP (Remote Desktop Protocol)" sub="Port 3389 — Windows compatible" on={rdpEnabled} onChange={() => setRdpEnabled(p => !p)} color="#14b8a6" />
          <RowToggle label="VNC (Virtual Network Computing)" sub="Port 5900 — compatible with all OS" on={vncEnabled} onChange={() => setVncEnabled(p => !p)} color="#14b8a6" />
        </Card>
      </div>
      {(rdpEnabled || vncEnabled) && (
        <>
          <div>
            <SLabel>Desktop Environment</SLabel>
            <div className="mb-3"><RowToggle label="Auto-install if needed" sub="KuraOS installs the DE via apt" on={autoInstall} onChange={() => setAutoInstall(p => !p)} color="#14b8a6" /></div>
            <div className="space-y-1.5">
              {desktops.map(d => {
                const active = de === d.id
                return (
                  <button key={d.id} onClick={() => setDe(d.id)} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all text-left" style={{ background: active ? 'rgba(20,184,166,0.08)' : 'rgba(255,255,255,0.04)', border: active ? '1px solid rgba(20,184,166,0.25)' : '1px solid rgba(255,255,255,0.06)' }}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2"><p className={`text-xs font-semibold ${active ? 'text-white' : 'text-white/60'}`}>{d.label}</p><span className="text-[9px] text-white/25">{d.size}</span></div>
                      <p className="text-[10px] text-white/30 mt-0.5">{d.sub}</p>
                    </div>
                    <div className="w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center" style={{ borderColor: active ? '#14b8a6' : 'rgba(255,255,255,0.2)' }}>
                      {active && <div className="w-2 h-2 rounded-full bg-teal-400" />}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
          <div>
            <SLabel>Resolution</SLabel>
            <Card>
              <div className="py-3 flex items-center gap-3">
                <Desktop size={13} style={{ color: 'rgba(20,184,166,0.6)' }} />
                <span className="text-xs text-white flex-1">Screen Resolution</span>
                <select value={resolution} onChange={e => setResolution(e.target.value)} className="bg-slate-800 border border-white/10 rounded-lg px-2 py-1 text-xs text-white">
                  <option value="1280x720">1280×720 (HD)</option>
                  <option value="1920x1080">1920×1080 (Full HD)</option>
                  <option value="2560x1440">2560×1440 (QHD)</option>
                  <option value="3840x2160">3840×2160 (4K)</option>
                </select>
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}

// 16. About (with live hardware specs)
function AboutPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ['system-resources'],
    queryFn: () => systemApi.resources(),
    staleTime: 60_000,
    retry: false,
  })

  const res = data?.data

  return (
    <div className="space-y-5">
      <div>
        <SLabel>System Identification</SLabel>
        <Card>
          <Row label="Operating System"  value="KuraOS 1.0.3" />
          <Row label="Base"              value="Debian 12 (Bookworm)" />
          <Row label="Architecture"      value="x86_64" />
          <Row label="Kernel"            value="6.1.0-28-amd64" />
        </Card>
      </div>

      <div>
        <SLabel>Server Hardware</SLabel>
        {isLoading ? (
          <div className="h-24 rounded-xl animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />
        ) : res ? (
          <Card>
            <div className="py-2.5 border-b border-white/[0.05] flex items-center gap-2">
              <Cpu size={11} style={{ color: 'rgba(59,130,246,0.6)' }} />
              <span className="text-xs text-white/40 flex-1">Processor</span>
              <span className="text-xs text-white/75 font-mono text-right max-w-[55%] truncate">{res.cpu.name} · {res.cpu.cores}C/{res.cpu.threads}T</span>
            </div>
            <div className="py-2.5 border-b border-white/[0.05] flex items-center gap-2">
              <Memory size={11} style={{ color: 'rgba(139,92,246,0.6)' }} />
              <span className="text-xs text-white/40 flex-1">RAM</span>
              <span className="text-xs text-white/75 font-mono">{fmtBytes(res.memory.total_bytes)}</span>
            </div>
            {res.gpus?.length > 0 ? res.gpus.map((g: { name: string }, i: number) => (
              <div key={i} className="py-2.5 border-b border-white/[0.05] flex items-center gap-2">
                <GraphicsCard size={11} style={{ color: 'rgba(6,182,212,0.6)' }} />
                <span className="text-xs text-white/40 flex-1">GPU {res.gpus.length > 1 ? i + 1 : ''}</span>
                <span className="text-xs text-white/75 font-mono text-right max-w-[55%] truncate">{g.name}</span>
              </div>
            )) : (
              <div className="py-2.5 border-b border-white/[0.05] flex items-center gap-2">
                <GraphicsCard size={11} style={{ color: 'rgba(255,255,255,0.2)' }} />
                <span className="text-xs text-white/40 flex-1">GPU</span>
                <span className="text-xs text-white/30 font-mono">No dedicated GPU</span>
              </div>
            )}
            {res.disks?.filter((d: { total_bytes?: number }) => d.total_bytes != null).map((d: { name: string; total_bytes?: number }, i: number) => (
              <div key={i} className="py-2.5 border-b border-white/[0.05] last:border-0 flex items-center gap-2">
                <HardDrive size={11} style={{ color: 'rgba(245,158,11,0.6)' }} />
                <span className="text-xs text-white/40 flex-1">{d.name}</span>
                <span className="text-xs text-white/75 font-mono">{fmtBytes(d.total_bytes!)}</span>
              </div>
            ))}
          </Card>
        ) : (
          <div className="px-4 py-3 rounded-xl text-xs text-white/30" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
            Hardware specs unavailable. Daemon not reachable.
          </div>
        )}
      </div>

      <div>
        <SLabel>Build</SLabel>
        <Card>
          <Row label="kura-daemon version" value="v1.0.3 (b8ffa97)" />
          <Row label="Build Date"          value="2026-05-15" />
          <Row label="Go Runtime"          value="go1.24.3 linux/amd64" />
          <Row label="Axis Engine"         value="v0.4.1 (Python 3.12)" />
        </Card>
      </div>

      <div>
        <SLabel>License</SLabel>
        <Card>
          <div className="py-3">
            <p className="text-xs text-white/40 leading-relaxed">
              KuraOS is open-source software licensed under the terms of the{' '}
              <span className="text-sky-400">GNU General Public License v3.0</span>.
              Built with third-party components under Apache 2.0, MIT and BSD licenses.
            </p>
          </div>
        </Card>
      </div>
    </div>
  )
}

// 17. Updates
function UpdatesPanel() {
  const [updateAvailable, setUpdateAvailable] = useState(true)
  const [updating, setUpdating]               = useState(false)
  const [progress, setProgress]               = useState(0)
  const [autoCheck, setAutoCheck]             = useState(true)

  const handleInstall = () => {
    setUpdating(true); setProgress(0)
    const iv = setInterval(() => {
      setProgress(prev => { if (prev >= 100) { clearInterval(iv); setUpdating(false); setUpdateAvailable(false); return 100 } return prev + 5 })
    }, 200)
  }

  return (
    <div className="space-y-5">
      <div><SLabel>Installed Version</SLabel><Card><Row label="KuraOS" value="v1.0.3" /><Row label="kura-daemon" value="v1.0.3 (b8ffa97)" /><Row label="Axis Engine" value="v0.4.1" /><Row label="Kernel" value="6.1.0-28-amd64" /></Card></div>
      <div>
        <SLabel>System Update</SLabel>
        {updating ? (
          <div className="p-4 rounded-xl space-y-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex justify-between text-xs text-white/50"><span>Installing update...</span><span className="tabular-nums font-mono">{progress}%</span></div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}><div className="h-full rounded-full transition-all duration-200" style={{ width: `${progress}%`, background: 'linear-gradient(90deg, #0ea5e9, #38bdf8)' }} /></div>
            <p className="text-[10px] text-white/25">Do not power off the system during the update</p>
          </div>
        ) : updateAvailable ? (
          <div className="p-4 rounded-xl flex items-start gap-3" style={{ background: 'rgba(6,182,212,0.05)', border: '1px solid rgba(6,182,212,0.15)' }}>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: 'rgba(6,182,212,0.12)', border: '1px solid rgba(6,182,212,0.2)' }}><ArrowsClockwise size={16} weight="fill" style={{ color: '#06b6d4' }} /></div>
            <div className="flex-1 min-w-0"><p className="text-sm font-bold text-white">KuraOS v1.0.4 available</p><p className="text-[11px] text-white/40 mt-1 leading-relaxed">LVM fixes, kernel patches and SSD cache support.</p></div>
            <button onClick={handleInstall} className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer mt-0.5" style={{ background: 'rgba(6,182,212,0.15)', color: '#06b6d4', border: '1px solid rgba(6,182,212,0.25)' }}>Install</button>
          </div>
        ) : (
          <div className="flex items-center gap-3 p-4 rounded-xl" style={{ background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.15)' }}>
            <CheckCircle size={16} weight="fill" style={{ color: '#10b981' }} />
            <p className="text-xs font-semibold text-emerald-400">KuraOS is fully up to date</p>
          </div>
        )}
      </div>
      <div><SLabel>Preferences</SLabel><Card><RowToggle label="Check for updates automatically" sub="Daily at 03:00" on={autoCheck} onChange={() => setAutoCheck(p => !p)} color="#06b6d4" /></Card></div>
    </div>
  )
}

// ── root ──────────────────────────────────────────────────────────────────────

export function SettingsPage() {
  const [active, setActive] = useState<Section>('appearance')
  const { title, sub } = DETAIL[active]

  const panels: Record<Section, React.ReactNode> = {
    appearance:        <AppearancePanel />,
    network:           <NetworkPanel />,
    smb:               <SmbPanel />,
    'online-accounts': <OnlineAccountsPanel />,
    power:             <PowerPanel />,
    apps:              <AppsPanel />,
    search:            <SearchPanel />,
    notifications:     <NotificationsPanel />,
    axis:              <AxisPanel />,
    users:             <UsersPanel />,
    security:          <SecurityPanel />,
    ssh:               <SshPanel />,
    region:            <RegionPanel />,
    datetime:          <DateTimePanel />,
    'remote-desktop':  <RemoteDesktopPanel />,
    about:             <AboutPanel />,
    updates:           <UpdatesPanel />,
  }

  return (
    <div className="flex h-full text-white/90">
      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <div className="w-[205px] shrink-0 flex flex-col gap-0.5 p-2 overflow-y-auto border-r" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        {NAV.map((group, gi) => (
          <div key={group.label} className={gi > 0 ? 'mt-2' : ''}>
            <p className="text-[9px] font-semibold text-white/20 uppercase tracking-widest px-3 py-1.5">{group.label}</p>
            {group.items.map(def => <NavItem key={def.id} def={def} active={active === def.id} onClick={() => setActive(def.id)} />)}
          </div>
        ))}
      </div>

      {/* ── Detail panel ────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="px-5 py-3.5 border-b shrink-0" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <p className="text-sm font-semibold text-white">{title}</p>
          <p className="text-[11px] text-white/35 mt-0.5">{sub}</p>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {panels[active]}
        </div>
      </div>
    </div>
  )
}
