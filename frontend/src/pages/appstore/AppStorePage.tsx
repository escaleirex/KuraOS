import { useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, Package, Play, Square, RotateCw, Trash2,
  RefreshCw, Star, Download, ChevronLeft, ChevronRight, Shield,
  Film, ArrowDownToLine, RefreshCcw, Home, Network, Code2, Archive, Layers,
  type LucideIcon,
} from 'lucide-react'

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  media:    Film,
  download: ArrowDownToLine,
  sync:     RefreshCcw,
  home:     Home,
  network:  Network,
  dev:      Code2,
  backup:   Archive,
  docker:   Layers,
}
function AppCategoryIcon({ category, size = 24, className }: { category: string; size?: number; className?: string }) {
  const Icon = CATEGORY_ICONS[category] ?? Package
  return <Icon size={size} className={className} />
}
import { appsApi } from '@/api/client'
import { AppInfoModal } from './AppInfoModal'
import { AppDetail } from './AppDetail'

// ── Shared types ────────────────────────────────────────────────────────────

export interface PortMapping {
  host: number
  container: number
  protocol: string
}

export interface AppTemplate {
  id: string
  name: string
  category: string
  description: string
  icon: string
  image: string
  ports: PortMapping[]
  volumes: any[]
  env: any[]
  web_port?: number
  source?: 'builtin' | 'community' | 'dockerhub'
  stars?: number
  pulls?: string
  is_official?: boolean
  logo_url?: string
}

export interface InstalledApp {
  id: string
  template_id: string
  name: string
  category: string
  icon: string
  status: 'running' | 'stopped' | 'starting' | 'error'
  ports: PortMapping[]
  data_dir: string
  installed_at: string
  web_url?: string
}

// ── Constants ───────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  running: '#10b981',
  stopped: '#6b7280',
  starting: '#f59e0b',
  error:   '#ef4444',
}

const CATEGORY_GRADIENT: Record<string, string> = {
  media:       'linear-gradient(135deg,#1e1b4b,#312e81)',
  sync:        'linear-gradient(135deg,#0c4a6e,#0369a1)',
  dev:         'linear-gradient(135deg,#14532d,#166534)',
  security:    'linear-gradient(135deg,#450a0a,#7f1d1d)',
  network:     'linear-gradient(135deg,#431407,#7c2d12)',
  home:        'linear-gradient(135deg,#1c1917,#44403c)',
  monitoring:  'linear-gradient(135deg,#1a1a2e,#16213e)',
  download:    'linear-gradient(135deg,#0f172a,#1e293b)',
  productivity:'linear-gradient(135deg,#2e1065,#4a044e)',
  files:       'linear-gradient(135deg,#0c4a6e,#075985)',
  finance:     'linear-gradient(135deg,#14532d,#052e16)',
  other:       'linear-gradient(135deg,#18181b,#27272a)',
}

type Tab = 'featured' | 'community' | 'discover' | 'installed'

// ── AppStorePage ────────────────────────────────────────────────────────────

export function AppStorePage() {
  const [tab, setTab] = useState<Tab>('featured')
  const [communitySearch, setCommunitySearch] = useState('')
  const [hubInput, setHubInput] = useState('')
  const [hubQuery, setHubQuery] = useState('')
  const [infoApp, setInfoApp] = useState<AppTemplate | null>(null)
  const [installApp, setInstallApp] = useState<AppTemplate | null>(null)

  const qc = useQueryClient()

  const { data: featured = [], isLoading: loadingFeatured } = useQuery<AppTemplate[]>({
    queryKey: ['apps', 'featured'],
    queryFn: () => appsApi.featured().then(r => r.data),
    staleTime: 60 * 60 * 1000,
  })

  const { data: community = [], isLoading: loadingCommunity } = useQuery<AppTemplate[]>({
    queryKey: ['apps', 'community', communitySearch],
    queryFn: () => appsApi.community({ search: communitySearch || undefined }).then(r => r.data),
    enabled: tab === 'community',
  })

  const { data: hubResults = [], isLoading: loadingHub } = useQuery<AppTemplate[]>({
    queryKey: ['apps', 'hub', hubQuery],
    queryFn: () => appsApi.searchDockerHub(hubQuery).then(r => r.data),
    enabled: hubQuery.length > 0,
  })

  const { data: installed = [], isLoading: loadingInstalled } = useQuery<InstalledApp[]>({
    queryKey: ['apps', 'installed'],
    queryFn: () => appsApi.listInstalled().then(r => r.data),
    refetchInterval: 10_000,
  })

  const installedIds = new Set(installed.map(a => a.id))

  const makeMut = (fn: (id: string) => Promise<any>) =>
    useMutation({
      mutationFn: fn,
      onSuccess: () => qc.invalidateQueries({ queryKey: ['apps', 'installed'] }),
    })

  const stopMut      = makeMut(appsApi.stop)
  const startMut     = makeMut(appsApi.start)
  const restartMut   = makeMut(appsApi.restart)
  const uninstallMut = makeMut(appsApi.uninstall)
  const updateMut    = makeMut(appsApi.update)

  const TABS: { id: Tab; label: string; badge?: number }[] = [
    { id: 'featured',  label: 'Featured' },
    { id: 'community', label: 'Community' },
    { id: 'discover',  label: 'Discover' },
    { id: 'installed', label: 'Installed', badge: installed.length || undefined },
  ]

  const openInfo = (app: AppTemplate) => setInfoApp(app)
  const openInstall = (app: AppTemplate) => { setInfoApp(null); setInstallApp(app) }
  const onInstalled = () => {
    qc.invalidateQueries({ queryKey: ['apps', 'installed'] })
    setInstallApp(null)
    setTab('installed')
  }

  return (
    <div className="flex flex-col h-full select-none" style={{ background: 'var(--kura-menu-bg)', color: 'var(--kura-text)' }}>

      {/* ── Top bar ── */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-white/5 flex-shrink-0">
        <Package size={18} className="text-white/70" />
        <h1 className="font-semibold text-sm">App Store</h1>

        <div className="flex gap-0.5 ml-3 p-0.5 rounded-lg" style={{ background: 'var(--kura-alpha-05)' }}>
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="px-3 py-1 rounded-md text-xs transition-all"
              style={{
                background: tab === t.id ? 'var(--kura-alpha-12)' : 'transparent',
                color: tab === t.id ? 'white' : 'var(--kura-alpha-45)',
              }}
            >
              {t.label}
              {t.badge != null && (
                <span
                  className="ml-1 px-1.5 rounded-full text-xs"
                  style={{ background: 'rgba(245,158,11,0.25)', color: '#f59e0b' }}
                >
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Community search */}
        {tab === 'community' && (
          <div className="relative ml-auto">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/25" />
            <input
              type="text"
              value={communitySearch}
              onChange={e => setCommunitySearch(e.target.value)}
              placeholder="Search community…"
              className="pl-7 pr-3 py-1.5 rounded-lg text-xs bg-white/5 border border-white/10 focus:outline-none focus:border-white/25 w-44 placeholder-white/20"
            />
          </div>
        )}
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto">

        {/* ── FEATURED ── */}
        {tab === 'featured' && (
          <div className="flex flex-col gap-6 py-5">
            {loadingFeatured ? (
              <SkeletonCarousel />
            ) : (
              <>
                {/* Hero carousel */}
                <section>
                  <SectionHeader title="Recommended for Home Server" />
                  <Carousel apps={featured.slice(0, 8)} installedIds={installedIds} onOpen={openInfo} />
                </section>

                {/* Media & Entertainment */}
                <CategorySection
                  title="Media & Entertainment"
                  apps={featured.filter(a => a.category === 'media')}
                  installedIds={installedIds}
                  onOpen={openInfo}
                />

                {/* Network & Security */}
                <CategorySection
                  title="Network & Security"
                  apps={featured.filter(a => a.category === 'network' || a.category === 'security')}
                  installedIds={installedIds}
                  onOpen={openInfo}
                />

                {/* Productivity & Sync */}
                <CategorySection
                  title="Productivity & Sync"
                  apps={featured.filter(a => ['sync', 'productivity', 'files', 'finance'].includes(a.category))}
                  installedIds={installedIds}
                  onOpen={openInfo}
                />

                {/* Dev & Monitoring */}
                <CategorySection
                  title="Dev & Monitoring"
                  apps={featured.filter(a => ['dev', 'monitoring'].includes(a.category))}
                  installedIds={installedIds}
                  onOpen={openInfo}
                />
              </>
            )}
          </div>
        )}

        {/* ── COMMUNITY ── */}
        {tab === 'community' && (
          <div className="p-5">
            {loadingCommunity ? (
              <div className="flex items-center justify-center h-32 text-white/30 text-sm">Loading Portainer templates…</div>
            ) : community.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 gap-2 text-white/30">
                <Package size={32} />
                <span className="text-sm">No templates found</span>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {community.map(app => (
                  <ListCard key={app.id} app={app} isInstalled={installedIds.has(app.id)} onOpen={openInfo} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── DISCOVER ── */}
        {tab === 'discover' && (
          <div className="p-5 flex flex-col gap-4">
            <form
              className="flex gap-2"
              onSubmit={e => { e.preventDefault(); setHubQuery(hubInput.trim()) }}
            >
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                <input
                  type="text"
                  value={hubInput}
                  onChange={e => setHubInput(e.target.value)}
                  placeholder="Search Docker Hub…  e.g. jellyfin, gitea, redis"
                  className="w-full pl-8 pr-3 py-2.5 rounded-xl text-sm bg-white/5 border border-white/10 focus:outline-none focus:border-white/25 placeholder-white/20"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl text-sm font-medium text-white"
                style={{ background: 'linear-gradient(135deg,#0ea5e9,#0284c7)' }}
              >
                Search
              </button>
            </form>

            {hubQuery === '' && (
              <div className="flex flex-col items-center justify-center h-40 gap-2 text-white/20">
                <Search size={36} />
                <span className="text-sm">Search any Docker Hub image</span>
              </div>
            )}
            {loadingHub && (
              <div className="flex items-center justify-center h-32 text-white/30 text-sm">Searching…</div>
            )}
            {!loadingHub && hubQuery && hubResults.length === 0 && (
              <div className="flex items-center justify-center h-32 text-white/30 text-sm">No results for "{hubQuery}"</div>
            )}
            {!loadingHub && hubResults.length > 0 && (
              <div className="flex flex-col gap-2">
                {hubResults.map(app => (
                  <HubResultRow key={app.id} app={app} isInstalled={installedIds.has(app.id)} onOpen={openInfo} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── INSTALLED ── */}
        {tab === 'installed' && (
          <div className="p-5">
            {loadingInstalled && (
              <div className="flex items-center justify-center h-32 text-white/30 text-sm">Loading…</div>
            )}
            {!loadingInstalled && installed.length === 0 && (
              <div className="flex flex-col items-center justify-center h-48 gap-3 text-white/30">
                <Package size={40} />
                <span className="text-sm">No apps installed</span>
                <button
                  onClick={() => setTab('featured')}
                  className="text-xs px-4 py-2 rounded-lg"
                  style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}
                >
                  Browse App Store
                </button>
              </div>
            )}
            <div className="flex flex-col gap-2">
              {installed.map(app => (
                <InstalledRow
                  key={app.id}
                  app={app}
                  onStop={() => stopMut.mutate(app.id)}
                  onStart={() => startMut.mutate(app.id)}
                  onRestart={() => restartMut.mutate(app.id)}
                  onUninstall={() => { if (confirm(`Uninstall ${app.name}?`)) uninstallMut.mutate(app.id) }}
                  onUpdate={() => updateMut.mutate(app.id)}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      <AnimatePresence>
        {infoApp && (
          <AppInfoModal
            key="info"
            app={infoApp}
            hubRef={deriveHubRef(infoApp.image)}
            onClose={() => setInfoApp(null)}
            onInstalled={onInstalled}
          />
        )}
      </AnimatePresence>

      {installApp && (
        <AppDetail
          app={installApp}
          onClose={() => setInstallApp(null)}
          onInstalled={onInstalled}
        />
      )}
    </div>
  )
}

// ── Carousel ────────────────────────────────────────────────────────────────

function Carousel({
  apps,
  installedIds,
  onOpen,
}: {
  apps: AppTemplate[]
  installedIds: Set<string>
  onOpen: (a: AppTemplate) => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  const scroll = (dir: 'left' | 'right') => {
    if (!ref.current) return
    ref.current.scrollBy({ left: dir === 'right' ? 240 : -240, behavior: 'smooth' })
  }

  return (
    <div className="relative group">
      {/* Arrow left */}
      <button
        onClick={() => scroll('left')}
        className="absolute left-3 top-1/2 -translate-y-1/2 z-10 p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ background: 'var(--kura-overlay)', color: 'var(--kura-text)' }}
      >
        <ChevronLeft size={16} />
      </button>

      {/* Scroll container */}
      <div
        ref={ref}
        className="flex gap-3 overflow-x-auto px-5 pb-2"
        style={{ scrollSnapType: 'x mandatory', scrollbarWidth: 'none' }}
      >
        {apps.map(app => (
          <CarouselCard
            key={app.id}
            app={app}
            isInstalled={installedIds.has(app.id)}
            onOpen={() => onOpen(app)}
          />
        ))}
      </div>

      {/* Arrow right */}
      <button
        onClick={() => scroll('right')}
        className="absolute right-3 top-1/2 -translate-y-1/2 z-10 p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ background: 'var(--kura-overlay)', color: 'var(--kura-text)' }}
      >
        <ChevronRight size={16} />
      </button>
    </div>
  )
}

function CarouselCard({
  app,
  isInstalled,
  onOpen,
}: {
  app: AppTemplate
  isInstalled: boolean
  onOpen: () => void
}) {
  const grad = CATEGORY_GRADIENT[app.category] ?? CATEGORY_GRADIENT.other

  return (
    <motion.div
      onClick={onOpen}
      whileHover={{ scale: 1.03, y: -2 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
      className="flex-shrink-0 flex flex-col overflow-hidden cursor-pointer rounded-2xl"
      style={{
        width: 200,
        scrollSnapAlign: 'start',
        background: 'var(--kura-alpha-04)',
        border: '1px solid var(--kura-alpha-08)',
      }}
    >
      {/* Art area */}
      <div
        className="flex items-center justify-center relative"
        style={{ height: 120, background: grad }}
      >
        {app.logo_url ? (
          <img
            src={app.logo_url}
            alt={app.name}
            className="h-14 w-14 object-contain rounded-xl"
            onError={e => {
              ;(e.target as HTMLImageElement).style.display = 'none'
              ;(e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden')
            }}
          />
        ) : null}
        {!app.logo_url && (
          <AppCategoryIcon category={app.category} size={40} className="text-white/70" />
        )}

        {isInstalled && (
          <div
            className="absolute top-2 right-2 text-xs px-1.5 py-0.5 rounded-full font-medium"
            style={{ background: 'rgba(16,185,129,0.2)', color: '#10b981', backdropFilter: 'blur(4px)' }}
          >
            ✓
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex flex-col gap-1 p-3">
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-sm text-white truncate">{app.name}</span>
          {app.is_official && <Shield size={11} className="text-emerald-400 flex-shrink-0" />}
        </div>
        <span
          className="text-xs capitalize px-1.5 py-0.5 rounded-full w-fit"
          style={{ background: 'var(--kura-alpha-07)', color: 'var(--kura-alpha-45)' }}
        >
          {app.category}
        </span>
        {(app.stars || app.pulls) && (
          <div className="flex items-center gap-2 mt-1">
            {app.stars != null && app.stars > 0 && (
              <span className="flex items-center gap-0.5 text-xs text-white/30">
                <Star size={10} className="text-yellow-400/60" /> {fmtNum(app.stars)}
              </span>
            )}
            {app.pulls && (
              <span className="flex items-center gap-0.5 text-xs text-white/30">
                <Download size={10} /> {app.pulls}
              </span>
            )}
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ── Category section with horizontal scroll ─────────────────────────────────

function CategorySection({
  title,
  apps,
  installedIds,
  onOpen,
}: {
  title: string
  apps: AppTemplate[]
  installedIds: Set<string>
  onOpen: (a: AppTemplate) => void
}) {
  if (apps.length === 0) return null
  return (
    <section>
      <SectionHeader title={title} />
      <Carousel apps={apps} installedIds={installedIds} onOpen={onOpen} />
    </section>
  )
}

function SectionHeader({ title }: { title: string }) {
  return (
    <h2 className="text-sm font-semibold text-white/80 px-5 mb-3">{title}</h2>
  )
}

// ── List card (Community tab) ───────────────────────────────────────────────

function ListCard({
  app,
  isInstalled,
  onOpen,
}: {
  app: AppTemplate
  isInstalled: boolean
  onOpen: (a: AppTemplate) => void
}) {
  return (
    <motion.div
      onClick={() => onOpen(app)}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      className="flex items-start gap-3 p-3.5 rounded-xl cursor-pointer"
      style={{ background: 'var(--kura-alpha-04)', border: '1px solid var(--kura-alpha-07)' }}
    >
      <div
        className="w-11 h-11 flex-shrink-0 rounded-xl flex items-center justify-center"
        style={{ background: CATEGORY_GRADIENT[app.category] ?? CATEGORY_GRADIENT.other }}
      >
        <AppCategoryIcon category={app.category} size={22} className="text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-medium text-sm text-white truncate">{app.name}</span>
          {isInstalled && (
            <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981' }}>✓</span>
          )}
        </div>
        <p className="text-xs text-white/40 mt-0.5 line-clamp-2 leading-relaxed">{app.description}</p>
      </div>
    </motion.div>
  )
}

// ── Hub search result row ───────────────────────────────────────────────────

function HubResultRow({
  app,
  isInstalled,
  onOpen,
}: {
  app: AppTemplate
  isInstalled: boolean
  onOpen: (a: AppTemplate) => void
}) {
  return (
    <motion.div
      onClick={() => onOpen(app)}
      whileHover={{ scale: 1.005 }}
      className="flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer"
      style={{ background: 'var(--kura-alpha-04)', border: '1px solid var(--kura-alpha-07)' }}
    >
      <div
        className="w-10 h-10 flex-shrink-0 rounded-xl flex items-center justify-center"
        style={{ background: 'var(--kura-alpha-06)' }}
      >
        <AppCategoryIcon category={app.category} size={20} className="text-white/60" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm text-white">{app.name}</span>
          {app.is_official && (
            <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981' }}>
              Official
            </span>
          )}
        </div>
        <p className="text-xs text-white/40 mt-0.5 truncate">{app.description || app.image}</p>
        <div className="flex items-center gap-3 mt-1">
          {(app.stars ?? 0) > 0 && (
            <span className="flex items-center gap-1 text-xs text-white/25">
              <Star size={10} /> {(app.stars ?? 0).toLocaleString()}
            </span>
          )}
          {app.pulls && (
            <span className="flex items-center gap-1 text-xs text-white/25">
              <Download size={10} /> {app.pulls}
            </span>
          )}
          <span className="text-xs text-white/20 font-mono truncate">{app.image}</span>
        </div>
      </div>
    </motion.div>
  )
}

// ── Installed row ───────────────────────────────────────────────────────────

function InstalledRow({
  app, onStop, onStart, onRestart, onUninstall, onUpdate,
}: {
  app: InstalledApp
  onStop: () => void; onStart: () => void; onRestart: () => void
  onUninstall: () => void; onUpdate: () => void
}) {
  const isRunning = app.status === 'running'
  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-xl"
      style={{ background: 'var(--kura-alpha-04)', border: '1px solid var(--kura-alpha-07)' }}
    >
      <AppCategoryIcon category={app.category} size={22} className="text-white/70 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm text-white">{app.name}</span>
          <span
            className="text-xs px-1.5 py-0.5 rounded-full"
            style={{ background: `${STATUS_COLORS[app.status]}22`, color: STATUS_COLORS[app.status] }}
          >
            {app.status}
          </span>
        </div>
        <div className="text-xs text-white/30 mt-0.5">
          {app.ports.map(p => `:${p.host}`).join(', ')}
          {app.web_url && (
            <a href={app.web_url} target="_blank" rel="noreferrer"
              className="ml-2 text-emerald-400/70 hover:text-emerald-400 transition-colors"
              onClick={e => e.stopPropagation()}
            >
              {app.web_url}
            </a>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1">
        {isRunning
          ? <IconBtn onClick={onStop}    title="Stop">    <Square    size={13} /></IconBtn>
          : <IconBtn onClick={onStart}   title="Start" accent><Play size={13} /></IconBtn>
        }
        <IconBtn onClick={onRestart}   title="Restart"><RotateCw  size={13} /></IconBtn>
        <IconBtn onClick={onUpdate}    title="Update"> <RefreshCw size={13} /></IconBtn>
        <IconBtn onClick={onUninstall} title="Uninstall" danger><Trash2 size={13} /></IconBtn>
      </div>
    </div>
  )
}

// ── Skeleton ────────────────────────────────────────────────────────────────

function SkeletonCarousel() {
  return (
    <div className="px-5 flex gap-3 overflow-hidden">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="flex-shrink-0 rounded-2xl animate-pulse"
          style={{ width: 200, height: 180, background: 'var(--kura-alpha-04)' }}
        />
      ))}
    </div>
  )
}

// ── Shared helpers ──────────────────────────────────────────────────────────

function IconBtn({
  children, onClick, title, accent, danger,
}: {
  children: React.ReactNode; onClick: () => void; title: string; accent?: boolean; danger?: boolean
}) {
  return (
    <button
      onClick={onClick} title={title}
      className="p-1.5 rounded-lg transition-colors"
      style={{ color: danger ? '#f87171' : accent ? '#10b981' : 'var(--kura-alpha-40)' }}
      onMouseEnter={e => {
        ;(e.currentTarget as HTMLElement).style.background = danger
          ? 'rgba(248,113,113,0.1)' : accent ? 'rgba(16,185,129,0.1)' : 'var(--kura-alpha-06)'
      }}
      onMouseLeave={e => { ;(e.currentTarget as HTMLElement).style.background = 'transparent' }}
    >
      {children}
    </button>
  )
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function deriveHubRef(image: string): string {
  const noTag = image.split(':')[0]
  const parts = noTag.split('/')
  if (parts.length === 3) return parts.slice(1).join('/') // lscr.io/ns/name → ns/name
  if (parts.length === 1) return 'library/' + noTag // nginx → library/nginx
  return noTag
}
