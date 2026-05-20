import { AuroraBackground }    from '@/components/backgrounds/AuroraBackground'
import { MenuBar }             from '@/components/MenuBar'
import { Dock }                from '@/components/Dock'
import { Window }              from '@/components/Window'
import { DesktopIcons }        from '@/components/DesktopIcons'
import { DesktopContextMenu }  from '@/components/DesktopContextMenu'
import { ClockWidget }         from '@/components/widgets/ClockWidget'
import { MetricsWidget }       from '@/components/widgets/MetricsWidget'
import { useWindowStore, type AppID } from '@/stores/windowStore'
import { useWidgetStore }      from '@/stores/widgetStore'
import { lazy, Suspense } from 'react'

const PAGES: Record<AppID, React.LazyExoticComponent<() => JSX.Element>> = {
  storage:   lazy(() => import('@/pages/storage/StoragePage').then(m => ({ default: m.StoragePage }))),
  axis:      lazy(() => import('@/pages/axis/AxisPage').then(m => ({ default: m.AxisPage }))),
  docker:    lazy(() => import('@/pages/docker/DockerPage').then(m => ({ default: m.DockerPage }))),
  network:   lazy(() => import('@/pages/network/NetworkPage').then(m => ({ default: m.NetworkPage }))),
  hardware:  lazy(() => import('@/pages/hardware/HardwarePage').then(m => ({ default: m.HardwarePage }))),
  settings:  lazy(() => import('@/pages/settings/SettingsPage').then(m => ({ default: m.SettingsPage }))),
  files:     lazy(() => import('@/pages/files/FilesPage').then(m => ({ default: m.FilesPage }))),
  appstore:  lazy(() => import('@/pages/appstore/AppStorePage').then(m => ({ default: m.AppStorePage }))),
}

const WIDGET_COMPONENTS: Record<string, (id: string) => React.ReactNode> = {
  clock:   (id) => <ClockWidget   key={id} id={id} />,
  metrics: (id) => <MetricsWidget key={id} id={id} />,
}

function WindowContent({ app }: { app: AppID }) {
  const Page = PAGES[app]
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-full text-white/30 text-sm">Loading…</div>}>
      <Page />
    </Suspense>
  )
}

export function Desktop() {
  const windows = useWindowStore(s => s.windows)
  const widgets = useWidgetStore(s => s.widgets)

  return (
    <div className="fixed inset-0 overflow-hidden select-none" style={{ background: '#050810' }}>
      {/* z:0 — animated background */}
      <AuroraBackground />

      {/* z:1 — menu bar */}
      <MenuBar />

      {/* z:2 — widgets (draggable) */}
      <div className="fixed inset-0" style={{ zIndex: 2, pointerEvents: 'none' }}>
        {widgets.map(w => WIDGET_COMPONENTS[w.type]?.(w.id))}
      </div>

      {/* z:1 — desktop icons */}
      <DesktopIcons />

      {/* z:10+ — floating app windows */}
      <div className="fixed inset-0" style={{ zIndex: 10, pointerEvents: 'none' }}>
        {windows.map(win => (
          <Window key={win.id} win={win}>
            <WindowContent app={win.app} />
          </Window>
        ))}
      </div>

      {/* z:8000 — dock */}
      <Dock />

      {/* z:9500 — right-click context menu */}
      <DesktopContextMenu />
    </div>
  )
}
