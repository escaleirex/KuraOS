import { createPortal } from 'react-dom'
import { useEffect, useRef, useState } from 'react'
import { Rnd } from 'react-rnd'
import { motion, AnimatePresence } from 'framer-motion'
import { useWidgetStore, WIDGET_DEFAULT_SIZE, type WidgetInstance } from '@/stores/widgetStore'
import { useIconStore } from '@/stores/iconStore'
import { CELL_W, CELL_H, CELL_GAP, gridLayout } from '@/shared/gridConstants'
import { iconRect, widgetRect, findFreePos, snapToGridPixel } from '@/shared/gridCollision'
import { X, Gear } from '@phosphor-icons/react'

interface Pos { x: number; y: number }

const MENU_STYLE: React.CSSProperties = {
  minWidth:       '160px',
  background:     'var(--kura-menu-bg)',
  backdropFilter: 'blur(24px)',
  border:         '1px solid var(--kura-alpha-10)',
  boxShadow:      '0 16px 48px rgba(0,0,0,0.7)',
}

interface Props {
  id: string
  children: React.ReactNode
}

function snapSizeToGrid(w: number, h: number) {
  return {
    w: Math.max(1, Math.round(w / CELL_W)) * CELL_W,
    h: Math.max(1, Math.round(h / CELL_H)) * CELL_H,
  }
}

function buildObstacles(
  icons: { col: number; row: number }[],
  widgets: Array<{ x: number; y: number; w: number; h: number; id: string }>,
  excludeWidgetId?: string,
) {
  const rects = icons.map(i => iconRect(i.col, i.row))
  for (const w of widgets) {
    if (w.id === excludeWidgetId) continue
    rects.push(widgetRect(w))
  }
  return rects
}

export function WidgetShell({ id, children }: Props) {
  const { widgets, moveWidget, resizeWidget, removeWidget, openSettings } = useWidgetStore()
  const { icons } = useIconStore()
  const [hovered, setHovered] = useState(false)
  const [preview, setPreview] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const [menuPos, setMenuPos] = useState<Pos | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuPos(null)
      }
    }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [])

  const w = widgets.find((x: WidgetInstance) => x.id === id)
  if (!w) return null

  const otherWidgets = widgets.filter((x: WidgetInstance) => x.id !== id)

  function onDrop(_e: any, d: { x: number; y: number }) {
    setPreview(null)
    const snapped = snapToGridPixel(d.x, d.y)
    const obstacles = buildObstacles(icons, otherWidgets)
    const free = findFreePos(snapped.x, snapped.y, w.w, w.h, obstacles)
    moveWidget(id, free.x, free.y)
  }

  function onDrag(_e: any, d: { x: number; y: number }) {
    const snapped = snapToGridPixel(d.x, d.y)
    setPreview({ x: snapped.x, y: snapped.y, w: w.w, h: w.h })
  }

  function onResizeStop(_e: any, _dir: any, ref: HTMLElement, _delta: any, pos: { x: number; y: number }) {
    setPreview(null)
    const { w: sw, h: sh } = snapSizeToGrid(ref.offsetWidth, ref.offsetHeight)
    const { x, y } = snapToGridPixel(pos.x, pos.y)
    const obstacles = buildObstacles(icons, otherWidgets)
    const free = findFreePos(x, y, sw, sh, obstacles)
    resizeWidget(id, sw, sh, free.x, free.y)
  }

  function onResizing(_e: any, _dir: any, ref: HTMLElement, _delta: any, pos: { x: number; y: number }) {
    const snapped = snapToGridPixel(pos.x, pos.y)
    setPreview({ x: snapped.x, y: snapped.y, w: ref.offsetWidth, h: ref.offsetHeight })
  }

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    const mW = 160, mH = 48
    setMenuPos({
      x: Math.min(e.clientX, window.innerWidth - mW - 8),
      y: Math.min(e.clientY, window.innerHeight - mH - 8),
    })
  }

  const previewCells: { x: number; y: number }[] = []
  if (preview) {
    const { originX, originY, cols: gridCols } = gridLayout()
    const gridLeft = originX - gridCols * CELL_W
    const colStart = Math.round((preview.x - gridLeft) / CELL_W)
    const rowStart = Math.round((preview.y - originY) / CELL_H)
    const cols = Math.max(1, Math.round(preview.w / CELL_W))
    const rows = Math.max(1, Math.round(preview.h / CELL_H))
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        previewCells.push({
          x: gridLeft + (colStart + c) * CELL_W,
          y: originY + (rowStart + r) * CELL_H,
        })
      }
    }
  }

  return (
    <>
      {previewCells.map((cell, i) => (
        <div
          key={`wp-${id}-${i}`}
          className="fixed pointer-events-none rounded-md"
          style={{
            left: cell.x,
            top: cell.y,
            width: CELL_W,
            height: CELL_H,
            zIndex: 1,
            border: '1px solid color-mix(in srgb, var(--kura-accent) 20%, transparent)',
            background: 'color-mix(in srgb, var(--kura-accent) 6%, transparent)',
            boxShadow: '0 0 16px color-mix(in srgb, var(--kura-accent) 6%, transparent)',
          }}
        />
      ))}
      <Rnd
        position={{ x: w.x, y: w.y }}
        size={{ width: w.w, height: w.h }}
        minWidth={WIDGET_DEFAULT_SIZE[w.type].minW}
        minHeight={WIDGET_DEFAULT_SIZE[w.type].minH}
        resizeGrid={[CELL_W, CELL_H]}
        dragHandleClassName="widget-handle"
        bounds="window"
        onDrag={onDrag}
        onDragStop={onDrop}
        onResize={onResizing}
        onResizeStop={onResizeStop}
        onContextMenu={handleContextMenu}
        data-no-ctx
        style={{ zIndex: 2, pointerEvents: 'auto' }}
      >
        {/* close button at cell boundary (outside the gap inset) */}
        <motion.button
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: hovered ? 1 : 0, scale: hovered ? 1 : 0.7 }}
          transition={{ duration: 0.15 }}
          onClick={() => removeWidget(id)}
          className="absolute z-10 w-5 h-5 rounded-full flex items-center justify-center
                     text-[10px] text-white cursor-pointer"
          style={{
            top: CELL_GAP / 2 - 8,
            right: CELL_GAP / 2 - 8,
            background: '#ff5f57',
            boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
          }}
        >
          ×
        </motion.button>

        {/* inset wrapper — creates consistent gap matching icon cell spacing */}
        <motion.div
          className="absolute"
          style={{ inset: CELL_GAP / 2 }}
          onHoverStart={() => setHovered(true)}
          onHoverEnd={() => setHovered(false)}
        >
          <div
            className="widget-handle absolute top-0 left-0 right-0 h-5 rounded-t-2xl cursor-grab active:cursor-grabbing z-10"
            style={{ background: 'transparent' }}
          />

          <div className="relative w-full h-full p-1.5">
            {children}
          </div>
        </motion.div>
      </Rnd>

      {menuPos && typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          <motion.div
            ref={menuRef}
            data-no-ctx
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={{ duration: 0.12 }}
            className="fixed py-1.5 rounded-xl select-none"
            style={{ left: menuPos.x, top: menuPos.y, zIndex: 9600, ...MENU_STYLE }}
          >
            <button
              onClick={() => { openSettings(id); setMenuPos(null) }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-white/80
                         hover:bg-white/[0.07] transition-colors cursor-pointer"
            >
              <Gear size={14} /> Settings
            </button>
            <div className="h-px bg-white/[0.06] mx-2 my-1" />
            <button
              onClick={() => { removeWidget(id); setMenuPos(null) }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-400
                         hover:bg-white/[0.07] transition-colors cursor-pointer"
            >
              <X size={14} /> Remove Widget
            </button>
          </motion.div>
        </AnimatePresence>,
        document.body
      )}
    </>
  )
}
