import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AppID } from './windowStore'
import { iconRect, widgetRect, rectsOverlap } from '@/shared/gridCollision'
import { useWidgetStore } from './widgetStore'

export type IconKind = 'app' | 'folder'

export interface DesktopIcon {
  id: string
  kind: IconKind
  app?: AppID
  label: string
  icon: string
  color?: string
  apps?: AppID[]
  col: number
  row: number
}

interface IconStore {
  icons: DesktopIcon[]
  moveIcon:    (id: string, col: number, row: number) => void
  moveIcons:   (moves: Array<{ id: string; col: number; row: number }>) => void
  addFolder:   (label: string, color: string, apps: AppID[]) => void
  removeIcon:  (id: string) => void
  arrangeIcons: () => void
}

const DEFAULT_ICONS: DesktopIcon[] = [
  { id: 'i-storage',   kind: 'app', app: 'storage',   label: 'Storage',   icon: 'storage',   col: 0, row: 0 },
  { id: 'i-files',     kind: 'app', app: 'files',     label: 'Files',     icon: 'files',     col: 0, row: 1 },
  { id: 'i-axis',      kind: 'app', app: 'axis',      label: 'Axis AI',   icon: 'axis',      col: 0, row: 2 },
  { id: 'i-appstore',  kind: 'app', app: 'appstore',  label: 'App Store', icon: 'appstore',  col: 0, row: 3 },
  { id: 'i-docker',    kind: 'app', app: 'docker',    label: 'Docker',    icon: 'docker',    col: 0, row: 4 },
  { id: 'i-network',   kind: 'app', app: 'network',   label: 'Network',   icon: 'network',   col: 0, row: 5 },
  { id: 'i-hardware',  kind: 'app', app: 'hardware',  label: 'Hardware',  icon: 'hardware',  col: 0, row: 6 },
  { id: 'i-settings',  kind: 'app', app: 'settings',  label: 'Settings',  icon: 'settings',  col: 0, row: 7 },
]

function getWidgetObstacles(): ReturnType<typeof widgetRect>[] {
  const widgets = useWidgetStore.getState().widgets
  return widgets.map(w => widgetRect(w))
}

function findFreeCell(
  icons: DesktopIcon[],
  preferCol: number,
  preferRow: number,
  skipId?: string,
): { col: number; row: number } {
  const occupied = new Set(icons.filter(i => i.id !== skipId).map(i => `${i.col},${i.row}`))
  return findFreeCellWithOccupied(preferCol, preferRow, occupied)
}

function findFreeCellForMove(
  icons: DesktopIcon[],
  preferCol: number,
  preferRow: number,
  skipId: string,
  extraOccupied: Set<string>,
): { col: number; row: number } {
  const occupied = new Set(icons.filter(i => i.id !== skipId).map(i => `${i.col},${i.row}`))
  for (const cell of extraOccupied) occupied.add(cell)
  return findFreeCellWithOccupied(preferCol, preferRow, occupied)
}

function findFreeCellWithOccupied(
  preferCol: number,
  preferRow: number,
  occupied: Set<string>,
): { col: number; row: number } {
  const widgetRects = getWidgetObstacles()

  function collides(col: number, row: number): boolean {
    if (occupied.has(`${col},${row}`)) return true
    const ir = iconRect(col, row)
    for (const wr of widgetRects) {
      if (rectsOverlap(ir, wr)) return true
    }
    return false
  }

  if (!collides(preferCol, preferRow)) return { col: preferCol, row: preferRow }

  for (let r = 0; r < 20; r++) {
    for (let c = 0; c < 8; c++) {
      if (!collides(c, r)) return { col: c, row: r }
    }
  }
  return { col: preferCol, row: preferRow }
}

export const useIconStore = create<IconStore>()(
  persist(
    (set, get) => ({
      icons: DEFAULT_ICONS,

      moveIcon(id, col, row) {
        const icons = get().icons
        const clamped = findFreeCell(icons, Math.max(0, col), Math.max(0, row), id)
        set(s => ({ icons: s.icons.map(i => i.id === id ? { ...i, ...clamped } : i) }))
      },

      moveIcons(moves) {
        const moveMap = new Map(moves.map(m => [m.id, m]))
        set(s => {
          let resolved = [...s.icons]
          const used = new Set<string>()
          // resolve one by one, tracking which cells become occupied
          for (const m of moves) {
            const idx = resolved.findIndex(i => i.id === m.id)
            if (idx === -1) continue
            const preferCol = Math.max(0, m.col)
            const preferRow = Math.max(0, m.row)
            const clamped = findFreeCellForMove(resolved, preferCol, preferRow, m.id, used)
            used.add(`${clamped.col},${clamped.row}`)
            resolved[idx] = { ...resolved[idx], col: clamped.col, row: clamped.row }
          }
          return { icons: resolved }
        })
      },

      addFolder(label, color, apps) {
        const icons = get().icons
        const pos = findFreeCell(icons, 1, 0)
        const id = `folder-${Date.now()}`
        set(s => ({
          icons: [...s.icons, {
            id, kind: 'folder', label, icon: 'folder', color, apps, ...pos,
          }],
        }))
      },

      removeIcon(id) {
        set(s => ({ icons: s.icons.filter(i => i.id !== id) }))
      },

      arrangeIcons() {
        const icons = get().icons
        const widgetRects = getWidgetObstacles()

        function collides(row: number, skipId: string): boolean {
          for (const ir of [iconRect(0, row)]) {
            for (const wr of widgetRects) {
              if (rectsOverlap(ir, wr)) return true
            }
          }
          return false
        }

        let nextRow = 0
        const arranged = icons.map((icon) => {
          while (collides(nextRow, icon.id)) {
            nextRow++
          }
          const r = { ...icon, col: 0, row: nextRow }
          nextRow++
          return r
        })

        set({ icons: arranged })
      },
    }),
    { name: 'kura-desktop-icons', version: 2 }
  )
)
