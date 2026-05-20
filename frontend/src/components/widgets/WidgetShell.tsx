import { useState } from 'react'
import { Rnd } from 'react-rnd'
import { motion } from 'framer-motion'
import { useWidgetStore, WIDGET_DEFAULT_SIZE } from '@/stores/widgetStore'
import { useIconStore } from '@/stores/iconStore'
import { CELL_W, CELL_H, PAD_T, PAD_L } from '@/components/DesktopIcons'
import { iconRect, widgetRect, findFreePos, snapToGridPixel } from '@/shared/gridCollision'

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
  const { widgets, moveWidget, resizeWidget, removeWidget } = useWidgetStore()
  const { icons } = useIconStore()
  const [hovered, setHovered] = useState(false)
  const [preview, setPreview] = useState<{ x: number; y: number; w: number; h: number } | null>(null)

  const w = widgets.find(x => x.id === id)
  if (!w) return null

  const otherWidgets = widgets.filter(x => x.id !== id)

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

  const previewCells: { x: number; y: number }[] = []
  if (preview) {
    const colStart = Math.round((preview.x - PAD_L) / CELL_W)
    const rowStart = Math.round((preview.y - PAD_T) / CELL_H)
    const cols = Math.max(1, Math.round(preview.w / CELL_W))
    const rows = Math.max(1, Math.round(preview.h / CELL_H))
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        previewCells.push({
          x: PAD_L + (colStart + c) * CELL_W,
          y: PAD_T + (rowStart + r) * CELL_H,
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
            border: '1px solid rgba(99,102,241,0.20)',
            background: 'rgba(99,102,241,0.06)',
            boxShadow: '0 0 16px rgba(99,102,241,0.06)',
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
        style={{ zIndex: 2, pointerEvents: 'auto' }}
      >
        <motion.div
          className="relative w-full h-full p-1.5"
          onHoverStart={() => setHovered(true)}
          onHoverEnd={() => setHovered(false)}
        >
          <motion.button
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: hovered ? 1 : 0, scale: hovered ? 1 : 0.7 }}
            transition={{ duration: 0.15 }}
            onClick={() => removeWidget(id)}
            className="absolute -top-2 -right-2 z-10 w-5 h-5 rounded-full flex items-center justify-center
                       text-[10px] text-white cursor-pointer"
            style={{ background: '#ff5f57', boxShadow: '0 2px 8px rgba(0,0,0,0.5)' }}
          >
            ×
          </motion.button>

          <div
            className="widget-handle absolute top-0 left-0 right-0 h-5 rounded-t-2xl cursor-grab active:cursor-grabbing z-10"
            style={{ background: 'transparent' }}
          />

          {children}
        </motion.div>
      </Rnd>
    </>
  )
}
