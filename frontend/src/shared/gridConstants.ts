export const CELL_W   = 88
export const CELL_H   = 96
export const CELL_GAP = 8   // visual gap between adjacent grid elements (4px per side)
export const PAD_T    = 56
export const PAD_R    = 48
export const PAD_L    = 48
export const PAD_B    = 48

export function gridLayout() {
  const gridW = window.innerWidth  - PAD_L - PAD_R
  const gridH = window.innerHeight - PAD_T - PAD_B
  const cols  = Math.max(1, Math.floor(gridW / CELL_W))
  const rows  = Math.max(1, Math.floor(gridH / CELL_H))
  const slackX = gridW - cols * CELL_W
  const slackY = gridH - rows * CELL_H
  return {
    cols,
    rows,
    originX: window.innerWidth  - PAD_R - Math.round(slackX / 2),
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
