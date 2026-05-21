import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type React from 'react'
import { Clock, ChartLine } from '@phosphor-icons/react'
import { CELL_W, CELL_H, gridLayout } from '@/shared/gridConstants'

export type WidgetType = 'clock' | 'metrics'
type WidgetIcon = React.ComponentType<any>

export interface MetricsSettings {
  showCpu: boolean
  showMemory: boolean
  showGpu: boolean
  showDisks: boolean
  showNetwork: boolean
  showSwap: boolean
  showFooter: boolean
  showCharts: boolean
  refreshInterval: number
  chartHistory: number
  temperatureUnit: 'celsius' | 'fahrenheit'
  accentColor: string
}

export const DEFAULT_METRICS_SETTINGS: MetricsSettings = {
  showCpu: true,
  showMemory: true,
  showGpu: true,
  showDisks: true,
  showNetwork: true,
  showSwap: false,
  showFooter: true,
  showCharts: true,
  refreshInterval: 3000,
  chartHistory: 60,
  temperatureUnit: 'celsius',
  accentColor: '#3b82f6',
}

export type WidgetSettings = {
  metrics?: Partial<MetricsSettings>
}

export interface WidgetInstance {
  id: string
  type: WidgetType
  x: number
  y: number
  w: number
  h: number
  settings?: WidgetSettings
}

interface WidgetStore {
  widgets: WidgetInstance[]
  addWidget:       (type: WidgetType) => void
  removeWidget:    (id: string) => void
  moveWidget:      (id: string, x: number, y: number) => void
  resizeWidget:    (id: string, w: number, h: number, x: number, y: number) => void
  configureWidget: (id: string, settings: WidgetSettings) => void
  getWidgetSettings: (id: string) => WidgetSettings | undefined
  settingsOpenId: string | null
  openSettings: (id: string) => void
  closeSettings: () => void
}

function defaultWidgets(): WidgetInstance[] {
  const { originX, originY, cols } = gridLayout()
  const gridLeft = originX - cols * CELL_W
  return [
    { id: 'w-clock',   type: 'clock',   x: gridLeft, y: originY,           w: CELL_W * 2, h: CELL_H     },
    { id: 'w-metrics', type: 'metrics', x: gridLeft, y: originY + CELL_H,  w: CELL_W * 3, h: CELL_H * 2 },
  ]
}

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
      widgets: defaultWidgets(),

      addWidget(type) {
        const size = WIDGET_DEFAULT_SIZE[type]
        const { originY } = gridLayout()
        set(s => ({
          widgets: [...s.widgets, {
            id: `w-${type}-${Date.now()}`,
            type,
            x: CELL_W,
            y: originY + CELL_H,
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

      configureWidget(id, settings) {
        set(s => ({
          widgets: s.widgets.map(w => w.id === id ? { ...w, settings: { ...w.settings, ...settings } } : w),
        }))
      },

      getWidgetSettings(id): WidgetSettings | undefined {
        const state = useWidgetStore.getState()
        const w = state.widgets.find((x: WidgetInstance) => x.id === id)
        return w?.settings
      },

      settingsOpenId: null,
      openSettings(id) {
        set({ settingsOpenId: id })
      },
      closeSettings() {
        set({ settingsOpenId: null })
      },
    }),
    { name: 'kura-desktop-widgets' }
  )
)
