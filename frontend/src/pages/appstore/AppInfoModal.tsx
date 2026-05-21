import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Star, Download, Tag, ExternalLink, ChevronLeft, ChevronRight, Shield } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { appsApi } from '@/api/client'
import { AppDetail } from './AppDetail'
import type { AppTemplate } from './AppStorePage'

interface HubDetails extends AppTemplate {
  logo_url?: string
  full_description?: string
  last_updated?: string
  tags?: string[]
  screenshots?: string[]
  pull_count_raw?: number
}

interface Props {
  app: AppTemplate
  hubRef?: string // namespace/name for Docker Hub
  onClose: () => void
  onInstalled: () => void
}

export function AppInfoModal({ app, hubRef, onClose, onInstalled }: Props) {
  const [showInstall, setShowInstall] = useState(false)
  const [screenshotIdx, setScreenshotIdx] = useState(0)

  const ref = hubRef ?? deriveHubRef(app.image)

  const { data: details } = useQuery<HubDetails>({
    queryKey: ['hub-details', ref],
    queryFn: () => appsApi.hubDetails(ref).then(r => r.data),
    enabled: !!ref,
    staleTime: 60 * 60 * 1000,
  })

  const d = details ?? app as HubDetails
  const screenshots = d.screenshots ?? []
  const tags = d.tags ?? []
  const logoUrl = d.logo_url

  const nextShot = () => setScreenshotIdx(i => (i + 1) % screenshots.length)
  const prevShot = () => setScreenshotIdx(i => (i - 1 + screenshots.length) % screenshots.length)

  if (showInstall) {
    return (
      <AppDetail
        app={d}
        onClose={() => setShowInstall(false)}
        onInstalled={() => { onInstalled(); onClose() }}
      />
    )
  }

  return (
    <motion.div
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: 20000, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <motion.div
        className="flex flex-col overflow-hidden"
        style={{
          width: 680,
          maxHeight: '88vh',
          borderRadius: 20,
          background: 'rgba(12,14,22,0.82)',
          backdropFilter: 'blur(32px) saturate(1.5)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.6), 0 0 0 0.5px rgba(255,255,255,0.04) inset',
        }}
        initial={{ scale: 0.94, y: 12 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.94, y: 12 }}
        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
      >
        {/* ── Hero / Screenshot area ── */}
        <div className="relative flex-shrink-0" style={{ height: 220 }}>
          {screenshots.length > 0 ? (
            <>
              <img
                key={screenshotIdx}
                src={screenshots[screenshotIdx]}
                alt="screenshot"
                className="w-full h-full object-cover"
                onError={e => { (e.target as HTMLElement).style.display = 'none' }}
              />
              <div
                className="absolute inset-0"
                style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(13,15,24,0.85) 100%)' }}
              />
              {screenshots.length > 1 && (
                <>
                  <button
                    onClick={prevShot}
                    className="absolute left-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full transition-colors"
                    style={{ background: 'rgba(0,0,0,0.5)', color: 'white' }}
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    onClick={nextShot}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full transition-colors"
                    style={{ background: 'rgba(0,0,0,0.5)', color: 'white' }}
                  >
                    <ChevronRight size={16} />
                  </button>
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1">
                    {screenshots.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setScreenshotIdx(i)}
                        className="w-1.5 h-1.5 rounded-full transition-all"
                        style={{ background: i === screenshotIdx ? 'white' : 'rgba(255,255,255,0.35)' }}
                      />
                    ))}
                  </div>
                </>
              )}
            </>
          ) : (
            // Gradient hero when no screenshots
            <div
              className="w-full h-full flex items-center justify-center"
              style={{ background: heroGradient(app.category) }}
            >
              {logoUrl ? (
                <img src={logoUrl} alt={d.name} className="h-20 w-20 object-contain rounded-2xl" />
              ) : (
                <span style={{ fontSize: 64 }}>{app.icon}</span>
              )}
            </div>
          )}

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-1.5 rounded-full text-white/70 hover:text-white transition-colors"
            style={{ background: 'rgba(0,0,0,0.5)' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* ── App header ── */}
        <div className="flex items-start gap-4 px-6 pt-5 pb-4 border-b border-white/5">
          {/* Logo (shown when screenshots exist) */}
          {screenshots.length > 0 && (
            <div
              className="flex-shrink-0 w-14 h-14 rounded-xl flex items-center justify-center overflow-hidden"
              style={{ background: heroGradient(app.category) }}
            >
              {logoUrl
                ? <img src={logoUrl} alt={d.name} className="w-12 h-12 object-contain" />
                : <span style={{ fontSize: 28 }}>{app.icon}</span>
              }
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-white font-semibold text-xl">{d.name}</h2>
              {d.is_official && (
                <span
                  className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981' }}
                >
                  <Shield size={10} /> Official
                </span>
              )}
              {d.source && (
                <span
                  className="text-xs px-2 py-0.5 rounded-full"
                  style={sourceBadgeStyle(d.source)}
                >
                  {d.source === 'builtin' ? 'Featured' : d.source === 'community' ? 'Community' : 'Docker Hub'}
                </span>
              )}
            </div>

            {/* Stats row */}
            <div className="flex items-center gap-4 mt-1.5">
              {(d.stars ?? 0) > 0 && (
                <span className="flex items-center gap-1 text-sm text-white/40">
                  <Star size={13} className="text-yellow-400/70" />
                  {(d.stars ?? 0).toLocaleString()}
                </span>
              )}
              {d.pulls && (
                <span className="flex items-center gap-1 text-sm text-white/40">
                  <Download size={13} />
                  {d.pulls} pulls
                </span>
              )}
              <span
                className="text-xs px-2 py-0.5 rounded-full capitalize"
                style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.40)' }}
              >
                {d.category}
              </span>
            </div>
          </div>

          {/* Install button */}
          <button
            onClick={() => setShowInstall(true)}
            className="flex-shrink-0 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
            style={{ background: 'linear-gradient(135deg,#d97706,#b45309)', boxShadow: '0 4px 16px rgba(217,119,6,0.35)' }}
          >
            Install
          </button>
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">

          {/* Description */}
          <section>
            <p className="text-sm text-white/65 leading-relaxed">
              {d.description || 'No description available.'}
            </p>
          </section>

          {/* Full description excerpt */}
          {d.full_description && d.full_description !== d.description && (
            <section>
              <h3 className="text-xs font-semibold text-white/30 uppercase tracking-wider mb-2">About</h3>
              <p className="text-sm text-white/50 leading-relaxed whitespace-pre-wrap">
                {cleanMarkdown(d.full_description).slice(0, 800)}
                {cleanMarkdown(d.full_description).length > 800 ? '…' : ''}
              </p>
            </section>
          )}

          {/* Image + tags */}
          <section className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold text-white/30 uppercase tracking-wider">Image</h3>
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-lg font-mono text-sm text-white/60"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              {d.image}
            </div>
          </section>

          {/* Tags */}
          {tags.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold text-white/30 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Tag size={11} /> Tags
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {tags.map(tag => (
                  <span
                    key={tag}
                    className="text-xs px-2 py-1 rounded-lg font-mono"
                    style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.45)' }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* Links */}
          <section className="flex items-center gap-4 pb-2">
            {d.image && !d.image.includes('ghcr.io') && !d.image.includes('lscr.io') && (
              <a
                href={`https://hub.docker.com/r/${deriveHubRef(d.image)}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition-colors"
              >
                <ExternalLink size={12} /> Docker Hub
              </a>
            )}
            {d.last_updated && (
              <span className="text-xs text-white/20">
                Updated {formatRelativeDate(d.last_updated)}
              </span>
            )}
          </section>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────

function deriveHubRef(image: string): string {
  // Strip tag
  const noTag = image.split(':')[0]
  // Strip non-hub registry prefix
  if (noTag.includes('/') && noTag.split('/').length === 3) {
    // e.g. lscr.io/linuxserver/transmission → linuxserver/transmission
    return noTag.split('/').slice(1).join('/')
  }
  // official image (no slash) → library/name
  if (!noTag.includes('/')) {
    return 'library/' + noTag
  }
  return noTag
}

function cleanMarkdown(md: string): string {
  return md
    .replace(/!\[.*?\]\(.*?\)/g, '') // images
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links → text
    .replace(/#{1,6}\s/g, '') // headings
    .replace(/[*_`~]{1,3}/g, '') // bold/italic/code
    .replace(/^\s*[-*+]\s/gm, '• ') // lists
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function heroGradient(category: string): string {
  const map: Record<string, string> = {
    media:      'linear-gradient(135deg,#1e1b4b,#312e81)',
    sync:       'linear-gradient(135deg,#0c4a6e,#0369a1)',
    dev:        'linear-gradient(135deg,#14532d,#166534)',
    security:   'linear-gradient(135deg,#450a0a,#7f1d1d)',
    network:    'linear-gradient(135deg,#431407,#7c2d12)',
    home:       'linear-gradient(135deg,#1c1917,#44403c)',
    monitoring: 'linear-gradient(135deg,#1a1a2e,#16213e)',
    download:   'linear-gradient(135deg,#0f172a,#1e293b)',
    productivity:'linear-gradient(135deg,#2e1065,#4a044e)',
    files:      'linear-gradient(135deg,#0c4a6e,#075985)',
    finance:    'linear-gradient(135deg,#14532d,#052e16)',
    other:      'linear-gradient(135deg,#18181b,#27272a)',
  }
  return map[category] ?? map.other
}

function sourceBadgeStyle(source: string): React.CSSProperties {
  if (source === 'builtin')   return { background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }
  if (source === 'community') return { background: 'rgba(139,92,246,0.15)', color: '#8b5cf6' }
  return { background: 'rgba(56,189,248,0.15)', color: '#38bdf8' }
}

function formatRelativeDate(iso: string): string {
  try {
    const d = new Date(iso)
    const diff = Date.now() - d.getTime()
    const days = Math.floor(diff / 86400000)
    if (days === 0) return 'today'
    if (days === 1) return 'yesterday'
    if (days < 30) return `${days} days ago`
    if (days < 365) return `${Math.floor(days / 30)} months ago`
    return `${Math.floor(days / 365)} years ago`
  } catch {
    return iso
  }
}
