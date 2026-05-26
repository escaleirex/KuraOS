import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { systemApi, settingsApi, networkApi, authApi, usersApi, UserEntry, storageApi, servicesApi, updatesApi, UpdateInfo, UpdateSettings, NotificationSettings, AppearanceSettings, PowerSettings, DatetimeSettings, SearchSettings, LocaleSettings, WifiNetwork, EthConfig, SshSettings, SshKey, RemoteDesktopSettings, RemoteDesktopStatus, OnlineAccount, AxisSettings, OllamaModel } from '@/api/client'
import QRCode from 'react-qr-code'
import {
  Gear, Users, Shield, ArrowsClockwise, Info, Bell,
  Plus, Trash, Lock, CheckCircle, Key,
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
  name: string
  path: string
  protocol: string
  description: string
  read_only: boolean
  valid_users: string[]
  force_group: string
  windows_acl: boolean
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

function Toggle({ on, onChange, color = 'var(--kura-accent)' }: { on: boolean; onChange: () => void; color?: string }) {
  return (
    <div
      onClick={onChange}
      className="relative w-10 h-5 rounded-full transition-colors cursor-pointer shrink-0"
      style={{ background: on ? color : 'var(--kura-alpha-10)' }}
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
    <div className="kura-density-pad flex justify-between items-center py-2.5 border-b border-white/[0.05] last:border-0">
      <span className="text-xs text-white/40">{label}</span>
      <span className="text-xs text-white/75 tabular-nums font-mono">{value}</span>
    </div>
  )
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`kura-density-pad rounded-xl px-4 py-1 ${className}`}
      style={{ background: 'var(--kura-surface)', border: '1px solid var(--kura-border)' }}
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
    <div className="kura-density-pad kura-density-gap py-3 flex items-center gap-3 border-b border-white/[0.05] last:border-0">
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
    <div className="absolute inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        className="absolute inset-0 bg-black/60"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        onClick={onClose}
      />
      <motion.div
        className="relative rounded-2xl p-5 w-full max-w-sm"
        style={{
          background: 'var(--kura-glass)',
          backdropFilter: 'blur(32px) saturate(1.5)',
          border: '1px solid var(--kura-glass-border)',
          boxShadow: '0 32px 80px var(--kura-shadow), 0 0 0 0.5px var(--kura-glass-border) inset',
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
      className="kura-density-pad kura-density-gap w-full text-left px-3 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-3"
      style={{ background: active ? 'var(--kura-alpha-09)' : 'transparent' }}
      onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'var(--kura-surface)' }}
      onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
    >
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-all"
        style={{
          background: active ? `${def.color}22` : 'var(--kura-surface-alt)',
          border: active ? `1px solid ${def.color}30` : '1px solid transparent',
        }}
      >
        <Icon size={13} weight="fill" style={{ color: active ? def.color : 'var(--kura-alpha-35)' }} />
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
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['settings', 'appearance'],
    queryFn: () => settingsApi.getAppearance().then(r => r.data),
  })

  const [theme, setTheme]     = useState<'dark' | 'light' | 'auto'>('dark')
  const [accent, setAccent]   = useState('#3b82f6')
  const [scale, setScale]     = useState('100')
  const [density, setDensity] = useState<'comfortable' | 'compact'>('comfortable')

  useEffect(() => {
    if (data) {
      setTheme(data.theme)
      setAccent(data.accent)
      setScale(data.scale)
      setDensity(data.density)
    }
  }, [data])

  const mut = useMutation({
    mutationFn: settingsApi.saveAppearance,
    onSettled: () => qc.invalidateQueries({ queryKey: ['settings', 'appearance'] })
  })
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  const save = (patch: Partial<AppearanceSettings>) => {
    const nextData = { theme, accent, scale, density, ...patch }
    // Optimistic update so it applies instantly across the OS
    qc.setQueryData(['settings', 'appearance'], nextData)
    
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      mut.mutate(nextData)
    }, 500)
  }

  const accents = ['#3b82f6','#8b5cf6','#ec4899','#10b981','#f59e0b','#ef4444','#06b6d4','#f97316']

  if (isLoading) return (
    <div className="space-y-5 animate-pulse">
      {[80, 60, 72].map((w, i) => (
        <div key={i} className="h-20 rounded-xl bg-white/[0.04]" style={{ width: `${w}%` }} />
      ))}
    </div>
  )

  return (
    <div className="space-y-5">
      <div>
        <SLabel>Theme</SLabel>
        <div className="grid grid-cols-3 gap-2">
          {([['dark','Dark',Moon],['light','Light',SunHorizon],['auto','Auto',Sparkle]] as const).map(([val, label, Icon]) => (
            <button
              key={val}
              onClick={() => { setTheme(val); save({ theme: val }) }}
              className="flex flex-col items-center gap-2 py-4 rounded-xl cursor-pointer transition-all"
              style={{
                background: theme === val ? 'color-mix(in srgb, var(--kura-accent) 15%, transparent)' : 'var(--kura-surface)',
                border: theme === val ? '1px solid color-mix(in srgb, var(--kura-accent) 30%, transparent)' : '1px solid var(--kura-border)',
              }}
            >
              <Icon size={20} weight="fill" style={{ color: theme === val ? 'var(--kura-accent)' : 'var(--kura-alpha-35)' }} />
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
                onClick={() => { setAccent(c); save({ accent: c }) }}
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
              <input type="color" value={accent} onChange={e => { setAccent(e.target.value); save({ accent: e.target.value }) }} className="w-5 h-5 rounded cursor-pointer bg-transparent border-0" />
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
                onChange={e => { setScale(e.target.value); save({ scale: e.target.value }) }}
                className="appearance-none w-32 h-1.5 rounded-full cursor-pointer"
                style={{ background: `linear-gradient(to right, var(--kura-accent) ${((Number(scale) - 75) / 50) * 100}%, var(--kura-alpha-10) ${((Number(scale) - 75) / 50) * 100}%)` }}
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
                  onClick={() => { setDensity(val); save({ density: val }) }}
                  className="px-2.5 py-1 rounded-lg text-[10px] font-medium cursor-pointer transition-all"
                  style={{
                    background: density === val ? 'color-mix(in srgb, var(--kura-accent) 20%, transparent)' : 'var(--kura-surface-alt)',
                    color: density === val ? 'var(--kura-accent)' : 'var(--kura-alpha-35)',
                    border: density === val ? '1px solid color-mix(in srgb, var(--kura-accent) 30%, transparent)' : '1px solid transparent',
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
function NetworkPanel() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<'wifi' | 'eth'>('wifi')
  const [expandedIface, setExpandedIface] = useState<string | null>(null)
  const [connectSsid, setConnectSsid] = useState<string | null>(null)
  const [connectPassword, setConnectPassword] = useState('')
  const [networkError, setNetworkError] = useState<string | null>(null)

  const { data: interfaces, isLoading: ifacesLoading, error: ifacesError } = useQuery({
    queryKey: ['network', 'interfaces'],
    queryFn: () => networkApi.getInterfaces().then(r => r.data),
    refetchInterval: tab === 'wifi' ? 10000 : false,
    retry: false,
  })

  const wifiToggleMut = useMutation({
    mutationFn: (enabled: boolean) => networkApi.setWifi(enabled),
    onSettled: () => qc.invalidateQueries({ queryKey: ['network', 'interfaces'] }),
    onError: (err: any) => setNetworkError(err.response?.data?.error || err.message || 'Failed to toggle Wi-Fi'),
  })

  const scanMut = useMutation({
    mutationFn: () => networkApi.scanWifi().then(r => r.data),
    onSettled: () => qc.invalidateQueries({ queryKey: ['network', 'interfaces'] }),
    onError: (err: any) => setNetworkError(err.response?.data?.error || err.message || 'Failed to scan Wi-Fi'),
  })

  const connectMut = useMutation({
    mutationFn: ({ ssid, password }: { ssid: string; password?: string }) =>
      networkApi.connectWifi(ssid, password),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['network', 'interfaces'] })
      setConnectSsid(null)
      setConnectPassword('')
    },
    onError: (err: any) => setNetworkError(err.response?.data?.error || err.message || 'Failed to connect'),
  })

  const { data: ethCfg, isLoading: ethCfgLoading } = useQuery({
    queryKey: ['network', 'eth', expandedIface],
    queryFn: () => expandedIface ? networkApi.getEthConfig(expandedIface).then(r => r.data) : null,
    enabled: !!expandedIface && tab === 'eth',
  })

  const [localEth, setLocalEth] = useState<EthConfig | null>(null)

  useEffect(() => {
    if (ethCfg) {
      setLocalEth({
        mode: ethCfg.mode,
        ip: ethCfg.ip,
        gateway: ethCfg.gateway,
        dns1: ethCfg.dns1,
        dns2: ethCfg.dns2,
      })
    }
  }, [ethCfg])

  const ethSaveMut = useMutation({
    mutationFn: ({ iface, config }: { iface: string; config: EthConfig }) =>
      networkApi.setEthConfig(iface, config),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['network', 'eth', expandedIface] })
    },
    onError: (err: any) => setNetworkError(err.response?.data?.error || err.message || 'Failed to save Ethernet config'),
  })

  const patchLocal = (patch: Partial<EthConfig>) => {
    if (!localEth) return
    setLocalEth(prev => prev ? { ...prev, ...patch } : null)
  }

  const wifiEnabled = interfaces?.wifi?.enabled ?? false
  const wifiNetworks = interfaces?.wifi?.networks ?? []
  const ethIfaces = (interfaces as any)?.eth ?? [] as EthIface[]

  function SignalBars({ pct }: { pct: number }) {
    const color = pct > 70 ? '#10b981' : pct > 40 ? '#f59e0b' : '#ef4444'
    return (
      <div className="flex items-end gap-0.5 h-3.5">
        {[25, 50, 75, 100].map(t => (
          <div key={t} className="w-1 rounded-sm" style={{ height: `${t}%`, background: pct >= t ? color : 'var(--kura-alpha-12)' }} />
        ))}
      </div>
    )
  }

  if (ifacesLoading) return (
    <div className="space-y-1.5">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-12 rounded-xl animate-pulse" style={{ background: 'var(--kura-surface)' }} />
      ))}
    </div>
  )

  if (ifacesError) return (
    <div className="flex flex-col items-center gap-3 py-10">
      <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(245,158,11,0.1)' }}>
        <Warning size={22} weight="fill" style={{ color: '#f59e0b' }} />
      </div>
      <p className="text-xs text-white/60 text-center max-w-xs">Helper service not available — network settings require kura-helper running as root.</p>
      <p className="text-[10px] text-white/25 font-mono">{(ifacesError as Error).message}</p>
    </div>
  )

  return (
    <div className="space-y-4">
      {networkError && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }}>
          <Warning size={13} weight="fill" style={{ color: '#ef4444' }} />
          <p className="text-[11px] text-red-400 flex-1">{networkError}</p>
          <button onClick={() => setNetworkError(null)} className="text-white/30 hover:text-white/60 cursor-pointer"><X size={12} /></button>
        </div>
      )}
      <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: 'var(--kura-surface-alt)' }}>
        {([['wifi','Wi-Fi'],['eth','Ethernet']] as const).map(([val, label]) => (
          <button
            key={val}
            onClick={() => setTab(val)}
            className="px-4 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all"
            style={{
              background: tab === val ? 'var(--kura-alpha-12)' : 'transparent',
              color: tab === val ? 'white' : 'var(--kura-alpha-40)',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'wifi' && (
        <>
          <Card>
            <RowToggle
              label="Wi-Fi"
              sub="Enable wireless adapter"
              on={wifiEnabled}
              onChange={() => wifiToggleMut.mutate(!wifiEnabled)}
              
            />
          </Card>
          {wifiEnabled && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <SLabel>Available Networks</SLabel>
                <button
                  onClick={() => scanMut.mutate()}
                  disabled={scanMut.isPending}
                  className="text-[10px] text-sky-400 hover:text-sky-300 cursor-pointer transition-colors disabled:opacity-50 flex items-center gap-1"
                >
                  <ArrowsClockwise size={10} className={scanMut.isPending ? 'animate-spin' : ''} />
                  {scanMut.isPending ? 'Scanning…' : 'Scan'}
                </button>
              </div>
              <div className="space-y-1.5">
                {wifiNetworks.length === 0 && (
                  <p className="text-xs text-white/25 text-center py-6">No networks found. Click Scan to search.</p>
                )}
                {wifiNetworks.map(n => (
                  <div
                    key={n.ssid}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl"
                    style={{ background: n.connected ? 'rgba(59,130,246,0.08)' : 'var(--kura-surface)', border: n.connected ? '1px solid rgba(59,130,246,0.2)' : '1px solid var(--kura-border)' }}
                  >
                    <SignalBars pct={n.signal} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-white truncate">{n.ssid}</p>
                      <p className="text-[10px] text-white/30 mt-0.5">{n.secured ? 'Secured (WPA2)' : 'Open'} · {n.signal}%</p>
                    </div>
                    {n.connected
                      ? <span className="text-[10px] font-bold text-sky-400 px-2 py-0.5 rounded-full" style={{ background: 'rgba(59,130,246,0.15)' }}>Connected</span>
                      : <button
                          onClick={() => { setConnectSsid(n.ssid); setConnectPassword('') }}
                          className="text-[10px] text-white/40 hover:text-white/70 cursor-pointer transition-colors"
                        >
                          Connect
                        </button>
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
          {ethIfaces.length === 0 && (
            <p className="text-xs text-white/25 text-center py-6">No ethernet interfaces detected.</p>
          )}
          {ethIfaces.map((iface: EthIface) => {
            const cfg = localEth
            const expanded = expandedIface === iface.name
            return (
              <div
                key={iface.name}
                className="rounded-xl overflow-hidden"
                style={{ background: 'var(--kura-surface)', border: '1px solid var(--kura-border)' }}
              >
                <button
                  className="w-full flex items-center gap-3 px-4 py-3 cursor-pointer text-left transition-colors hover:bg-white/[0.02]"
                  onClick={() => setExpandedIface(expanded ? null : iface.name)}
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: iface.status === 'up' ? 'rgba(16,185,129,0.1)' : 'var(--kura-surface-alt)' }}>
                    <Network size={14} weight="fill" style={{ color: iface.status === 'up' ? '#10b981' : 'var(--kura-alpha-20)' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-white">{iface.name}</p>
                    <p className="text-[10px] text-white/30 mt-0.5 font-mono">{cfg?.mode === 'static' ? cfg.ip || '—' : 'DHCP'} · {iface.speed}</p>
                  </div>
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase mr-2" style={iface.status === 'up' ? { background: 'rgba(16,185,129,0.12)', color: '#10b981' } : { background: 'var(--kura-alpha-07)', color: 'var(--kura-alpha-30)' }}>
                    {iface.status}
                  </span>
                  <span className="text-white/20 text-xs">{expanded ? '▲' : '▼'}</span>
                </button>

                <AnimatePresence>
                  {expanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                      className="overflow-hidden"
                    >
                      {ethCfgLoading ? (
                        <div className="px-4 pb-4 pt-2 space-y-3 animate-pulse">
                          <div className="h-6 w-32 rounded bg-white/5" />
                          <div className="h-8 w-48 rounded bg-white/5" />
                          <div className="grid grid-cols-3 gap-2">
                            <div className="h-8 rounded bg-white/5" />
                            <div className="h-8 rounded bg-white/5" />
                            <div className="h-8 rounded bg-white/5" />
                          </div>
                        </div>
                      ) : cfg && (
                        <div className="px-4 pb-4 pt-2 space-y-4 border-t border-white/[0.05]">
                          <div className="space-y-2">
                            <label className="text-[10px] text-white/35 uppercase tracking-wide">IP Mode</label>
                            <div className="flex gap-1 p-1 rounded-lg w-fit" style={{ background: 'var(--kura-surface-alt)' }}>
                              {(['dhcp','static'] as const).map(m => (
                                <button
                                  key={m}
                                  onClick={() => patchLocal({ mode: m })}
                                  className="px-4 py-1 rounded-md text-xs font-medium cursor-pointer transition-all"
                                  style={{ background: cfg.mode === m ? 'rgba(59,130,246,0.25)' : 'transparent', color: cfg.mode === m ? '#93c5fd' : 'var(--kura-alpha-40)' }}
                                >
                                  {m === 'dhcp' ? 'DHCP (Auto)' : 'Static'}
                                </button>
                              ))}
                            </div>
                          </div>

                          {cfg.mode === 'static' && (
                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <label className="text-[10px] text-white/35">IP Address (CIDR)</label>
                                <Input value={cfg.ip} onChange={v => patchLocal({ ip: v })} placeholder="192.168.1.100/24" mono />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[10px] text-white/35">Gateway</label>
                                <Input value={cfg.gateway} onChange={v => patchLocal({ gateway: v })} placeholder="192.168.1.1" mono />
                              </div>
                            </div>
                          )}

                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <label className="text-[10px] text-white/35">Primary DNS</label>
                              <Input value={cfg.dns1} onChange={v => patchLocal({ dns1: v })} placeholder="1.1.1.1" mono />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] text-white/35">Secondary DNS</label>
                              <Input value={cfg.dns2} onChange={v => patchLocal({ dns2: v })} placeholder="8.8.8.8" mono />
                            </div>
                          </div>

                          <div className="flex justify-end gap-2">
                            {ethSaveMut.isSuccess && <span className="text-[10px] text-emerald-400 self-center">Saved</span>}
                            <button
                              onClick={() => {
                                if (localEth) ethSaveMut.mutate({ iface: iface.name, config: localEth })
                              }}
                              disabled={ethSaveMut.isPending || !localEth}
                              className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer transition-colors"
                            >
                              {ethSaveMut.isPending ? 'Saving…' : 'Save'}
                            </button>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </div>
      )}

      <AnimatePresence>
        {connectSsid && (
          <Modal onClose={() => { setConnectSsid(null); setConnectPassword('') }}>
            <h3 className="font-bold text-base text-white mb-4">Connect to Wi-Fi</h3>
            <p className="text-[11px] text-white/40 mb-3">Network: <span className="text-white font-medium">{connectSsid}</span></p>
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] text-white/35 uppercase tracking-wide">Password</label>
                <Input value={connectPassword} onChange={setConnectPassword} placeholder="Enter password" type="password" />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
                <button onClick={() => { setConnectSsid(null); setConnectPassword('') }} className="px-3 py-1.5 rounded-lg hover:bg-white/5 text-white/50 text-xs font-semibold cursor-pointer">Cancel</button>
                <button
                  onClick={() => connectMut.mutate({ ssid: connectSsid, password: connectPassword || undefined })}
                  disabled={connectMut.isPending}
                  className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer transition-colors"
                >
                  {connectMut.isPending ? 'Connecting…' : 'Connect'}
                </button>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  )
}

// 3. Partilhas SMB
function SmbPanel() {
  const qc = useQueryClient()

  const { data: shares, isLoading } = useQuery({
    queryKey: ['shares'],
    queryFn: () => storageApi.listShares().then(r => r.data as SmbShare[]),
  })

  const createMut = useMutation({
    mutationFn: (body: object) => storageApi.createShare(body),
    onSettled: () => qc.invalidateQueries({ queryKey: ['shares'] }),
  })

  const updateMut = useMutation({
    mutationFn: ({ name, body }: { name: string; body: object }) => storageApi.updateShare(name, body),
    onSettled: () => qc.invalidateQueries({ queryKey: ['shares'] }),
  })

  const deleteMut = useMutation({
    mutationFn: (name: string) => storageApi.deleteShare(name),
    onSettled: () => qc.invalidateQueries({ queryKey: ['shares'] }),
  })

  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing]     = useState<string | null>(null)
  const [form, setForm]           = useState({ name: '', path: '/srv/nas/', description: '', read_only: false, guest: false, browseable: true })
  const [mutationError, setMutationError] = useState<string | null>(null)

  const openAdd  = () => { setEditing(null); setForm({ name: '', path: '/srv/nas/', description: '', read_only: false, guest: false, browseable: true }); setMutationError(null); setShowModal(true) }
  const openEdit = (s: SmbShare) => { setEditing(s.name); setForm({ name: s.name, path: s.path, description: s.description, read_only: s.read_only, guest: false, browseable: true }); setMutationError(null); setShowModal(true) }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name || !form.path) return
    setMutationError(null)
    const body = {
      name: form.name,
      path: form.path,
      protocol: 'smb' as const,
      description: form.description,
      read_only: form.read_only,
    }
    if (editing) {
      updateMut.mutate({ name: editing, body }, {
        onError: (err: any) => setMutationError(err.response?.data?.error || err.message || 'Failed to update share'),
      })
    } else {
      createMut.mutate(body, {
        onError: (err: any) => setMutationError(err.response?.data?.error || err.message || 'Failed to create share'),
      })
    }
    setShowModal(false)
  }

  if (isLoading) return (
    <div className="space-y-4">
      <div className="flex items-center justify-between"><SLabel>Active Shares</SLabel><div className="h-7 w-24 rounded-lg bg-white/[0.04] animate-pulse" /></div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-14 rounded-xl animate-pulse" style={{ background: 'var(--kura-surface)' }} />
      ))}
    </div>
  )

  return (
    <>
      <div className="space-y-4">
        {mutationError && (
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }}>
            <Warning size={13} weight="fill" style={{ color: '#ef4444' }} />
            <p className="text-[11px] text-red-400">{mutationError}</p>
            <button onClick={() => setMutationError(null)} className="ml-auto text-white/30 hover:text-white/60 cursor-pointer"><X size={12} /></button>
          </div>
        )}
        <div className="flex items-center justify-between">
          <SLabel>Active Shares</SLabel>
          <button onClick={openAdd} disabled={createMut.isPending} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600/80 hover:bg-amber-600 disabled:opacity-50 text-white font-medium text-xs transition-colors cursor-pointer mb-2">
            <Plus size={11} weight="bold" /> New Share
          </button>
        </div>
        <div className="space-y-1.5">
          {shares?.length === 0 && (
            <p className="text-xs text-white/25 text-center py-6">No shares configured. Click "New Share" to create one.</p>
          )}
          {shares?.map(s => (
            <div key={s.name} className="flex items-center gap-3 px-4 py-3 rounded-xl group" style={{ background: 'var(--kura-surface)', border: '1px solid var(--kura-border)' }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(245,158,11,0.1)' }}>
                <FolderSimple size={15} weight="fill" style={{ color: '#f59e0b' }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-white">{s.name}</span>
                  {s.read_only && <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: 'var(--kura-alpha-07)', color: 'var(--kura-alpha-35)' }}>Read-only</span>}
                </div>
                <p className="text-[10px] text-white/30 mt-0.5 font-mono truncate">{s.path}</p>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => openEdit(s)} className="p-1.5 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/5 cursor-pointer transition-colors"><Gear size={12} /></button>
                <button onClick={() => deleteMut.mutate(s.name, {
                  onError: (err: any) => setMutationError(err.response?.data?.error || err.message || 'Failed to delete share'),
                })} className="p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 cursor-pointer transition-colors"><Trash size={12} /></button>
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
                  <label className="text-[10px] text-white/35 uppercase tracking-wide">Name</label>
                  <Input value={form.name} onChange={v => setForm(p => ({ ...p, name: v }))} placeholder="Media" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-white/35 uppercase tracking-wide">Description</label>
                  <Input value={form.description} onChange={v => setForm(p => ({ ...p, description: v }))} placeholder="Description" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-white/35 uppercase tracking-wide">Path</label>
                <Input value={form.path} onChange={v => setForm(p => ({ ...p, path: v }))} mono />
              </div>
              <div className="space-y-2 pt-1">
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-xs text-white/60">Read-only</span>
                  <Toggle on={form.read_only} onChange={() => setForm(p => ({ ...p, read_only: !p.read_only }))} color="#f59e0b" />
                </label>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-white/5">
                <button type="button" onClick={() => setShowModal(false)} className="px-3 py-1.5 rounded-lg hover:bg-white/5 text-white/50 text-xs font-semibold cursor-pointer">Cancel</button>
                <button type="submit" disabled={createMut.isPending || updateMut.isPending || !form.name || !form.path} className="px-3 py-1.5 rounded-lg bg-amber-600/80 hover:bg-amber-600 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer">
                  {(createMut.isPending || updateMut.isPending) ? 'Saving…' : 'Save'}
                </button>
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
  const qc = useQueryClient()

  const { data: accounts, isLoading } = useQuery({
    queryKey: ['settings', 'accounts'],
    queryFn: () => settingsApi.getAccounts().then(r => r.data),
  })

  const connectMut = useMutation({
    mutationFn: (provider: string) => settingsApi.connectAccount(provider),
    onSettled: () => qc.invalidateQueries({ queryKey: ['settings', 'accounts'] }),
  })

  const disconnectMut = useMutation({
    mutationFn: (provider: string) => settingsApi.disconnectAccount(provider),
    onSettled: () => qc.invalidateQueries({ queryKey: ['settings', 'accounts'] }),
  })

  const meta: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    google:    { label: 'Google Drive',  color: '#ea4335', icon: <GoogleLogo size={16} weight="fill" /> },
    s3:        { label: 'Amazon S3',     color: '#f59e0b', icon: <Cloud size={16} weight="fill" /> },
    dropbox:   { label: 'Dropbox',       color: '#0061ff', icon: <DropboxLogo size={16} weight="fill" /> },
    backblaze: { label: 'Backblaze B2',  color: '#ef4444', icon: <HardDrive size={16} weight="fill" /> },
  }

  const handleToggle = (a: OnlineAccount) => {
    if (a.connected) disconnectMut.mutate(a.provider)
    else connectMut.mutate(a.provider)
  }

  const isPending = (provider: string) =>
    connectMut.isPending && connectMut.variables === provider ||
    disconnectMut.isPending && disconnectMut.variables === provider

  if (isLoading) return (
    <div className="space-y-1.5">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-14 rounded-xl animate-pulse" style={{ background: 'var(--kura-surface)' }} />
      ))}
    </div>
  )

  return (
    <div className="space-y-4">
      <SLabel>External Backup Accounts</SLabel>
      <div className="space-y-1.5">
        {accounts?.map(a => {
          const m = meta[a.provider]
          if (!m) return null
          const pending = isPending(a.provider)
          return (
            <div key={a.id} className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: 'var(--kura-surface)', border: '1px solid var(--kura-border)' }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${m.color}15`, border: `1px solid ${m.color}25`, color: m.color }}>{m.icon}</div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-white">{m.label}</p>
                <p className="text-[10px] text-white/30 mt-0.5 truncate">{a.connected ? `${a.name}${a.purpose ? ` · ${a.purpose}` : ''}` : 'Not connected'}</p>
              </div>
              <button
                onClick={() => handleToggle(a)}
                disabled={pending}
                className="shrink-0 px-3 py-1.5 rounded-lg text-[10px] font-semibold cursor-pointer transition-all disabled:opacity-50"
                style={a.connected ? { background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' } : { background: 'var(--kura-alpha-07)', color: 'var(--kura-alpha-50)', border: '1px solid var(--kura-alpha-10)' }}
              >
                {pending ? '...' : a.connected ? 'Disconnect' : 'Connect'}
              </button>
            </div>
          )
        })}
      </div>
      <div className="px-4 py-3 rounded-xl text-[11px] text-white/35 leading-relaxed" style={{ background: 'var(--kura-alpha-03)', border: '1px solid var(--kura-surface-alt)' }}>
        Backup tasks are configured in the Storage app. Here you only manage access credentials for external accounts.
      </div>
    </div>
  )
}

// 5. Power (no suspend — it's a server)
function PowerPanel() {
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['settings', 'power'],
    queryFn: () => settingsApi.getPower().then(r => r.data),
  })

  const [profile, setProfile]   = useState<'performance' | 'balanced' | 'saver'>('balanced')
  const [wol, setWol]           = useState(true)
  const [spindown, setSpindown] = useState('30')

  useEffect(() => {
    if (data) {
      setProfile(data.profile)
      setWol(data.wol)
      setSpindown(data.spindown)
    }
  }, [data])

  const mutation = useMutation({
    mutationFn: (next: PowerSettings) => settingsApi.savePower(next).then(r => r.data),
    onMutate: async (next) => {
      await qc.cancelQueries({ queryKey: ['settings', 'power'] })
      const prev = qc.getQueryData<PowerSettings>(['settings', 'power'])
      qc.setQueryData(['settings', 'power'], next)
      return { prev }
    },
    onError: (_err, _next, ctx) => {
      if (ctx?.prev) qc.setQueryData(['settings', 'power'], ctx.prev)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['settings', 'power'] }),
  })

  const saveProfile = (p: 'performance' | 'balanced' | 'saver') => {
    setProfile(p)
    mutation.mutate({ profile: p, spindown, wol })
  }

  const saveSpindown = (s: string) => {
    setSpindown(s)
    mutation.mutate({ profile, spindown: s as PowerSettings['spindown'], wol })
  }

  const toggleWol = () => {
    const next = !wol
    setWol(next)
    mutation.mutate({ profile, spindown, wol: next })
  }

  const profiles = [
    { id: 'performance', label: 'Performance',  sub: 'No CPU frequency limit, fans at maximum', icon: Lightning, color: '#ef4444' },
    { id: 'balanced',    label: 'Balanced',      sub: 'Balances speed and power consumption',   icon: Wind,      color: '#3b82f6' },
    { id: 'saver',       label: 'Power Saver',   sub: 'Low frequency, quiet fans',              icon: Leaf,      color: '#10b981' },
  ] as const

  if (isLoading) return (
    <div className="space-y-5 animate-pulse">
      {[80, 60, 72].map((w, i) => (
        <div key={i} className="h-20 rounded-xl bg-white/[0.04]" style={{ width: `${w}%` }} />
      ))}
    </div>
  )

  return (
    <div className="space-y-5">
      <div>
        <SLabel>Power Profile</SLabel>
        <div className="space-y-1.5">
          {profiles.map(p => {
            const Icon = p.icon
            const active = profile === p.id
            return (
              <button key={p.id} onClick={() => saveProfile(p.id)} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all text-left" style={{ background: active ? `${p.color}0d` : 'var(--kura-surface)', border: active ? `1px solid ${p.color}30` : '1px solid var(--kura-border)' }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${p.color}15` }}>
                  <Icon size={15} weight="fill" style={{ color: p.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-semibold ${active ? 'text-white' : 'text-white/60'}`}>{p.label}</p>
                  <p className="text-[10px] text-white/30 mt-0.5">{p.sub}</p>
                </div>
                <div className="w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center" style={{ borderColor: active ? p.color : 'var(--kura-alpha-20)' }}>
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
            <HardDrive size={13} style={{ color: 'var(--kura-alpha-30)' }} />
            <span className="text-xs text-white flex-1">Spindown after inactivity</span>
            <select value={spindown} onChange={e => saveSpindown(e.target.value)} className="bg-slate-800 border border-white/10 rounded-lg px-2 py-1 text-xs text-white">
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
        <Card><RowToggle label="Wake-on-LAN" sub="Power on remotely via Ethernet magic packet" on={wol} onChange={toggleWol} color="#10b981" /></Card>
      </div>
    </div>
  )
}

// 6. Apps & Services — service manager
interface ServiceEntry {
  id: string
  unit: string
  label: string
  sub: string
  active: boolean
  enabled: boolean
}

const criticalServices = new Set(['samba', 'nmb', 'ssh', 'docker', 'kura'])

function AppsPanel() {
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['services'],
    queryFn: () => servicesApi.list().then(r => r.data),
  })

  const services = (data?.services as ServiceEntry[]) ?? []
  const helperAvailable = data?.helper_available as boolean | undefined

  const startMut = useMutation({
    mutationFn: (id: string) => servicesApi.start(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['services'] }),
  })
  const stopMut = useMutation({
    mutationFn: (id: string) => servicesApi.stop(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['services'] }),
  })
  const enableMut = useMutation({
    mutationFn: (id: string) => servicesApi.enable(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['services'] }),
  })
  const disableMut = useMutation({
    mutationFn: (id: string) => servicesApi.disable(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['services'] }),
  })

  if (isLoading) return (
    <div className="space-y-2 animate-pulse">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="h-20 rounded-xl bg-white/[0.04]" />
      ))}
    </div>
  )

  return (
    <div className="space-y-4">
      {helperAvailable === false && (
        <div className="flex flex-col items-center gap-3 py-6 px-4 rounded-xl" style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(245,158,11,0.1)' }}>
            <Warning size={18} weight="fill" style={{ color: '#f59e0b' }} />
          </div>
          <p className="text-xs text-white/60 text-center">Service management requires kura-helper running as root. Services are listed below but cannot be controlled.</p>
        </div>
      )}
      <SLabel>Services & Applications</SLabel>
      <div className="space-y-2">
        {services.map(s => (
          <div
            key={s.id}
            className="rounded-xl overflow-hidden"
            style={{ background: 'var(--kura-surface)', border: '1px solid var(--kura-border)' }}
          >
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="w-2 h-2 rounded-full shrink-0" style={{ background: s.active ? '#10b981' : 'var(--kura-alpha-15)' }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-white">{s.label}</span>
                  {criticalServices.has(s.id) && <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>Critical</span>}
                </div>
                <p className="text-[10px] text-white/30 mt-0.5">{s.sub}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => s.active ? stopMut.mutate(s.id) : startMut.mutate(s.id)}
                  disabled={startMut.isPending || stopMut.isPending || helperAvailable === false}
                  className="p-1.5 rounded-lg cursor-pointer transition-colors disabled:opacity-40"
                  title={s.active ? 'Stop' : 'Start'}
                  style={{ background: s.active ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)', color: s.active ? '#ef4444' : '#10b981' }}
                >
                  {s.active ? <Stop size={12} weight="fill" /> : <Play size={12} weight="fill" />}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-6 px-4 py-2 border-t border-white/[0.04]">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <Toggle
                  on={s.enabled}
                  onChange={() => s.enabled ? disableMut.mutate(s.id) : enableMut.mutate(s.id)}
                  
                />
                <span className="text-[10px] text-white/35">Start on startup</span>
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
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['settings', 'search'],
    queryFn: () => settingsApi.getSearch().then(r => r.data),
  })

  const mutation = useMutation({
    mutationFn: (next: SearchSettings) => settingsApi.saveSearch(next).then(r => r.data),
    onMutate: async (next) => {
      await qc.cancelQueries({ queryKey: ['settings', 'search'] })
      const prev = qc.getQueryData<SearchSettings>(['settings', 'search'])
      qc.setQueryData(['settings', 'search'], next)
      return { prev }
    },
    onError: (_err, _next, ctx) => {
      if (ctx?.prev) qc.setQueryData(['settings', 'search'], ctx.prev)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['settings', 'search'] }),
  })

  const defaults: SearchSettings = {
    aiSearch: true,
    axisModel: 'groq/llama-3.3-70b',
    scopeContent: false,
    indexedPaths: ['/srv/nas/media', '/srv/nas/public'],
    schedule: 'daily',
  }

  const s = data ?? defaults

  const indexedPaths = [
    { path: '/srv/nas/media',   label: 'Media',   enabled: s.indexedPaths.includes('/srv/nas/media') },
    { path: '/srv/nas/backup',  label: 'Backup',  enabled: s.indexedPaths.includes('/srv/nas/backup') },
    { path: '/srv/nas/public',  label: 'Public',  enabled: s.indexedPaths.includes('/srv/nas/public') },
    { path: 'Docker Volumes',   label: 'Docker',  enabled: s.indexedPaths.includes('Docker Volumes') },
  ]

  const togglePath = (path: string) => {
    const next = s.indexedPaths.includes(path)
      ? s.indexedPaths.filter(p => p !== path)
      : [...s.indexedPaths, path]
    mutation.mutate({ ...s, indexedPaths: next })
  }

  if (isLoading) return <div className="space-y-1.5">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-12 rounded-xl animate-pulse" style={{ background: 'var(--kura-surface)' }} />)}</div>

  return (
    <div className="space-y-5">
      <div>
        <SLabel>AI Search</SLabel>
        <Card>
          <RowToggle label="AI-Assisted File Search" sub="Uses Axis to find files by content, context or natural language" on={s.aiSearch} onChange={() => mutation.mutate({ ...s, aiSearch: !s.aiSearch })} color="#f97316" />
          {s.aiSearch && (
            <>
              <div className="py-3 border-t border-white/[0.05] flex items-center gap-3">
                <span className="text-xs text-white flex-1">AI Model</span>
                <select value={s.axisModel} onChange={e => mutation.mutate({ ...s, axisModel: e.target.value })} className="bg-slate-800 border border-white/10 rounded-lg px-2 py-1 text-xs text-white max-w-[200px]">
                  <optgroup label="Groq (Cloud)"><option value="groq/llama-3.3-70b">Llama 3.3 70B</option><option value="groq/mixtral-8x7b">Mixtral 8x7B</option></optgroup>
                  <optgroup label="Local (Ollama)"><option value="ollama/llama3.2">Llama 3.2 (Local)</option><option value="ollama/mistral">Mistral 7B (Local)</option></optgroup>
                </select>
              </div>
            </>
          )}
        </Card>
      </div>

      <div>
        <SLabel>Search Scope</SLabel>
        <Card>
          <RowToggle label="Index file content" sub="Text, PDFs and documents — content search (slower)" on={s.scopeContent} onChange={() => mutation.mutate({ ...s, scopeContent: !s.scopeContent })} color="#f97316" />
        </Card>
      </div>

      <div>
        <SLabel>Indexed Locations</SLabel>
        <div className="space-y-1.5">
          {indexedPaths.map((p) => (
            <div key={p.path} className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: 'var(--kura-surface)', border: '1px solid var(--kura-border)' }}>
              <FolderSimple size={13} weight="fill" style={{ color: p.enabled ? '#f97316' : 'var(--kura-alpha-20)' }} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-white">{p.label}</p>
                <p className="text-[10px] text-white/30 mt-0.5 font-mono">{p.path}</p>
              </div>
              <Toggle on={p.enabled} onChange={() => togglePath(p.path)} color="#f97316" />
            </div>
          ))}
        </div>
      </div>

      <div>
        <SLabel>Indexing Schedule</SLabel>
        <Card>
          <div className="py-3 flex items-center gap-3">
            <span className="text-xs text-white flex-1">Frequency</span>
            <select value={s.schedule} onChange={e => mutation.mutate({ ...s, schedule: e.target.value })} className="bg-slate-800 border border-white/10 rounded-lg px-2 py-1 text-xs text-white">
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
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['settings', 'notifications'],
    queryFn: () => settingsApi.getNotifications().then(r => r.data),
  })

  const mutation = useMutation({
    mutationFn: (next: NotificationSettings) => settingsApi.saveNotifications(next).then(r => r.data),
    onMutate: async (next) => {
      await qc.cancelQueries({ queryKey: ['settings', 'notifications'] })
      const prev = qc.getQueryData<NotificationSettings>(['settings', 'notifications'])
      qc.setQueryData(['settings', 'notifications'], next)
      return { prev }
    },
    onError: (_err, _next, ctx) => {
      if (ctx?.prev) qc.setQueryData(['settings', 'notifications'], ctx.prev)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['settings', 'notifications'] }),
  })

  const alerts = data ?? { diskFull: true, raidDegraded: true, backupFail: true, updateAvail: true, loginFail: false, tempCrit: true, dockerDown: false }
  type K = keyof NotificationSettings

  const toggle = (key: K) => mutation.mutate({ ...alerts, [key]: !alerts[key] })

  const [notifPerm, setNotifPerm] = useState<NotificationPermission | 'unsupported'>('default')

  useEffect(() => {
    if (!('Notification' in window)) {
      setNotifPerm('unsupported')
    } else {
      setNotifPerm(Notification.permission)
    }
  }, [])

  const requestNotifPerm = async () => {
    if (!('Notification' in window)) return
    const perm = await Notification.requestPermission()
    setNotifPerm(perm)
  }

  const items: { key: K; label: string; sub: string; color: string }[] = [
    { key: 'diskFull',     label: 'Disk Almost Full',         sub: 'Storage usage > 90%',                 color: '#f97316' },
    { key: 'raidDegraded', label: 'RAID Degraded',            sub: 'Disk failure or removal from array',  color: '#ef4444' },
    { key: 'backupFail',   label: 'Backup Failure',           sub: 'External backup did not complete',    color: '#ef4444' },
    { key: 'updateAvail',  label: 'Updates Available',        sub: 'New security patches',                color: '#06b6d4' },
    { key: 'loginFail',    label: 'Authentication Failure',   sub: 'Multiple failed login attempts',      color: '#f59e0b' },
    { key: 'tempCrit',     label: 'Critical Temperature',     sub: 'Hardware above safe threshold',       color: '#ef4444' },
    { key: 'dockerDown',   label: 'Docker Container Stopped', sub: 'Service went down unexpectedly',      color: '#8b5cf6' },
  ]

  if (isLoading) return <div className="space-y-1.5">{Array.from({ length: 7 }).map((_, i) => <div key={i} className="h-12 rounded-xl animate-pulse" style={{ background: 'var(--kura-surface)' }} />)}</div>

  return (
    <div className="space-y-4">
      <SLabel>Browser Notifications</SLabel>
      <Card>
        <div className="py-3 flex items-center gap-3">
          <Bell size={13} style={{ color: 'rgba(234,179,8,0.7)' }} />
          <span className="text-xs text-white flex-1">Desktop Notifications</span>
          {notifPerm === 'unsupported' ? (
            <span className="text-[10px] text-white/30">Not supported</span>
          ) : notifPerm === 'granted' ? (
            <span className="text-[10px] text-emerald-400 flex items-center gap-1"><CheckCircle size={10} weight="fill" />Enabled</span>
          ) : notifPerm === 'denied' ? (
            <span className="text-[10px] text-red-400">Blocked by browser</span>
          ) : (
            <button onClick={requestNotifPerm} className="px-2.5 py-1 rounded-lg text-[10px] font-semibold cursor-pointer transition-colors" style={{ background: 'rgba(234,179,8,0.12)', color: '#eab308', border: '1px solid rgba(234,179,8,0.2)' }}>
              Enable
            </button>
          )}
        </div>
      </Card>

      <SLabel>System Alerts</SLabel>
      <div className="space-y-1.5">
        {items.map(({ key, label, sub, color }) => (
          <div key={key} className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: 'var(--kura-surface)', border: '1px solid var(--kura-border)' }}>
            <div className="w-2 h-2 rounded-full shrink-0" style={{ background: alerts[key] ? color : 'var(--kura-alpha-15)' }} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-white">{label}</p>
              <p className="text-[10px] text-white/30 mt-0.5">{sub}</p>
            </div>
            <Toggle on={alerts[key]} onChange={() => toggle(key)} color={color} />
          </div>
        ))}
      </div>
    </div>
  )
}

// 9. Axis AI settings
function AxisPanel() {
  const qc = useQueryClient()

  const { data: axisConfig } = useQuery({
    queryKey: ['settings', 'axis'],
    queryFn: () => settingsApi.getAxis().then(r => r.data),
  })

  const { data: modelsData } = useQuery({
    queryKey: ['settings', 'axis', 'models'],
    queryFn: () => settingsApi.listAxisModels().then(r => r.data),
  })

  const [mode, setMode]             = useState<'auto' | 'local' | 'cloud'>('auto')
  const [ollamaUrl, setOllamaUrl]   = useState('http://localhost:11434')
  const [localModel, setLocalModel] = useState('qwen3:8b')
  const [preferred, setPreferred]   = useState<'groq' | 'openai' | 'anthropic' | 'openrouter' | 'nvidia' | 'custom'>('groq')
  const [keys, setKeys]             = useState<Record<string, string>>({ groq: '', openai: '', anthropic: '', openrouter: '', nvidia: '', custom: '' })
  const [visible, setVisible]       = useState({ groq: false, openai: false, anthropic: false, openrouter: false, nvidia: false, custom: false })
  const [customUrl, setCustomUrl]   = useState('')
  const [providerModels, setProviderModels] = useState<Record<string, string>>({ groq: '', openai: '', anthropic: '', openrouter: '', nvidia: '', custom: '' })
  const [saved, setSaved]           = useState(false)

  const ollamaModels: string[] = modelsData?.models?.map((m: OllamaModel) => m.name) ?? []

  const providerOptions = [
    { id: 'groq',       label: 'Groq',       placeholder: 'gsk_••••••••••••••••••••••••••••••' },
    { id: 'openai',     label: 'OpenAI',     placeholder: 'sk-proj-••••••••••••••••••••••••••••••••' },
    { id: 'anthropic',  label: 'Anthropic',  placeholder: 'sk-ant-••••••••••••••••••••••••••••••••' },
    { id: 'openrouter', label: 'OpenRouter', placeholder: 'sk-or-••••••••••••••••••••••••••••••••' },
    { id: 'nvidia',     label: 'NVIDIA NIM', placeholder: 'nvapi-••••••••••••••••••••••••••••••' },
    { id: 'custom',     label: 'Custom',     placeholder: '••••••••••••••••••••••••••••••••' },
  ]

  const isMasked = (key: string) => key.includes('•')

  // Sync state from fetched config — only update display, don't overwrite real keys with masked ones
  useEffect(() => {
    if (!axisConfig) return
    setMode(axisConfig.mode as typeof mode)
    setOllamaUrl(axisConfig.ollamaUrl)
    setLocalModel(axisConfig.localModel)
    setPreferred(axisConfig.preferred as typeof preferred)
    setCustomUrl(axisConfig.customUrl ?? '')
    setProviderModels(axisConfig.providerModels ?? { groq: '', openai: '', anthropic: '', openrouter: '', nvidia: '', custom: '' })

    setKeys(prev => {
      const next = { ...prev }
      for (const p of providerOptions) {
        const incoming = axisConfig.apiKeys?.[p.id] ?? ''
        if (incoming && !isMasked(incoming)) {
          next[p.id] = incoming
        } else if (!prev[p.id]) {
          next[p.id] = ''
        }
      }
      return next
    })
  }, [axisConfig])

  const saveMutation = useMutation({
    mutationFn: (data: AxisSettings) => settingsApi.saveAxis(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings', 'axis'] })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    },
  })

  const handleSave = () => {
    const apiKeysToSend: Record<string, string> = {}
    for (const p of providerOptions) {
      const val = keys[p.id] ?? ''
      if (val && !isMasked(val)) {
        apiKeysToSend[p.id] = val
      }
    }

    saveMutation.mutate({
      mode,
      ollamaUrl,
      localModel,
      preferred,
      apiKeys: apiKeysToSend,
      customUrl,
      providerModels,
    })
  }

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
              style={{ background: mode === val ? 'rgba(167,139,250,0.1)' : 'var(--kura-surface)', border: mode === val ? '1px solid rgba(167,139,250,0.3)' : '1px solid var(--kura-border)' }}
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
                {ollamaModels.length > 0
                  ? ollamaModels.map(m => <option key={m} value={m}>{m}</option>)
                  : (
                    <>
                      <option value="qwen3:8b">qwen3:8b (recommended)</option>
                      <option value="llama3.2:3b">llama3.2:3b (lightweight)</option>
                      <option value="llama3.2:8b">llama3.2:8b</option>
                      <option value="mistral:7b">mistral:7b</option>
                      <option value="phi3:mini">phi3:mini (very lightweight)</option>
                      <option value="gemma2:9b">gemma2:9b</option>
                      <option value="deepseek-r1:8b">deepseek-r1:8b</option>
                    </>
                  )
                }
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
                <option value="nvidia">NVIDIA NIM</option>
                <option value="custom">Custom</option>
              </select>
            </div>
          </div>
          <div className="space-y-2">
            {providerOptions.map(p => (
              <div key={p.id} className="rounded-xl px-4 py-3 space-y-2" style={{ background: 'var(--kura-surface)', border: '1px solid var(--kura-border)' }}>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-white">{p.label}</span>
                  {preferred === p.id && <span className="text-[9px] px-1.5 py-0.5 rounded font-bold" style={{ background: 'rgba(167,139,250,0.15)', color: '#a78bfa' }}>Default</span>}
                </div>
                {p.id === 'custom' && (
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-white/30">API Endpoint URL</label>
                    <Input value={customUrl} onChange={setCustomUrl} mono placeholder="https://api.example.com/v1" />
                  </div>
                )}
                <div className="space-y-1.5">
                  <label className="text-[10px] text-white/30">API Key</label>
                  <div className="flex gap-2">
                    <input
                      type={visible[p.id as keyof typeof visible] ? 'text' : 'password'}
                      value={keys[p.id] ?? ''}
                      onChange={e => setKeys(prev => ({ ...prev, [p.id]: e.target.value }))}
                      placeholder={p.placeholder}
                      className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-purple-500/50"
                    />
                    <button onClick={() => setVisible(prev => ({ ...prev, [p.id]: !prev[p.id as keyof typeof visible] }))} className="p-2 rounded-lg text-white/30 hover:text-white/60 transition-colors cursor-pointer shrink-0" style={{ background: 'var(--kura-surface-alt)' }}>
                      {visible[p.id as keyof typeof visible] ? <EyeSlash size={13} /> : <Eye size={13} />}
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-white/30 flex-1">Default model</span>
                  <input
                    type="text"
                    value={providerModels[p.id] ?? ''}
                    onChange={e => setProviderModels(prev => ({ ...prev, [p.id]: e.target.value }))}
                    placeholder={p.id === 'groq' ? 'llama-3.3-70b' : p.id === 'openai' ? 'gpt-4o' : p.id === 'anthropic' ? 'claude-sonnet-4-20250514' : p.id === 'openrouter' ? 'meta-llama/llama-3.3-70b-instruct' : p.id === 'nvidia' ? 'meta/llama-3.1-405b-instruct' : 'model-id'}
                    className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-purple-500/50"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-end gap-3 pt-1">
        {saved && <span className="text-xs text-emerald-400 flex items-center gap-1.5"><CheckCircle size={13} weight="fill" />Configuration saved</span>}
        <button
          onClick={handleSave}
          disabled={saveMutation.isPending}
          className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-semibold text-xs cursor-pointer transition-colors"
        >
          {saveMutation.isPending ? 'Saving…' : 'Save Configuration'}
        </button>
      </div>
    </div>
  )
}

// 10. Users
function UsersPanel() {
  const qc = useQueryClient()

  const { data: users, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.list().then(r => r.data),
  })

  const [showModal, setShowModal]   = useState(false)
  const [newName, setNewName]       = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newConfirm, setNewConfirm] = useState('')
  const [newRole, setNewRole]       = useState<'admin' | 'user'>('user')
  const [newSamba, setNewSamba]     = useState(true)
  const [showPwd, setShowPwd]       = useState(false)
  const [showPwdModal, setShowPwdModal] = useState(false)
  const [pwdModalUser, setPwdModalUser] = useState('')
  const [pwdModalValue, setPwdModalValue] = useState('')
  const [pwdModalConfirm, setPwdModalConfirm] = useState('')
  const [showPwdModalNew, setShowPwdModalNew] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const closeModal = () => { setShowModal(false); setNewName(''); setNewPassword(''); setNewConfirm(''); setShowPwd(false) }

  const createMut = useMutation({
    mutationFn: (data: { username: string; password: string; role: 'admin' | 'user'; samba: boolean }) =>
      usersApi.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); closeModal() },
  })

  const deleteMut = useMutation({
    mutationFn: (username: string) => usersApi.delete(username),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); setDeleteConfirm(null) },
  })

  const sambaMut = useMutation({
    mutationFn: ({ username, samba, password }: { username: string; samba: boolean; password?: string }) =>
      usersApi.setSamba(username, samba, password),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  })

  const roleMut = useMutation({
    mutationFn: ({ username, role }: { username: string; role: 'admin' | 'user' }) =>
      usersApi.setRole(username, role),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  })

  const pwdMut = useMutation({
    mutationFn: ({ username, password }: { username: string; password: string }) =>
      usersApi.setPassword(username, password),
    onSuccess: () => { setPwdModalUser(''); setPwdModalValue(''); setPwdModalConfirm('') },
  })

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword !== newConfirm) return
    createMut.mutate({ username: newName, password: newPassword, role: newRole, samba: newSamba })
  }

  const handleDelete = (username: string) => {
    if (username === 'admin') return
    deleteMut.mutate(username)
  }

  const handleSamba = (user: UserEntry) => {
    if (user.samba) {
      sambaMut.mutate({ username: user.username, samba: false })
    } else {
      sambaMut.mutate({ username: user.username, samba: true, password: undefined })
    }
  }

  const handleRole = (username: string, role: 'admin' | 'user') => {
    roleMut.mutate({ username, role })
  }

  const handleSetPassword = (e: React.FormEvent) => {
    e.preventDefault()
    if (pwdModalValue !== pwdModalConfirm || pwdModalValue.length < 8) return
    pwdMut.mutate({ username: pwdModalUser, password: pwdModalValue })
  }

  const pwdMismatch = newConfirm.length > 0 && newPassword !== newConfirm
  const pwdModalMismatch = pwdModalConfirm.length > 0 && pwdModalValue !== pwdModalConfirm

  if (isLoading) return (
    <div className="space-y-1.5">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-14 rounded-xl animate-pulse" style={{ background: 'var(--kura-surface)' }} />
      ))}
    </div>
  )

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
          {users?.map(user => (
            <div key={user.username} className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: 'var(--kura-surface)', border: '1px solid var(--kura-border)' }}>
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0" style={{ background: user.role === 'admin' ? 'rgba(139,92,246,0.15)' : 'var(--kura-alpha-08)', color: user.role === 'admin' ? '#8b5cf6' : 'var(--kura-alpha-50)' }}>
                {user.username[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-white">{user.username}</span>
                  <select
                    value={user.role}
                    onChange={e => handleRole(user.username, e.target.value as 'admin' | 'user')}
                    disabled={user.username === 'admin'}
                    className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase bg-transparent border-0 cursor-pointer"
                    style={user.role === 'admin' ? { background: 'rgba(139,92,246,0.12)', color: '#8b5cf6', border: '1px solid rgba(139,92,246,0.2)' } : { background: 'var(--kura-alpha-07)', color: 'var(--kura-alpha-40)' }}
                  >
                    <option value="admin">admin</option>
                    <option value="user">user</option>
                  </select>
                </div>
                <p className="text-[10px] text-white/25 mt-0.5">Login: {user.lastLogin}</p>
              </div>
              <label className="flex items-center gap-2 cursor-pointer select-none shrink-0">
                <span className="text-[10px] text-white/30">Samba</span>
                <Toggle on={user.samba} onChange={() => handleSamba(user)} color="#10b981" />
              </label>
              <button
                onClick={() => { setPwdModalUser(user.username); setPwdModalValue(''); setPwdModalConfirm(''); setShowPwdModal(true) }}
                className="shrink-0 p-1.5 rounded-lg text-white/20 hover:text-sky-400 hover:bg-sky-500/10 transition-colors cursor-pointer"
                title="Change password"
              >
                <Lock size={13} />
              </button>
              {user.username !== 'admin' && (
                <button onClick={() => setDeleteConfirm(user.username)} className="shrink-0 p-1.5 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer">
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
                <label className="text-[10px] text-white/35 uppercase tracking-wide">Password</label>
                <div className="flex gap-2">
                  <Input value={newPassword} onChange={setNewPassword} placeholder="••••••••" type={showPwd ? 'text' : 'password'} />
                  <button type="button" onClick={() => setShowPwd(p => !p)} className="p-2 rounded-lg text-white/30 hover:text-white/60 cursor-pointer shrink-0" style={{ background: 'var(--kura-surface-alt)' }}>
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
                <button type="submit" disabled={pwdMismatch || !newName || !newPassword || newPassword.length < 8 || createMut.isPending} className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold cursor-pointer">
                  {createMut.isPending ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          </Modal>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deleteConfirm && (
          <Modal onClose={() => setDeleteConfirm(null)}>
            <h3 className="font-bold text-base text-white mb-2">Delete Account</h3>
            <p className="text-xs text-white/50 mb-4">Are you sure you want to delete <span className="text-white font-semibold">{deleteConfirm}</span>? This will remove their home directory and all data.</p>
            <div className="flex justify-end gap-2 pt-3 border-t border-white/5">
              <button onClick={() => setDeleteConfirm(null)} className="px-3 py-1.5 rounded-lg hover:bg-white/5 text-white/50 text-xs font-semibold cursor-pointer">Cancel</button>
              <button onClick={() => handleDelete(deleteConfirm)} disabled={deleteMut.isPending} className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white text-xs font-semibold cursor-pointer">
                {deleteMut.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showPwdModal && (
          <Modal onClose={() => { setShowPwdModal(false); setPwdModalUser('') }}>
            <h3 className="font-bold text-base text-white mb-4">Change Password</h3>
            <p className="text-[10px] text-white/30 mb-3">User: <span className="text-white font-semibold">{pwdModalUser}</span></p>
            <form onSubmit={handleSetPassword} className="space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] text-white/35 uppercase tracking-wide">New Password</label>
                <div className="flex gap-2">
                  <Input value={pwdModalValue} onChange={setPwdModalValue} placeholder="••••••••" type={showPwdModalNew ? 'text' : 'password'} />
                  <button type="button" onClick={() => setShowPwdModalNew(p => !p)} className="p-2 rounded-lg text-white/30 hover:text-white/60 cursor-pointer shrink-0" style={{ background: 'var(--kura-surface-alt)' }}>
                    {showPwdModalNew ? <EyeSlash size={13} /> : <Eye size={13} />}
                  </button>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-white/35 uppercase tracking-wide">Confirm Password</label>
                <Input value={pwdModalConfirm} onChange={setPwdModalConfirm} placeholder="••••••••" type={showPwdModalNew ? 'text' : 'password'} className={pwdModalMismatch ? 'border-red-500/50' : ''} />
                {pwdModalMismatch && <p className="text-[10px] text-red-400">Passwords do not match</p>}
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-white/5">
                <button type="button" onClick={() => { setShowPwdModal(false); setPwdModalUser('') }} className="px-3 py-1.5 rounded-lg hover:bg-white/5 text-white/50 text-xs font-semibold cursor-pointer">Cancel</button>
                <button type="submit" disabled={pwdModalMismatch || !pwdModalValue || pwdModalValue.length < 8 || pwdMut.isPending} className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold cursor-pointer">
                  {pwdMut.isPending ? 'Saving...' : 'Update Password'}
                </button>
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
  const qc = useQueryClient()
  const [showSetupModal, setShowSetupModal]       = useState(false)
  const [showDisableModal, setShowDisableModal]   = useState(false)
  const [verifyCode, setVerifyCode]               = useState('')
  const [disableCode, setDisableCode]             = useState('')
  const [setupData, setSetupData]                 = useState<{ secret: string; otpauth_url: string } | null>(null)
  const [error, setError]                         = useState<string | null>(null)

  const { data: totpData, isLoading: statusLoading } = useQuery({
    queryKey: ['auth', 'totp-status'],
    queryFn: () => authApi.totpStatus().then(r => r.data),
  })

  const twoFaEnabled = totpData?.enabled ?? false

  const setupMut = useMutation({
    mutationFn: () => authApi.setupTOTP().then(r => r.data),
    onSuccess: (data) => {
      setSetupData(data)
      setShowSetupModal(true)
      setError(null)
    },
    onError: () => setError('Failed to generate 2FA setup. Try again.'),
  })

  const enableMut = useMutation({
    mutationFn: (code: string) => authApi.enableTOTP(code).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['auth', 'totp-status'] })
      setShowSetupModal(false)
      setSetupData(null)
      setVerifyCode('')
      setError(null)
    },
    onError: () => setError('Invalid verification code. Try again.'),
  })

  const disableMut = useMutation({
    mutationFn: (code: string) => authApi.disableTOTP(code).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['auth', 'totp-status'] })
      setShowDisableModal(false)
      setDisableCode('')
      setError(null)
    },
    onError: () => setError('Failed to disable 2FA. Check your code.'),
  })

  const handleEnableClick = () => {
    setError(null)
    setupMut.mutate()
  }

  const handleVerifySubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (verifyCode.length !== 6) return
    enableMut.mutate(verifyCode)
  }

  const handleDisableSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (disableCode.length !== 6) return
    disableMut.mutate(disableCode)
  }

  return (
    <>
      <div className="kura-density-gap space-y-5">
        {/* Status banner */}
        {statusLoading ? (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl animate-pulse" style={{ background: 'var(--kura-surface)', border: '1px solid var(--kura-border)' }}>
            <div className="w-4 h-4 rounded-full" style={{ background: 'var(--kura-alpha-10)' }} />
            <div className="space-y-1">
              <div className="w-40 h-3 rounded" style={{ background: 'var(--kura-alpha-10)' }} />
              <div className="w-24 h-2 rounded" style={{ background: 'var(--kura-border)' }} />
            </div>
          </div>
        ) : twoFaEnabled ? (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.15)' }}>
            <CheckCircle size={16} weight="fill" style={{ color: '#10b981' }} />
            <div>
              <p className="text-xs font-semibold text-emerald-400">Account protected with 2FA</p>
              <p className="text-[10px] text-white/30 mt-0.5">TOTP active</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.15)' }}>
            <Warning size={16} weight="fill" style={{ color: '#ef4444' }} />
            <div>
              <p className="text-xs font-semibold text-red-400">No additional authentication</p>
              <p className="text-[10px] text-white/30 mt-0.5">We recommend enabling 2FA</p>
            </div>
          </div>
        )}

        {/* TOTP row */}
        <div>
          <SLabel>Two-Factor Authentication</SLabel>
          <Card>
            <div className="py-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}>
                <Lock size={16} weight="fill" style={{ color: '#10b981' }} />
              </div>
              <div className="flex-1"><p className="text-xs font-semibold text-white">TOTP</p><p className="text-[10px] text-white/30 mt-0.5">Google Authenticator, Authy, Bitwarden...</p></div>
              {setupMut.isPending ? (
                <span className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ background: 'var(--kura-surface-alt)', color: 'var(--kura-alpha-30)' }}>Generating…</span>
              ) : twoFaEnabled ? (
                <button onClick={() => { setError(null); setShowDisableModal(true) }} className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors" style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
                  Disable
                </button>
              ) : (
                <button onClick={handleEnableClick} className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors" style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)' }}>
                  Enable
                </button>
              )}
            </div>
          </Card>
        </div>

        {/* Error banner */}
        {error && (
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }}>
            <Warning size={13} weight="fill" style={{ color: '#ef4444' }} />
            <p className="text-[11px] text-red-400">{error}</p>
          </div>
        )}

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

      {/* Setup / Enable modal */}
      <AnimatePresence>
        {showSetupModal && setupData && (
          <Modal onClose={() => { setShowSetupModal(false); setSetupData(null); setVerifyCode('') }}>
            <h3 className="font-bold text-base text-white mb-4 text-center">Set up 2FA</h3>
            <form onSubmit={handleVerifySubmit} className="space-y-4 flex flex-col items-center">
              <div className="p-3 bg-white rounded-xl">
                <QRCode value={setupData.otpauth_url} size={140} />
              </div>
              <p className="text-[11px] text-white/40 text-center leading-relaxed px-2">Scan the QR code with Google Authenticator or Authy and enter the 6-digit code.</p>
              <p className="text-[10px] text-white/25 font-mono bg-white/5 px-2 py-1 rounded">{setupData.secret}</p>
              <div className="space-y-1 w-full">
                <label className="text-[10px] text-white/35 uppercase tracking-wide">Verification Code</label>
                <input type="text" placeholder="000000" value={verifyCode} onChange={e => setVerifyCode(e.target.value.replace(/\D/g, ''))} className="w-full text-center bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white font-mono tracking-[0.5em] focus:outline-none focus:border-sky-500/50" maxLength={6} required autoFocus />
              </div>
              <div className="flex justify-end gap-2 w-full pt-2 border-t border-white/5">
                <button type="button" onClick={() => { setShowSetupModal(false); setSetupData(null); setVerifyCode('') }} className="px-3 py-1.5 rounded-lg hover:bg-white/5 text-white/50 text-xs font-semibold cursor-pointer">Cancel</button>
                <button type="submit" disabled={enableMut.isPending || verifyCode.length !== 6} className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold cursor-pointer">
                  {enableMut.isPending ? 'Verifying…' : 'Enable 2FA'}
                </button>
              </div>
            </form>
          </Modal>
        )}
      </AnimatePresence>

      {/* Disable confirmation modal */}
      <AnimatePresence>
        {showDisableModal && (
          <Modal onClose={() => { setShowDisableModal(false); setDisableCode('') }}>
            <h3 className="font-bold text-base text-white mb-2 text-center">Disable 2FA</h3>
            <p className="text-[11px] text-white/40 text-center mb-4">Enter your current TOTP code to disable two-factor authentication.</p>
            <form onSubmit={handleDisableSubmit} className="space-y-4 flex flex-col items-center">
              <div className="space-y-1 w-full">
                <label className="text-[10px] text-white/35 uppercase tracking-wide">Verification Code</label>
                <input type="text" placeholder="000000" value={disableCode} onChange={e => setDisableCode(e.target.value.replace(/\D/g, ''))} className="w-full text-center bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white font-mono tracking-[0.5em] focus:outline-none focus:border-red-500/50" maxLength={6} required autoFocus />
              </div>
              <div className="flex justify-end gap-2 w-full pt-2 border-t border-white/5">
                <button type="button" onClick={() => { setShowDisableModal(false); setDisableCode('') }} className="px-3 py-1.5 rounded-lg hover:bg-white/5 text-white/50 text-xs font-semibold cursor-pointer">Cancel</button>
                <button type="submit" disabled={disableMut.isPending || disableCode.length !== 6} className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold cursor-pointer">
                  {disableMut.isPending ? 'Disabling…' : 'Disable 2FA'}
                </button>
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
  const qc = useQueryClient()

  const { data: sshData, isLoading: sshLoading } = useQuery({
    queryKey: ['settings', 'ssh'],
    queryFn: () => settingsApi.getSSH().then(r => r.data),
  })

  const { data: keysData, isLoading: keysLoading } = useQuery({
    queryKey: ['settings', 'ssh', 'keys'],
    queryFn: () => settingsApi.listSSHKeys().then(r => r.data),
  })

  const saveMut = useMutation({
    mutationFn: (data: SshSettings) => settingsApi.saveSSH(data).then(r => r.data),
    onSettled: () => qc.invalidateQueries({ queryKey: ['settings', 'ssh'] }),
  })

  const addKeyMut = useMutation({
    mutationFn: (key: string) => settingsApi.addSSHKey(key),
    onSettled: () => qc.invalidateQueries({ queryKey: ['settings', 'ssh', 'keys'] }),
  })

  const removeKeyMut = useMutation({
    mutationFn: (id: string) => settingsApi.removeSSHKey(id),
    onSettled: () => qc.invalidateQueries({ queryKey: ['settings', 'ssh', 'keys'] }),
  })

  const [sshEnabled, setSshEnabled] = useState(true)
  const [port, setPort] = useState('22')
  const [passwordAuth, setPasswordAuth] = useState(false)
  const [rootLogin, setRootLogin] = useState(false)
  const [showAddKey, setShowAddKey] = useState(false)
  const [newKey, setNewKey] = useState('')
  const [sshSaveStatus, setSshSaveStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    if (sshData) {
      setSshEnabled(sshData.enabled)
      setPort(String(sshData.port))
      setPasswordAuth(sshData.passwordAuth)
      setRootLogin(sshData.rootLogin)
    }
  }, [sshData])

  useEffect(() => {
    if (saveMut.isSuccess) {
      setSshSaveStatus('success')
      const t = setTimeout(() => setSshSaveStatus('idle'), 3000)
      return () => clearTimeout(t)
    }
    if (saveMut.isError) {
      setSshSaveStatus('error')
      const t = setTimeout(() => setSshSaveStatus('idle'), 5000)
      return () => clearTimeout(t)
    }
  }, [saveMut.isSuccess, saveMut.isError])

  const save = (patch: Partial<SshSettings>) => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      saveMut.mutate({ enabled: sshEnabled, port: Number(port) || 22, passwordAuth, rootLogin, ...patch })
    }, 500)
  }

  const keys = keysData?.keys ?? []

  if (sshLoading) return (
    <div className="space-y-5 animate-pulse">
      {[80, 60, 72].map((w, i) => (
        <div key={i} className="h-20 rounded-xl bg-white/[0.04]" style={{ width: `${w}%` }} />
      ))}
    </div>
  )

  return (
    <div className="space-y-5">
      {sshSaveStatus === 'success' && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)' }}>
          <CheckCircle size={13} weight="fill" style={{ color: '#10b981' }} />
          <p className="text-[11px] text-emerald-400">SSH configuration applied successfully</p>
        </div>
      )}
      {sshSaveStatus === 'error' && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }}>
          <Warning size={13} weight="fill" style={{ color: '#ef4444' }} />
          <p className="text-[11px] text-red-400">Failed to apply SSH configuration. Check daemon logs.</p>
        </div>
      )}
      <div>
        <SLabel>OpenSSH Server</SLabel>
        <Card>
          <RowToggle label="Enable SSH server" sub="Remote access via terminal" on={sshEnabled} onChange={() => { setSshEnabled(p => !p); save({ enabled: !sshEnabled }) }}  />
          {sshEnabled && (
            <div className="py-3 border-t border-white/[0.05] flex items-center gap-3">
              <span className="text-xs text-white flex-1">Port</span>
              <input type="text" value={port} onChange={e => { setPort(e.target.value); save({ port: Number(e.target.value) || 22 }) }} className="w-20 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white font-mono text-center focus:outline-none focus:border-sky-500/50" />
            </div>
          )}
        </Card>
      </div>
      {sshEnabled && (
        <>
          <div>
            <SLabel>Authentication</SLabel>
            <Card>
              <RowToggle label="Password authentication" sub="Disable to use keys only" on={passwordAuth} onChange={() => { setPasswordAuth(p => !p); save({ passwordAuth: !passwordAuth }) }} color="#f59e0b" />
              <RowToggle label="Root login" sub="Not recommended in production" on={rootLogin} onChange={() => { setRootLogin(p => !p); save({ rootLogin: !rootLogin }) }} color="#ef4444" />
            </Card>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <SLabel>Authorized SSH Keys</SLabel>
              <button onClick={() => setShowAddKey(true)} className="flex items-center gap-1 text-[10px] text-sky-400 hover:text-sky-300 cursor-pointer transition-colors mb-2"><Plus size={10} weight="bold" /> Add</button>
            </div>
            {keysLoading ? (
              <div className="space-y-1.5">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="h-14 rounded-xl animate-pulse" style={{ background: 'var(--kura-surface)' }} />
                ))}
              </div>
            ) : (
              <div className="space-y-1.5">
                {keys.map(k => (
                  <div key={k.id} className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: 'var(--kura-surface)', border: '1px solid var(--kura-border)' }}>
                    <Key size={13} style={{ color: 'var(--kura-alpha-30)' }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-white">{k.comment}</p>
                      <p className="text-[10px] text-white/30 mt-0.5 font-mono truncate">{k.fingerprint} · {k.added}</p>
                    </div>
                    <button onClick={() => removeKeyMut.mutate(k.id)} className="p-1.5 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"><Trash size={12} /></button>
                  </div>
                ))}
                {keys.length === 0 && (
                  <p className="text-xs text-white/25 text-center py-4">No SSH keys added</p>
                )}
              </div>
            )}
          </div>
        </>
      )}

      <AnimatePresence>
        {showAddKey && (
          <Modal onClose={() => { setShowAddKey(false); setNewKey('') }}>
            <h3 className="font-bold text-base text-white mb-4">Add SSH Key</h3>
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] text-white/35 uppercase tracking-wide">Public Key</label>
                <textarea
                  value={newKey}
                  onChange={e => setNewKey(e.target.value)}
                  placeholder="ssh-ed25519 AAAA... user@host"
                  rows={4}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-sky-500/50 resize-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
                <button onClick={() => { setShowAddKey(false); setNewKey('') }} className="px-3 py-1.5 rounded-lg hover:bg-white/5 text-white/50 text-xs font-semibold cursor-pointer">Cancel</button>
                <button
                  onClick={() => { if (newKey.trim()) { addKeyMut.mutate(newKey.trim()); setShowAddKey(false); setNewKey('') } }}
                  disabled={!newKey.trim() || addKeyMut.isPending}
                  className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold cursor-pointer"
                >
                  {addKeyMut.isPending ? 'Adding…' : 'Add Key'}
                </button>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  )
}

// 13. Region & Language
function RegionPanel() {
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['settings', 'locale'],
    queryFn: () => settingsApi.getLocale().then(r => r.data),
  })

  const [language, setLanguage]       = useState('en-US')
  const [dateFormat, setDateFormat]   = useState('MM/DD/YYYY')
  const [timeFormat, setTimeFormat]   = useState('24h')
  const [currency, setCurrency]       = useState('USD')
  const [numberFormat, setNumberFormat] = useState('en')

  useEffect(() => {
    if (data) {
      setLanguage(data.language)
      setDateFormat(data.dateFormat)
      setTimeFormat(data.timeFormat)
      setCurrency(data.currency)
      setNumberFormat(data.numberFormat)
    }
  }, [data])

  const mutation = useMutation({
    mutationFn: (next: LocaleSettings) => settingsApi.saveLocale(next).then(r => r.data),
    onMutate: async (next) => {
      await qc.cancelQueries({ queryKey: ['settings', 'locale'] })
      const prev = qc.getQueryData<LocaleSettings>(['settings', 'locale'])
      qc.setQueryData(['settings', 'locale'], next)
      return { prev }
    },
    onError: (_err, _next, ctx) => {
      if (ctx?.prev) qc.setQueryData(['settings', 'locale'], ctx.prev)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['settings', 'locale'] }),
  })

  const save = (patch: Partial<LocaleSettings>) => {
    mutation.mutate({ language, dateFormat, timeFormat, currency, numberFormat, ...patch })
  }

  if (isLoading) return (
    <div className="space-y-5 animate-pulse">
      {[80, 72].map((w, i) => (
        <div key={i} className="h-20 rounded-xl bg-white/[0.04]" style={{ width: `${w}%` }} />
      ))}
    </div>
  )

  return (
    <div className="space-y-5">
      <div>
        <SLabel>Interface Language</SLabel>
        <Card>
          <div className="py-3 flex items-center gap-3">
            <Translate size={13} style={{ color: 'rgba(99,102,241,0.7)' }} />
            <span className="text-xs text-white flex-1">Interface Language</span>
            <select value={language} onChange={e => { setLanguage(e.target.value); save({ language: e.target.value }) }} className="bg-slate-800 border border-white/10 rounded-lg px-2 py-1 text-xs text-white">
              <option value="en-US">English (US)</option>
              <option value="pt-BR">Português (Brasil)</option>
              <option value="pt-PT">Português (Portugal)</option>
            </select>
          </div>
          <div className="px-3 pb-3">
            <p className="text-[10px] text-white/25 leading-relaxed">This is a UI preference only. It does not change the system locale.</p>
          </div>
        </Card>
      </div>
      <div>
        <SLabel>Regional Formats</SLabel>
        <Card>
          <div className="py-2.5 border-b border-white/[0.05] flex items-center gap-3">
            <span className="text-xs text-white/40 flex-1">Date format</span>
            <select value={dateFormat} onChange={e => { setDateFormat(e.target.value); save({ dateFormat: e.target.value }) }} className="bg-slate-800 border border-white/10 rounded-lg px-2 py-1 text-xs text-white">
              <option value="MM/DD/YYYY">MM/DD/YYYY (US)</option>
              <option value="DD/MM/YYYY">DD/MM/YYYY (Europe)</option>
              <option value="YYYY-MM-DD">YYYY-MM-DD (ISO 8601)</option>
            </select>
          </div>
          <div className="py-2.5 border-b border-white/[0.05] flex items-center gap-3">
            <span className="text-xs text-white/40 flex-1">Time format</span>
            <div className="flex gap-1">
              {(['24h','12h'] as const).map(v => (
                <button key={v} onClick={() => { setTimeFormat(v); save({ timeFormat: v }) }} className="px-3 py-1 rounded-lg text-xs font-medium cursor-pointer transition-all" style={{ background: timeFormat === v ? 'rgba(99,102,241,0.2)' : 'var(--kura-surface-alt)', color: timeFormat === v ? '#818cf8' : 'var(--kura-alpha-35)', border: timeFormat === v ? '1px solid rgba(99,102,241,0.3)' : '1px solid transparent' }}>{v}</button>
              ))}
            </div>
          </div>
          <div className="py-2.5 border-b border-white/[0.05] flex items-center gap-3">
            <span className="text-xs text-white/40 flex-1">Currency</span>
            <select value={currency} onChange={e => { setCurrency(e.target.value); save({ currency: e.target.value }) }} className="bg-slate-800 border border-white/10 rounded-lg px-2 py-1 text-xs text-white">
              <option value="USD">USD ($)</option><option value="EUR">EUR (€)</option><option value="GBP">GBP (£)</option><option value="BRL">BRL (R$)</option>
            </select>
          </div>
          <div className="py-2.5 flex items-center gap-3">
            <span className="text-xs text-white/40 flex-1">Decimal separator</span>
            <select value={numberFormat} onChange={e => { setNumberFormat(e.target.value); save({ numberFormat: e.target.value }) }} className="bg-slate-800 border border-white/10 rounded-lg px-2 py-1 text-xs text-white">
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
  const qc = useQueryClient()

  const { data: dtConfig, isLoading: dtLoading } = useQuery({
    queryKey: ['settings', 'datetime'],
    queryFn: () => settingsApi.getDatetime().then(r => r.data),
  })

  const { data: tzData } = useQuery({
    queryKey: ['settings', 'datetime', 'timezones'],
    queryFn: () => settingsApi.listTimezones().then(r => r.data),
  })

  const { data: nowData } = useQuery({
    queryKey: ['settings', 'datetime', 'now'],
    queryFn: () => settingsApi.getCurrentTime().then(r => r.data),
    refetchInterval: 1000,
  })

  const [ntpEnabled, setNtpEnabled] = useState(true)
  const [ntpServer, setNtpServer]   = useState('pool.ntp.org')
  const [timezone, setTimezone]     = useState('UTC')
  const [manualDate, setManualDate] = useState('')
  const [manualTime, setManualTime] = useState('')

  useEffect(() => {
    if (dtConfig) {
      setNtpEnabled(dtConfig.ntpEnabled)
      setNtpServer(dtConfig.ntpServer)
      setTimezone(dtConfig.timezone)
    }
  }, [dtConfig])

  const mutation = useMutation({
    mutationFn: (data: DatetimeSettings) => settingsApi.saveDatetime(data).then(r => r.data),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['settings', 'datetime'] })
      qc.invalidateQueries({ queryKey: ['settings', 'datetime', 'now'] })
    },
  })

  const save = () => {
    mutation.mutate({ ntpEnabled, ntpServer, timezone })
  }

  const timezones = tzData?.timezones ?? []

  if (dtLoading) return (
    <div className="space-y-5 animate-pulse">
      {[80, 72, 60].map((w, i) => (
        <div key={i} className="h-20 rounded-xl bg-white/[0.04]" style={{ width: `${w}%` }} />
      ))}
    </div>
  )

  return (
    <div className="space-y-5">
      {nowData && (
        <div className="px-4 py-3 rounded-xl text-center" style={{ background: 'rgba(14,165,233,0.06)', border: '1px solid rgba(14,165,233,0.15)' }}>
          <p className="text-[10px] text-sky-400/60 uppercase tracking-widest mb-1">Server Time</p>
          <p className="text-lg font-mono font-bold text-white tabular-nums">{nowData.time.split('T')[1]?.split('.')[0]}</p>
          <p className="text-[10px] text-white/30 mt-0.5">{nowData.time.split('T')[0]} · {nowData.timezone} (UTC{nowData.offset})</p>
        </div>
      )}

      <div>
        <SLabel>Timezone</SLabel>
        <Card>
          <div className="py-3 flex items-center gap-3">
            <Globe size={13} style={{ color: 'rgba(14,165,233,0.7)' }} />
            <span className="text-xs text-white flex-1">Timezone</span>
            <select
              value={timezone}
              onChange={e => { setTimezone(e.target.value); save() }}
              className="bg-slate-800 border border-white/10 rounded-lg px-2 py-1 text-xs text-white max-w-[200px]"
            >
              {timezones.length > 0
                ? timezones.map(tz => <option key={tz} value={tz}>{tz}</option>)
                : ['UTC','America/New_York','America/Sao_Paulo','Europe/Lisbon','Europe/London','Europe/Paris','Asia/Tokyo'].map(tz => <option key={tz} value={tz}>{tz}</option>)
              }
            </select>
          </div>
        </Card>
      </div>

      <div>
        <SLabel>NTP Sync</SLabel>
        <Card>
          <RowToggle label="Sync time automatically" sub="Uses NTP to keep exact time" on={ntpEnabled} onChange={() => { setNtpEnabled(p => !p); setTimeout(save, 0) }} color="#0ea5e9" />
          {ntpEnabled && (
            <div className="py-3 border-t border-white/[0.05] flex items-center gap-3">
              <Clock size={13} style={{ color: 'rgba(14,165,233,0.5)' }} />
              <span className="text-xs text-white/60 flex-1">NTP Server</span>
              <input
                type="text"
                value={ntpServer}
                onChange={e => setNtpServer(e.target.value)}
                onBlur={save}
                className="w-40 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white font-mono focus:outline-none focus:border-sky-500/50"
              />
            </div>
          )}
        </Card>
      </div>

      {!ntpEnabled && (
        <div>
          <SLabel>Manual Date & Time</SLabel>
          <Card>
            <div className="py-3 grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] text-white/35">Date</label>
                <input type="date" value={manualDate} onChange={e => setManualDate(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-white/35">Time</label>
                <input type="time" value={manualTime} onChange={e => setManualTime(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none" />
              </div>
            </div>
            <div className="flex justify-end pb-3">
              <button
                onClick={save}
                disabled={mutation.isPending || !manualDate || !manualTime}
                className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer transition-colors"
              >
                {mutation.isPending ? 'Applying…' : 'Set Time'}
              </button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}

// 15. Remote Desktop
function RemoteDesktopPanel() {
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['settings', 'remote-desktop'],
    queryFn: () => settingsApi.getRemoteDesktop().then(r => r.data),
  })

  const { data: status } = useQuery({
    queryKey: ['settings', 'remote-desktop', 'status'],
    queryFn: () => settingsApi.getRemoteDesktopStatus().then(r => r.data),
    enabled: !!data,
  })

  const [rdpEnabled, setRdpEnabled] = useState(false)
  const [vncEnabled, setVncEnabled] = useState(false)
  const [de, setDe] = useState<'xfce' | 'openbox' | 'kde' | 'gnome'>('xfce')
  const [resolution, setResolution] = useState('1920x1080')
  const [autoInstall, setAutoInstall] = useState(true)

  useEffect(() => {
    if (data) {
      setRdpEnabled(data.rdpEnabled)
      setVncEnabled(data.vncEnabled)
      setDe(data.de as typeof de)
      setResolution(data.resolution)
      setAutoInstall(data.autoInstall)
    }
  }, [data])

  const mutation = useMutation({
    mutationFn: (next: RemoteDesktopSettings) => settingsApi.saveRemoteDesktop(next).then(r => r.data),
    onMutate: async (next) => {
      await qc.cancelQueries({ queryKey: ['settings', 'remote-desktop'] })
      const prev = qc.getQueryData<RemoteDesktopSettings>(['settings', 'remote-desktop'])
      qc.setQueryData(['settings', 'remote-desktop'], next)
      return { prev }
    },
    onError: (_err, _next, ctx) => {
      if (ctx?.prev) qc.setQueryData(['settings', 'remote-desktop'], ctx.prev)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['settings', 'remote-desktop'] })
      qc.invalidateQueries({ queryKey: ['settings', 'remote-desktop', 'status'] })
    },
  })

  const save = (patch: Partial<RemoteDesktopSettings>) => {
    mutation.mutate({ rdpEnabled, vncEnabled, de, resolution, autoInstall, ...patch })
  }

  const desktops = [
    { id: 'xfce',    label: 'XFCE',       sub: 'Lightweight and fast, ideal for servers', size: '~400 MB' },
    { id: 'openbox', label: 'Openbox',     sub: 'Minimalist, window manager only',         size: '~80 MB'  },
    { id: 'kde',     label: 'KDE Plasma',  sub: 'Full-featured and modern',                size: '~1.2 GB' },
    { id: 'gnome',   label: 'GNOME',       sub: 'Familiar and polished',                   size: '~900 MB' },
  ] as const

  if (isLoading) return (
    <div className="space-y-5 animate-pulse">
      {[80, 60, 72].map((w, i) => (
        <div key={i} className="h-20 rounded-xl bg-white/[0.04]" style={{ width: `${w}%` }} />
      ))}
    </div>
  )

  const isInstalling = mutation.isPending

  return (
    <div className="space-y-5">
      <div>
        <SLabel>Protocols</SLabel>
        <Card>
          <RowToggle label="RDP (Remote Desktop Protocol)" sub="Port 3389 — Windows compatible" on={rdpEnabled} onChange={() => save({ rdpEnabled: !rdpEnabled })} color="#14b8a6" />
          <RowToggle label="VNC (Virtual Network Computing)" sub="Port 5900 — compatible with all OS" on={vncEnabled} onChange={() => save({ vncEnabled: !vncEnabled })} color="#14b8a6" />
        </Card>
      </div>
      {(rdpEnabled || vncEnabled) && (
        <>
          <div>
            <SLabel>Desktop Environment</SLabel>
            <div className="mb-3"><RowToggle label="Auto-install if needed" sub="KuraOS installs the DE via apt" on={autoInstall} onChange={() => save({ autoInstall: !autoInstall })} color="#14b8a6" /></div>
            <div className="space-y-1.5">
              {desktops.map(d => {
                const active = de === d.id
                const installed = status?.deInstalled && d.id === de
                return (
                  <button key={d.id} onClick={() => { setDe(d.id); save({ de: d.id }) }} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all text-left" style={{ background: active ? 'rgba(20,184,166,0.08)' : 'var(--kura-surface)', border: active ? '1px solid rgba(20,184,166,0.25)' : '1px solid var(--kura-border)' }}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`text-xs font-semibold ${active ? 'text-white' : 'text-white/60'}`}>{d.label}</p>
                        <span className="text-[9px] text-white/25">{d.size}</span>
                        {installed && <span className="text-[9px] px-1.5 py-0.5 rounded font-bold" style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981' }}>Installed</span>}
                      </div>
                      <p className="text-[10px] text-white/30 mt-0.5">{d.sub}</p>
                    </div>
                    {isInstalling && de === d.id ? (
                      <div className="w-4 h-4 rounded-full border-2 border-teal-400 border-t-transparent animate-spin" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center" style={{ borderColor: active ? '#14b8a6' : 'var(--kura-alpha-20)' }}>
                        {active && <div className="w-2 h-2 rounded-full bg-teal-400" />}
                      </div>
                    )}
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
                <select value={resolution} onChange={e => { setResolution(e.target.value); save({ resolution: e.target.value }) }} className="bg-slate-800 border border-white/10 rounded-lg px-2 py-1 text-xs text-white">
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
          <div className="h-24 rounded-xl animate-pulse" style={{ background: 'var(--kura-surface)' }} />
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
                <GraphicsCard size={11} style={{ color: 'var(--kura-alpha-20)' }} />
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
          <div className="px-4 py-3 rounded-xl text-xs text-white/30" style={{ background: 'var(--kura-alpha-03)', border: '1px solid var(--kura-surface-alt)' }}>
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
  const qc = useQueryClient()

  const { data: updateInfo, isLoading: loadingCheck, error: checkError } = useQuery<UpdateInfo>({
    queryKey: ['updates', 'check'],
    queryFn: () => updatesApi.check().then(r => r.data),
  })

  const { data: updateStatus } = useQuery({
    queryKey: ['updates', 'status'],
    queryFn: () => updatesApi.status().then(r => r.data),
    refetchInterval: (q) => q.state.data?.running ? 1500 : false,
  })

  const { data: updateSettings } = useQuery<UpdateSettings>({
    queryKey: ['updates', 'settings'],
    queryFn: () => updatesApi.getSettings().then(r => r.data),
  })

  const installMut = useMutation({
    mutationFn: () => updatesApi.install(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['updates', 'check'] })
      qc.invalidateQueries({ queryKey: ['updates', 'status'] })
    },
  })

  const settingsMut = useMutation({
    mutationFn: (data: UpdateSettings) => updatesApi.saveSettings(data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['updates', 'settings'] }),
  })

  const isUpdating = updateStatus?.running ?? false
  const progress = updateStatus?.progress ?? 0
  const stageMsg = updateStatus?.message ?? ''
  const autoCheck = updateSettings?.autoCheck ?? true

  if (loadingCheck) return (
    <div className="space-y-5 animate-pulse">
      <div className="h-20 rounded-xl" style={{ background: 'var(--kura-surface)' }} />
      <div className="h-24 rounded-xl" style={{ background: 'var(--kura-surface)' }} />
    </div>
  )

  if (checkError) return (
    <div className="p-4 rounded-xl" style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.15)' }}>
      <p className="text-xs font-semibold text-red-400">Unable to check for updates</p>
      <p className="text-[10px] text-white/30 mt-1">The update service may be unavailable.</p>
    </div>
  )

  return (
    <div className="space-y-5">
      <div>
        <SLabel>Installed Version</SLabel>
        <Card>
          <Row label="KuraOS" value={`v${updateInfo?.currentVersion ?? '—'}`} />
          <Row label="Pending packages" value={`${updateInfo?.packageCount ?? 0}`} />
        </Card>
      </div>
      <div>
        <SLabel>System Update</SLabel>
        {isUpdating ? (
          <div className="p-4 rounded-xl space-y-3" style={{ background: 'var(--kura-surface)', border: '1px solid var(--kura-border)' }}>
            <div className="flex justify-between text-xs text-white/50">
              <span>{stageMsg || 'Installing update...'}</span>
              <span className="tabular-nums font-mono">{progress}%</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--kura-alpha-07)' }}>
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progress}%`, background: 'linear-gradient(90deg, #0ea5e9, #38bdf8)' }} />
            </div>
            <p className="text-[10px] text-white/25">Do not power off the system during the update</p>
          </div>
        ) : updateInfo?.available ? (
          <div className="p-4 rounded-xl flex items-start gap-3" style={{ background: 'rgba(6,182,212,0.05)', border: '1px solid rgba(6,182,212,0.15)' }}>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: 'rgba(6,182,212,0.12)', border: '1px solid rgba(6,182,212,0.2)' }}>
              <ArrowsClockwise size={16} weight="fill" style={{ color: '#06b6d4' }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white">{updateInfo.packageCount} package(s) available</p>
              <p className="text-[11px] text-white/40 mt-1 leading-relaxed">{updateInfo.changelog || 'Security patches and system updates available.'}</p>
            </div>
            <button
              onClick={() => installMut.mutate()}
              disabled={installMut.isPending}
              className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer mt-0.5 disabled:opacity-50"
              style={{ background: 'rgba(6,182,212,0.15)', color: '#06b6d4', border: '1px solid rgba(6,182,212,0.25)' }}
            >
              {installMut.isPending ? 'Starting…' : 'Install'}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3 p-4 rounded-xl" style={{ background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.15)' }}>
            <CheckCircle size={16} weight="fill" style={{ color: '#10b981' }} />
            <p className="text-xs font-semibold text-emerald-400">KuraOS is fully up to date</p>
          </div>
        )}
      </div>
      <div>
        <SLabel>Preferences</SLabel>
        <Card>
          <RowToggle
            label="Check for updates automatically"
            sub="Daily at 03:00"
            on={autoCheck}
            onChange={() => settingsMut.mutate({ autoCheck: !autoCheck })}
            color="#06b6d4"
          />
        </Card>
      </div>
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
      <div className="w-[205px] shrink-0 flex flex-col gap-0.5 p-2 overflow-y-auto border-r" style={{ borderColor: 'var(--kura-border)' }}>
        {NAV.map((group, gi) => (
          <div key={group.label} className={gi > 0 ? 'mt-2' : ''}>
            <p className="text-[9px] font-semibold text-white/20 uppercase tracking-widest px-3 py-1.5">{group.label}</p>
            {group.items.map(def => <NavItem key={def.id} def={def} active={active === def.id} onClick={() => setActive(def.id)} />)}
          </div>
        ))}
      </div>

      {/* ── Detail panel ────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="px-5 py-3.5 border-b shrink-0" style={{ borderColor: 'var(--kura-border)' }}>
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
