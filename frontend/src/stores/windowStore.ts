import { create } from 'zustand'
import type React from 'react'
import {
  HardDrives, Robot, Cube, Network, Cpu, GearSix, FolderOpen, Package, Code,
  Notepad, Image, FilmStrip,
} from '@phosphor-icons/react'

export type AppID = 'storage' | 'axis' | 'docker' | 'network' | 'hardware' | 'settings' | 'files' | 'appstore' | 'code' | 'notepad' | 'imageviewer' | 'videoplayer'

export type AppIcon = React.ComponentType<any>

export interface WindowState {
  id: string
  app: AppID
  title: string
  Icon: AppIcon
  position: { x: number; y: number }
  size: { width: number; height: number }
  minimized: boolean
  maximized: boolean
  zIndex: number
  closing: boolean
  params?: Record<string, string>
}

const DEFAULT_SIZES: Record<AppID, { width: number; height: number }> = {
  storage:   { width: 900,  height: 600 },
  axis:      { width: 500,  height: 700 },
  docker:    { width: 800,  height: 550 },
  network:   { width: 750,  height: 500 },
  hardware:  { width: 750,  height: 500 },
  settings:  { width: 650,  height: 500 },
  files:     { width: 900,  height: 580 },
  appstore:  { width: 960,  height: 640 },
  code:      { width: 1200, height: 800 },
  notepad:   { width: 700,  height: 500 },
  imageviewer: { width: 800, height: 600 },
  videoplayer: { width: 900, height: 600 },
}

export const APP_META: Record<AppID, { title: string; Icon: AppIcon }> = {
  storage:   { title: 'Storage',     Icon: HardDrives  },
  axis:      { title: 'Axis AI',     Icon: Robot       },
  docker:    { title: 'Docker',      Icon: Cube        },
  network:   { title: 'Network',     Icon: Network     },
  hardware:  { title: 'Hardware',    Icon: Cpu         },
  settings:  { title: 'Settings',    Icon: GearSix     },
  files:     { title: 'Files',       Icon: FolderOpen  },
  appstore:  { title: 'App Store',   Icon: Package     },
  code:      { title: 'Code Editor',   Icon: Code        },
  notepad:   { title: 'Notepad',       Icon: Notepad     },
  imageviewer: { title: 'Image Viewer', Icon: Image      },
  videoplayer: { title: 'Video Player', Icon: FilmStrip  },
}

function centeredPosition(size: { width: number; height: number }) {
  const x = Math.max(0, (window.innerWidth  - size.width)  / 2 + (Math.random() - 0.5) * 80)
  const y = Math.max(32,(window.innerHeight - size.height) / 2 + (Math.random() - 0.5) * 60)
  return { x: Math.round(x), y: Math.round(y) }
}

interface Store {
  windows: WindowState[]
  activeId: string | null
  openWindow:     (app: AppID, params?: Record<string, string>) => void
  closeWindow:    (id: string) => void
  minimizeWindow: (id: string) => void
  restoreWindow:  (id: string) => void
  bringToFront:   (id: string) => void
  toggleMaximize: (id: string) => void
  setMaximized:   (id: string, value: boolean) => void
  updateGeometry: (id: string, pos: { x: number; y: number }, size: { width: number; height: number }) => void
  markClosed:     (id: string) => void
}

let nextZ = 10

export const useWindowStore = create<Store>((set, get) => ({
  windows: [],
  activeId: null,

  openWindow(app, params) {
    const { windows } = get()
    // code windows support multiple instances (one per folder)
    if (app !== 'code') {
      const existing = windows.find(w => w.app === app)
      if (existing) {
        if (existing.minimized) {
          get().restoreWindow(existing.id)
        } else {
          get().bringToFront(existing.id)
        }
        return
      }
    }
    const size = DEFAULT_SIZES[app]
    const meta = APP_META[app]
    const folder = params?.folder
    const title = app === 'code' && folder
      ? folder.split('/').filter(Boolean).pop() ?? meta.title
      : meta.title
    const id = `${app}-${Date.now()}`
    nextZ++
    set(s => ({
      windows: [...s.windows, {
        id,
        app,
        title,
        Icon:      meta.Icon,
        position:  centeredPosition(size),
        size,
        minimized: false,
        maximized: false,
        closing:   false,
        zIndex:    nextZ,
        params,
      }],
      activeId: id,
    }))
  },

  closeWindow(id) {
    set(s => ({
      windows:  s.windows.map(w => w.id === id ? { ...w, closing: true } : w),
      activeId: s.activeId === id ? null : s.activeId,
    }))
  },

  markClosed(id) {
    set(s => ({ windows: s.windows.filter(w => w.id !== id) }))
  },

  minimizeWindow(id) {
    set(s => ({
      windows:  s.windows.map(w => w.id === id ? { ...w, minimized: true } : w),
      activeId: s.activeId === id ? null : s.activeId,
    }))
  },

  restoreWindow(id) {
    nextZ++
    set(s => ({
      windows:  s.windows.map(w => w.id === id ? { ...w, minimized: false, zIndex: nextZ } : w),
      activeId: id,
    }))
  },

  bringToFront(id) {
    nextZ++
    set(s => ({
      windows:  s.windows.map(w => w.id === id ? { ...w, zIndex: nextZ } : w),
      activeId: id,
    }))
  },

  toggleMaximize(id) {
    set(s => ({
      windows: s.windows.map(w => w.id === id ? { ...w, maximized: !w.maximized } : w),
    }))
  },

  setMaximized(id, value) {
    set(s => ({
      windows: s.windows.map(w => w.id === id ? { ...w, maximized: value } : w),
    }))
  },

  updateGeometry(id, position, size) {
    set(s => ({
      windows: s.windows.map(w => w.id === id ? { ...w, position, size } : w),
    }))
  },
}))
