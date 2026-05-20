import { CELL_W, CELL_H, PAD_T, PAD_R, PAD_L, PAD_B } from '@/components/DesktopIcons'

export interface GridRect {
  x: number
  y: number
  w: number
  h: number
}

export function iconRect(col: number, row: number): GridRect {
  return {
    x: window.innerWidth - (col + 1) * CELL_W - PAD_R,
    y: PAD_T + row * CELL_H,
    w: CELL_W,
    h: CELL_H,
  }
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
  const target: GridRect = { x: startX, y: startY, w, h }
  if (!intersectsAny(target, obstacles)) return { x: startX, y: startY }

  for (let r = 1; r < 20; r++) {
    for (let dc = -r; dc <= r; dc++) {
      for (let dr = -r; dr <= r; dr++) {
        if (Math.abs(dc) !== r && Math.abs(dr) !== r) continue
        const cx = startX + dc * CELL_W
        const cy = startY + dr * CELL_H
        if (cx < PAD_L || cy < PAD_T) continue
        const gridW = window.innerWidth - PAD_L - PAD_R
        const gridH = window.innerHeight - PAD_T - PAD_B
        if (cx + w > PAD_L + gridW || cy + h > PAD_T + gridH) continue
        const candidate: GridRect = { x: cx, y: cy, w, h }
        if (!intersectsAny(candidate, obstacles)) return { x: cx, y: cy }
      }
    }
  }
  return { x: startX, y: startY }
}

export function snapToGridPixel(x: number, y: number): { x: number; y: number } {
  const gridW = window.innerWidth - PAD_L - PAD_R
  const gridH = window.innerHeight - PAD_T - PAD_B
  return {
    x: PAD_L + Math.max(0, Math.min(gridW, Math.round((x - PAD_L) / CELL_W) * CELL_W)),
    y: PAD_T + Math.max(0, Math.min(gridH, Math.round((y - PAD_T) / CELL_H) * CELL_H)),
  }
}

export function pixelToColRow(px: number, py: number): { col: number; row: number } {
  return {
    col: Math.max(0, Math.round((window.innerWidth - PAD_R - px) / CELL_W) - 1),
    row: Math.max(0, Math.round((py - PAD_T) / CELL_H)),
  }
}
