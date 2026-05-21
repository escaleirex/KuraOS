import { CELL_W, CELL_H, gridLayout, gridToPixel } from '@/shared/gridConstants'

export interface GridRect {
  x: number
  y: number
  w: number
  h: number
}

export function iconRect(col: number, row: number): GridRect {
  const p = gridToPixel(col, row)
  return { x: p.x, y: p.y, w: CELL_W, h: CELL_H }
}

export function widgetRect(w: { x: number; y: number; w: number; h: number }): GridRect {
  return { x: w.x, y: w.y, w: w.w, h: w.h }
}

export function rectsOverlap(a: GridRect, b: GridRect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x &&
         a.y < b.y + b.h && a.y + a.h > b.y
}

export function intersectsAny(
  target: GridRect,
  obstacles: GridRect[],
): boolean {
  for (const o of obstacles) {
    if (rectsOverlap(target, o)) return true
  }
  return false
}

export function findFreePos(
  startX: number,
  startY: number,
  w: number,
  h: number,
  obstacles: GridRect[],
): { x: number; y: number } {
  const { originX, originY, cols, rows } = gridLayout()
  const gridLeft = originX - cols * CELL_W
  const target: GridRect = { x: startX, y: startY, w, h }
  if (!intersectsAny(target, obstacles)) return { x: startX, y: startY }

  for (let r = 1; r < 20; r++) {
    for (let dc = -r; dc <= r; dc++) {
      for (let dr = -r; dr <= r; dr++) {
        if (Math.abs(dc) !== r && Math.abs(dr) !== r) continue
        const cx = startX + dc * CELL_W
        const cy = startY + dr * CELL_H
        if (cx < gridLeft || cy < originY) continue
        if (cx + w > originX || cy + h > originY + rows * CELL_H) continue
        const candidate: GridRect = { x: cx, y: cy, w, h }
        if (!intersectsAny(candidate, obstacles)) return { x: cx, y: cy }
      }
    }
  }
  return { x: startX, y: startY }
}

export function snapToGridPixel(x: number, y: number): { x: number; y: number } {
  const { originX, originY, cols, rows } = gridLayout()
  const gridLeft = originX - cols * CELL_W
  return {
    x: gridLeft + Math.round((x - gridLeft) / CELL_W) * CELL_W,
    y: originY + Math.round((y - originY) / CELL_H) * CELL_H,
  }
}

export function pixelToColRow(px: number, py: number): { col: number; row: number } {
  const { originX, originY } = gridLayout()
  return {
    col: Math.max(0, Math.round((originX - px) / CELL_W) - 1),
    row: Math.max(0, Math.round((py - originY) / CELL_H)),
  }
}
