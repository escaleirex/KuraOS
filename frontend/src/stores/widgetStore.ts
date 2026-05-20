import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type React from 'react'
import { Clock, ChartLine } from '@phosphor-icons/react'

export type WidgetType = 'clock' | 'metrics'
type WidgetIcon = React.ComponentType<{ size?: number; weight?: string; className?: string }>

// Grid constants (must match DesktopIcons.tsx)
const CELL_W = 88
const CELL_H = 96
const PAD_T  = 40

export interface WidgetInstance {
  id: string
  type: WidgetType
  x: number
  y: number
  w: number  // width in pixels (grid-snapped)
  h: number  // height in pixels (grid-snapped)
}

interface WidgetStore {
  widgets: WidgetInstance[]
  addWidget:    (type: WidgetType) => void
  removeWidget: (id: string) => void
  moveWidget:   (id: string, x: number, y: number) => void
  resizeWidget: (id: string, w: number, h: number, x: number, y: number) => void
}

// Default sizes grid-snapped: clock 2×1, metrics 3×2
const DEFAULT_WIDGETS: WidgetInstance[] = [
  { id: 'w-clock',   type: 'clock',   x: 0, y: PAD_T,           w: CELL_W * 2, h: CELL_H     },
  { id: 'w-metrics', type: 'metrics', x: 0, y: PAD_T + CELL_H,  w: CELL_W * 3, h: CELL_H * 2 },
]

export const WIDGET_META: Record<WidgetType, { label: string; Icon: WidgetIcon }> = {
  clock:   { label: 'Clock',          Icon: Clock     },
  metrics: { label: 'System Metrics', Icon: ChartLine },
}

// Default size and minimum size per widget type
export const WIDGET_DEFAULT_SIZE: Record<WidgetType, { w: number; h: number; minW: number; minH: number }> = {
  clock:   { w: CELL_W * 2, h: CELL_H,     minW: CELL_W,     minH: CELL_H     },
  metrics: { w: CELL_W * 3, h: CELL_H * 2, minW: CELL_W * 2, minH: CELL_H * 2 },
}

export const useWidgetStore = create<WidgetStore>()(
  persist(
    (set) => ({
      widgets: DEFAULT_WIDGETS,

      addWidget(type) {
        const size = WIDGET_DEFAULT_SIZE[type]
        set(s => ({
          widgets: [...s.widgets, {
            id: `w-${type}-${Date.now()}`,
            type,
            x: CELL_W,
            y: PAD_T + CELL_H,
            ...size,
          }],
        }))
      },

      removeWidget(id) {
        set(s => ({ widgets: s.widgets.filter(w => w.id !== id) }))
      },

      moveWidget(id, x, y) {
        set(s => ({
          widgets: s.widgets.map(w => w.id === id ? { ...w, x, y } : w),
        }))
      },

      resizeWidget(id, w, h, x, y) {
        set(s => ({
          widgets: s.widgets.map(ww => ww.id === id ? { ...ww, w, h, x, y } : ww),
        }))
      },
    }),
    { name: 'kura-desktop-widgets' }
  )
)
