import { useRef, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { FolderSimple, PushPin } from '@phosphor-icons/react'
import { useWindowStore, type AppID, APP_META } from '@/stores/windowStore'
import { useIconStore, type DesktopIcon } from '@/stores/iconStore'
import { useDockStore } from '@/stores/dockStore'
import { APP_COLORS } from '@/shared/appColors'

export const CELL_W = 88
export const CELL_H = 96
export const PAD_T  = 56
export const PAD_R  = 48
export const PAD_L  = 48
export const PAD_B  = 48

const DRAG_THRESHOLD = 4

const DESKTOP_BG: Record<AppID, string> = Object.fromEntries(
  Object.entries(APP_COLORS).map(([k, v]) => [k, v.bg])
) as Record<AppID, string>

export function gridLayout() {
  const gridW = window.innerWidth - PAD_L - PAD_R
  const gridH = window.innerHeight - PAD_T - PAD_B
  const cols = Math.max(1, Math.floor(gridW / CELL_W))
  const rows = Math.max(1, Math.floor(gridH / CELL_H))
  const totalW = cols * CELL_W
  const totalH = rows * CELL_H
  const slackX = gridW - totalW
  const slackY = gridH - totalH
  return {
    cols,
    rows,
    originX: window.innerWidth - PAD_R - Math.round(slackX / 2),
    originY: PAD_T + Math.round(slackY / 2),
  }
}

export function gridToPixel(col: number, row: number) {
  const { originX, originY } = gridLayout()
  return {
    x: originX - (col + 1) * CELL_W,
    y: originY + row * CELL_H,
  }
}

function pixelToGrid(px: number, py: number) {
  const { originX, originY, cols, rows } = gridLayout()
  const col = Math.round((originX - px) / CELL_W) - 1
  const row = Math.round((py - originY) / CELL_H)
  return {
    col: Math.min(cols - 1, Math.max(0, col)),
    row: Math.min(rows - 1, Math.max(0, row)),
  }
}

interface LassoRect {
  startX: number; startY: number; endX: number; endY: number
}

function iconsInLasso(rect: LassoRect, icons: DesktopIcon[]): Set<string> {
  const minX = Math.min(rect.startX, rect.endX)
  const maxX = Math.max(rect.startX, rect.endX)
  const minY = Math.min(rect.startY, rect.endY)
  const maxY = Math.max(rect.startY, rect.endY)
  const sel = new Set<string>()
  for (const icon of icons) {
    const p = gridToPixel(icon.col, icon.row)
    const cx = p.x + CELL_W / 2
    const cy = p.y + CELL_H / 2
    if (cx >= minX && cx <= maxX && cy >= minY && cy <= maxY) sel.add(icon.id)
  }
  return sel
}

// ── Folder popover ────────────────────────────────────────────────────────────
function FolderPopover({ apps, onClose, onOpen }: {
  apps: AppID[]
  onClose: () => void
  onOpen: (app: AppID) => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.88, y: 6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.88 }}
      transition={{ type: 'spring', stiffness: 420, damping: 28 }}
      className="absolute bottom-full right-0 mb-3 p-2.5 rounded-2xl"
      style={{
        background:     'rgba(15,17,25,0.96)',
        backdropFilter: 'blur(24px)',
        border:         '1px solid rgba(255,255,255,0.10)',
        boxShadow:      '0 16px 48px rgba(0,0,0,0.65)',
        minWidth:       '160px',
        zIndex:         100,
      }}
      onMouseLeave={onClose}
    >
      <p className="text-[9px] text-white/30 uppercase tracking-widest mb-2 px-1">Apps</p>
      {apps.map(app => {
        const AppIcon = APP_META[app].Icon
        return (
          <button
            key={app}
            onClick={e => { e.stopPropagation(); onOpen(app); onClose() }}
            className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg
                       hover:bg-white/[0.08] transition-colors cursor-pointer text-left"
          >
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: DESKTOP_BG[app] }}
            >
              <AppIcon size={16} weight="fill" color="white" />
            </div>
            <span className="text-sm text-white/80">{APP_META[app].title}</span>
          </button>
        )
      })}
    </motion.div>
  )
}

// ── Single icon ───────────────────────────────────────────────────────────────
function IconItem({
  icon,
  isSelected,
  dragOffset,
  onIconMouseDown,
}: {
  icon: DesktopIcon
  isSelected: boolean
  dragOffset: { dx: number; dy: number } | null
  onIconMouseDown: (id: string, e: React.MouseEvent) => void
}) {
  const { openWindow } = useWindowStore()
  const [folderOpen, setFolderOpen] = useState(false)

  const pos = gridToPixel(icon.col, icon.row)

  const isFolder = icon.kind === 'folder'
  const bg = isFolder
    ? (icon.color ?? '#52525b')
    : (icon.app && DESKTOP_BG[icon.app as AppID]) ?? '#52525b'

  const AppIcon = icon.app && APP_META[icon.app] ? APP_META[icon.app].Icon : null

  const transform = dragOffset
    ? `translate(${dragOffset.dx}px, ${dragOffset.dy}px)`
    : undefined

  return (
    <div
      data-no-ctx
      onMouseDown={e => onIconMouseDown(icon.id, e)}
      onContextMenu={e => onIconMouseDown(icon.id, e)}
      className="absolute flex flex-col items-center gap-1.5 select-none"
      style={{
        width: CELL_W,
        height: CELL_H,
        cursor: 'grab',
        top: pos.y,
        left: pos.x,
        pointerEvents: 'all',
        transform,
        zIndex: isSelected ? 5 : 1,
      }}
    >
      <div className="relative flex flex-col items-center gap-1.5 w-full pt-1">

        <AnimatePresence>
          {isFolder && folderOpen && icon.apps && (
            <FolderPopover
              apps={icon.apps}
              onClose={() => setFolderOpen(false)}
              onOpen={openWindow}
            />
          )}
        </AnimatePresence>

        <motion.div
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.93 }}
          transition={{ type: 'spring', stiffness: 380, damping: 22 }}
          className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg"
          style={{
            background: bg,
            boxShadow: isSelected
              ? '0 2px 8px rgba(0,0,0,0.5), 0 0 0 2px rgba(255,255,255,0.55)'
              : '0 2px 8px rgba(0,0,0,0.45)',
            cursor: 'grab',
          }}
          onMouseDown={() => setFolderOpen(false)}
        >
          {isFolder && icon.apps ? (
            <div className="grid grid-cols-2 gap-0.5 p-1.5">
              {icon.apps.slice(0, 4).map(app => {
                const MiniIcon = APP_META[app].Icon
                return (
                  <div
                    key={app}
                    className="w-[18px] h-[18px] rounded-[3px] flex items-center justify-center"
              style={{ background: DESKTOP_BG[app] }}
                  >
                    <MiniIcon size={10} weight="fill" color="white" />
                  </div>
                )
              })}
            </div>
          ) : AppIcon ? (
            <AppIcon size={28} weight="fill" color="white" />
          ) : (
            <FolderSimple size={28} weight="fill" color="white" />
          )}
        </motion.div>

        <span
          className="text-xs text-white/85 text-center leading-tight max-w-[88px] line-clamp-2"
          style={{ textShadow: '0 1px 5px rgba(0,0,0,0.95), 0 0 16px rgba(0,0,0,0.8)' }}
        >
          {icon.label}
        </span>
      </div>
    </div>
  )
}

// ── Desktop icon layer ────────────────────────────────────────────────────────
export function DesktopIcons() {
  const icons = useIconStore(s => s.icons)
  const { moveIcons } = useIconStore()
  const validIcons = icons.filter(i => i.kind === 'folder' || (i.app && i.app in APP_META))

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [lasso, setLasso] = useState<LassoRect | null>(null)
  const [dragOffset, setDragOffset] = useState<{ dx: number; dy: number } | null>(null)
  const [ctxMenu, setCtxMenu] = useState<{ iconId: string; x: number; y: number } | null>(null)

  const { isPinned, pin, unpin } = useDockStore()

  const lassoRef      = useRef<LassoRect | null>(null)
  const validIconsRef = useRef(validIcons)
  validIconsRef.current = validIcons

  useEffect(() => {
    if (!ctxMenu) return
    const handler = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('[data-desktop-ctx]')) return
      setCtxMenu(null)
    }
    window.addEventListener('mousedown', handler)
    return () => window.removeEventListener('mousedown', handler)
  }, [ctxMenu])

  const dragStartMouseRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const dragOriginsRef    = useRef<Map<string, { col: number; row: number }>>(new Map())
  const isDragging        = dragOffset !== null

  function startLasso(e: React.MouseEvent) {
    if (e.button !== 0) return
    if (isDragging) return
    const start: LassoRect = { startX: e.clientX, startY: e.clientY, endX: e.clientX, endY: e.clientY }
    lassoRef.current = start
    setLasso(start)
    setSelectedIds(new Set())

    function onMove(ev: MouseEvent) {
      if (!lassoRef.current) return
      const updated = { ...lassoRef.current, endX: ev.clientX, endY: ev.clientY }
      lassoRef.current = updated
      setLasso({ ...updated })
    }

    function onUp() {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      const r = lassoRef.current
      lassoRef.current = null
      setLasso(null)
      if (!r) return
      const moved = Math.abs(r.endX - r.startX) > 6 || Math.abs(r.endY - r.startY) > 6
      if (moved) setSelectedIds(iconsInLasso(r, validIconsRef.current))
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  function handleIconMouseDown(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    e.preventDefault()

    const selIds = new Set(selectedIds)

    if (e.metaKey || e.ctrlKey) {
      if (selIds.has(id)) selIds.delete(id)
      else selIds.add(id)
      setSelectedIds(selIds)
    } else if (e.button === 2) {
      // right-click: select if not already in selection
      if (!selIds.has(id)) setSelectedIds(new Set([id]))
      const icon = icons.find(i => i.id === id)
      if (icon?.app) {
        setCtxMenu({ iconId: id, x: e.clientX, y: e.clientY })
      }
      return
    } else {
      if (!selIds.has(id)) {
        selIds.clear()
        selIds.add(id)
        setSelectedIds(selIds)
      }
    }

    const dragIcons = selIds.has(id) ? selIds : new Set([id])

    dragStartMouseRef.current = { x: e.clientX, y: e.clientY }
    dragOriginsRef.current = new Map()
    for (const icon of icons) {
      if (dragIcons.has(icon.id)) {
        dragOriginsRef.current.set(icon.id, { col: icon.col, row: icon.row })
      }
    }
    // start with zero offset so all selected icons get the has-drag style
    setDragOffset({ dx: 0, dy: 0 })

    function onMove(ev: MouseEvent) {
      const dx = ev.clientX - dragStartMouseRef.current.x
      const dy = ev.clientY - dragStartMouseRef.current.y
      setDragOffset({ dx, dy })
    }

    function onUp(ev: MouseEvent) {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)

      const dx = ev.clientX - dragStartMouseRef.current.x
      const dy = ev.clientY - dragStartMouseRef.current.y
      const moved = Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD

      if (moved && dragOriginsRef.current.size > 0) {
        const origin = dragOriginsRef.current.get(id)!
        const originPx = gridToPixel(origin.col, origin.row)
        const endG = pixelToGrid(originPx.x + dx, originPx.y + dy)
        const dcol = endG.col - origin.col
        const drow = endG.row - origin.row

        if (dcol !== 0 || drow !== 0) {
          const moves = Array.from(dragOriginsRef.current.entries()).map(([iid, pos]) => ({
            id: iid,
            col: pos.col + dcol,
            row: pos.row + drow,
          }))
          moveIcons(moves)
        }
      }

      setDragOffset(null)
      dragOriginsRef.current = new Map()

      // if no drag happened, treat as click
      if (!moved) {
        const icon = icons.find(i => i.id === id)
        if (icon) {
          const { openWindow } = useWindowStore.getState()
          if (icon.kind === 'folder') {
            openWindow('files')
          } else if (icon.app) {
            openWindow(icon.app)
          }
        }
      }
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const lassoStyle = lasso ? {
    left:   Math.min(lasso.startX, lasso.endX),
    top:    Math.min(lasso.startY, lasso.endY),
    width:  Math.abs(lasso.endX - lasso.startX),
    height: Math.abs(lasso.endY - lasso.startY),
  } : null

  const targetCells: { x: number; y: number }[] = []
  if (dragOffset) {
    const seen = new Set<string>()
    for (const [id, origin] of dragOriginsRef.current) {
      const opx = gridToPixel(origin.col, origin.row)
      const t = pixelToGrid(opx.x + dragOffset.dx, opx.y + dragOffset.dy)
      const key = `${t.col},${t.row}`
      if (seen.has(key)) continue
      seen.add(key)
      const p = gridToPixel(t.col, t.row)
      targetCells.push(p)
    }
  }

  return (
    <div className="fixed inset-0" style={{ zIndex: 1 }}>
      <div
        className="absolute inset-0"
        style={{ zIndex: 1, pointerEvents: isDragging ? 'none' : 'all' }}
        onMouseDown={startLasso}
        onContextMenu={e => { e.preventDefault() }}
      />

      {/* Drag target highlights */}
      <div className="absolute inset-0" style={{ zIndex: 1, pointerEvents: 'none' }}>
        {targetCells.map((cell, i) => (
          <div
            key={`dt-${i}`}
            className="absolute pointer-events-none rounded-md"
            style={{
              left: cell.x,
              top: cell.y,
              width: CELL_W,
              height: CELL_H,
              border: '1px solid rgba(99,102,241,0.20)',
              background: 'rgba(99,102,241,0.06)',
              boxShadow: '0 0 16px rgba(99,102,241,0.06)',
            }}
          />
        ))}
      </div>

      <div className="absolute inset-0" style={{ zIndex: 2, pointerEvents: 'none' }}>
        {validIcons.map(icon => (
          <IconItem
            key={icon.id}
            icon={icon}
            isSelected={selectedIds.has(icon.id)}
            dragOffset={
              selectedIds.has(icon.id) || dragOriginsRef.current.has(icon.id)
                ? dragOffset
                : null
            }
            onIconMouseDown={handleIconMouseDown}
          />
        ))}
      </div>

      {lassoStyle && (
        <div
          className="fixed pointer-events-none"
          style={{
            ...lassoStyle,
            zIndex: 9,
            border:       '1px solid rgba(96,165,250,0.65)',
            background:   'rgba(96,165,250,0.10)',
            borderRadius: 3,
          }}
        />
      )}

      {ctxMenu && createPortal(
        (() => {
          const icon = icons.find(i => i.id === ctxMenu.iconId)
          if (!icon?.app) return null
          const app = icon.app as AppID
          const pinned = isPinned(app)
          const menuW = 180
          const menuH = 40
          const x = Math.min(ctxMenu.x, window.innerWidth - menuW - 8)
          const y = Math.min(ctxMenu.y, window.innerHeight - menuH - 8)
          return (
            <div
              className="fixed py-1.5 rounded-xl select-none"
              style={{
                left: x,
                top: y,
                zIndex: 99999,
                minWidth: menuW,
                background: 'rgba(18,20,30,0.97)',
                backdropFilter: 'blur(24px)',
                border: '1px solid rgba(255,255,255,0.10)',
                boxShadow: '0 16px 48px rgba(0,0,0,0.72)',
              }}
              data-desktop-ctx
            >
              <button
                onClick={() => { pinned ? unpin(app) : pin(app); setCtxMenu(null) }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-white/80
                           hover:bg-white/[0.07] transition-colors cursor-pointer"
              >
                <PushPin size={14} weight={pinned ? 'fill' : 'regular'} />
                {pinned ? 'Unpin from Dock' : 'Pin to Dock'}
              </button>
            </div>
          )
        })(),
        document.body
      )}
    </div>
  )
}
