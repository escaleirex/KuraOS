import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { PushPin, X } from '@phosphor-icons/react'
import { useWindowStore, type AppID, APP_META } from '@/stores/windowStore'
import { useDockStore } from '@/stores/dockStore'
import { APP_COLORS as SHARED_COLORS } from '@/shared/appColors'

const APP_COLORS: Record<AppID, { bg: string; glow: string }> = Object.fromEntries(
  Object.entries(SHARED_COLORS).map(([k, v]) => [k, { bg: v.gradient, glow: v.glow }])
) as Record<AppID, { bg: string; glow: string }>

const MENU_STYLE: React.CSSProperties = {
  minWidth:       '168px',
  background:     'var(--kura-menu-bg)',
  backdropFilter: 'blur(24px)',
  border:         '1px solid var(--kura-alpha-10)',
  boxShadow:      '0 16px 48px rgba(0,0,0,0.72)',
}

// ── Window preview popup ──────────────────────────────────────────────────────
function WindowPreview({ app, onClose }: {
  app:     AppID
  onClose: (id: string) => void
}) {
  const windows       = useWindowStore(s => s.windows.filter(w => w.app === app && !w.closing))
  const restoreWindow = useWindowStore(s => s.restoreWindow)
  const bringToFront  = useWindowStore(s => s.bringToFront)
  const colors        = APP_COLORS[app]
  const AppIcon       = APP_META[app].Icon

  if (windows.length === 0) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.94 }}
      transition={{ type: 'spring', stiffness: 420, damping: 28 }}
      className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 flex gap-2 pointer-events-auto"
      style={{ zIndex: 8100 }}
    >
      {windows.map(win => (
        <div
          key={win.id}
          className="flex flex-col rounded-xl overflow-hidden cursor-pointer select-none"
          style={{
            width:      160,
            background: 'var(--kura-menu-bg)',
            border:     '1px solid var(--kura-alpha-10)',
            boxShadow:  '0 8px 32px rgba(0,0,0,0.65)',
          }}
          onClick={() => {
            if (win.minimized) restoreWindow(win.id)
            else bringToFront(win.id)
          }}
        >
          {/* Mini chrome */}
          <div
            className="flex items-center justify-between px-2.5 py-1.5"
            style={{ background: 'var(--kura-alpha-04)', borderBottom: '1px solid var(--kura-alpha-06)' }}
          >
            <span className="text-[10px] text-white/50 truncate max-w-[112px]">{win.title}</span>
            <button
              onClick={e => { e.stopPropagation(); onClose(win.id) }}
              className="w-3.5 h-3.5 rounded-full flex items-center justify-center ml-1
                         hover:bg-red-500/80 transition-colors text-white/30 hover:text-white text-[8px]"
            >✕</button>
          </div>

          {/* Preview area */}
          <div
            className="flex items-center justify-center"
            style={{ height: 90, background: 'var(--kura-menu-bg)' }}
          >
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center"
              style={{ background: colors.bg, boxShadow: `0 4px 20px ${colors.glow}44` }}
            >
              <AppIcon size={24} weight="fill" color="white" />
            </div>
          </div>

          {win.minimized && (
            <div className="text-center text-[9px] text-white/30 py-1">minimized</div>
          )}
        </div>
      ))}
    </motion.div>
  )
}

// ── Right-click context menu ──────────────────────────────────────────────────
function DockItemMenu({ app, pos, onClose }: {
  app:     AppID
  pos:     { x: number; y: number }
  onClose: () => void
}) {
  const { pin, unpin, isPinned } = useDockStore()
  const { closeWindow, windows } = useWindowStore()
  const pinned   = isPinned(app)
  const openWins = windows.filter(w => w.app === app && !w.closing)

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.92 }}
      transition={{ duration: 0.1 }}
      className="fixed py-1.5 rounded-xl select-none"
      style={{ left: pos.x, top: pos.y, zIndex: 9500, ...MENU_STYLE }}
      data-no-ctx
      data-dock-menu
    >
      <button
        onClick={() => { pinned ? unpin(app) : pin(app); onClose() }}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-white/80
                   hover:bg-white/[0.07] transition-colors cursor-pointer"
      >
        <PushPin size={14} weight={pinned ? 'fill' : 'regular'} />
        {pinned ? 'Unpin from Dock' : 'Pin to Dock'}
      </button>

      {openWins.length > 0 && (
        <>
          <div className="h-px bg-white/[0.06] mx-2 my-1" />
          {openWins.map(win => (
            <button
              key={win.id}
              onClick={() => { closeWindow(win.id); onClose() }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-white/55
                         hover:bg-white/[0.07] transition-colors cursor-pointer"
            >
              <X size={14} weight="fill" />
              Close {openWins.length > 1 ? `"${win.title}"` : 'Window'}
            </button>
          ))}
        </>
      )}
    </motion.div>
  )
}

// ── Individual dock item ──────────────────────────────────────────────────────
function DockItem({ app }: { app: AppID }) {
  const { openWindow, windows, closeWindow } = useWindowStore()
  const meta   = APP_META[app]
  const colors = APP_COLORS[app]

  const openWins    = windows.filter(w => w.app === app && !w.closing)
  const isOpen      = openWins.some(w => !w.minimized)
  const isMinimized = openWins.length > 0 && openWins.every(w => w.minimized)
  const isAny       = openWins.length > 0

  const [showPreview, setShowPreview] = useState(false)
  const [menuPos, setMenuPos]         = useState<{ x: number; y: number } | null>(null)
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleMouseEnter() {
    if (!isAny) return
    hoverTimer.current = setTimeout(() => setShowPreview(true), 180)
  }
  function handleMouseLeave() {
    if (hoverTimer.current) clearTimeout(hoverTimer.current)
    setShowPreview(false)
  }
  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    const menuH = openWins.length > 0 ? 80 + openWins.length * 36 : 44
    const y = Math.min(e.clientY, window.innerHeight - menuH - 8)
    setMenuPos({ x: Math.min(e.clientX, window.innerWidth - 180), y: Math.max(8, y) })
  }

  useEffect(() => {
    if (!menuPos) return
    const handler = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('[data-dock-menu]')) return
      setMenuPos(null)
    }
    window.addEventListener('mousedown', handler)
    return () => window.removeEventListener('mousedown', handler)
  }, [menuPos])

  return (
    <div
      className="relative flex flex-col items-center gap-[5px]"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onContextMenu={handleContextMenu}
      data-no-ctx
    >
      {/* Tooltip */}
      <div
        className="absolute -top-9 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-md text-xs
                   text-white/90 whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100
                   transition-opacity duration-150"
        style={{ background: 'var(--kura-menu-bg)', border: '1px solid var(--kura-alpha-10)' }}
      >
        {meta.title}
      </div>

      {/* Window preview */}
      <AnimatePresence>
        {showPreview && isAny && (
          <WindowPreview app={app} onClose={closeWindow} />
        )}
      </AnimatePresence>

      {/* Right-click menu */}
      {createPortal(
        <AnimatePresence>
          {menuPos && (
            <DockItemMenu app={app} pos={menuPos} onClose={() => setMenuPos(null)} />
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* Icon */}
      <motion.button
        onClick={() => openWindow(app)}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.94 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        className="w-12 h-12 rounded-xl flex items-center justify-center select-none cursor-pointer relative"
        style={{
          background: colors.bg,
          boxShadow:  isOpen
            ? `0 0 18px ${colors.glow}55, 0 2px 8px rgba(0,0,0,0.5)`
            : '0 2px 8px rgba(0,0,0,0.45)',
          outline: 'none',
        }}
        title={meta.title}
      >
        <meta.Icon size={22} weight="fill" color="white" />
        {isMinimized && (
          <div className="absolute inset-0 rounded-xl" style={{ background: 'var(--kura-overlay)' }} />
        )}
      </motion.button>

      {/* Active dot */}
      <div className="flex gap-[3px] h-1">
        {isOpen ? (
          <div
            className="w-1 h-1 rounded-full"
            style={{ background: colors.glow, boxShadow: `0 0 4px ${colors.glow}` }}
          />
        ) : isMinimized ? (
          <div className="w-1 h-1 rounded-full bg-white/30" />
        ) : (
          <div className="w-1 h-1" />
        )}
      </div>
    </div>
  )
}

// ── Dock ──────────────────────────────────────────────────────────────────────
export function Dock() {
  const windows    = useWindowStore(s => s.windows)
  const { pinned } = useDockStore()
  const [isHovered, setIsHovered] = useState(false)

  const isAnyMaximized = windows.some(w => w.maximized && !w.minimized && !w.closing)
  const isVisible      = !isAnyMaximized || isHovered

  // Open apps that are NOT pinned
  const openUnpinned = [...new Set(
    windows
      .filter(w => !w.closing && !pinned.includes(w.app))
      .map(w => w.app)
  )]

  return (
    <>
      {isAnyMaximized && (
        <div
          className="fixed bottom-0 left-0 right-0 h-4 bg-transparent"
          style={{ zIndex: 7999 }}
          onMouseEnter={() => setIsHovered(true)}
        />
      )}

      <motion.div
        className="fixed bottom-0 left-0 right-0 flex justify-center pb-2"
        style={{ zIndex: 8000 }}
        animate={{ y: isVisible ? 0 : 90 }}
        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div
          className="flex items-center gap-2.5 px-3 py-2 rounded-2xl"
          style={{
            background:     'var(--kura-menu-bg)',
            backdropFilter: 'blur(24px) saturate(1.6)',
            border:         '1px solid var(--kura-alpha-08)',
            boxShadow:      '0 -1px 0 var(--kura-alpha-04), 0 8px 32px rgba(0,0,0,0.6)',
          }}
        >
          {/* Pinned apps */}
          {pinned.map(app => (
            <div key={app} className="group">
              <DockItem app={app} />
            </div>
          ))}

          {/* Separator + open non-pinned */}
          {openUnpinned.length > 0 && (
            <>
              <div className="flex items-center self-stretch px-0.5">
                <div
                  className="w-px self-stretch rounded-full"
                  style={{ background: 'var(--kura-alpha-13)' }}
                />
              </div>
              {openUnpinned.map(app => (
                <div key={app} className="group">
                  <DockItem app={app} />
                </div>
              ))}
            </>
          )}
        </div>
      </motion.div>
    </>
  )
}
