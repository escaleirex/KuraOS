import { useRef } from 'react'
import { Outlet, NavLink } from 'react-router-dom'
import {
  LayoutDashboard, HardDrive, Bot, Network,
  Container, Cpu, Settings, LogOut,
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import { settingsApi } from '@/api/client'

const DEFAULT_NAV_ITEMS = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/storage',   icon: HardDrive,       label: 'Storage' },
  { to: '/axis',      icon: Bot,             label: 'Axis AI' },
  { to: '/docker',    icon: Container,       label: 'Docker' },
  { to: '/network',   icon: Network,         label: 'Network' },
  { to: '/hardware',  icon: Cpu,             label: 'Hardware' },
  { to: '/settings',  icon: Settings,        label: 'Settings' },
]

const NAV_MAP = Object.fromEntries(DEFAULT_NAV_ITEMS.map(i => [i.to, i]))

function applyOrder(order: string[]) {
  const ordered = order.flatMap(to => (NAV_MAP[to] ? [NAV_MAP[to]] : []))
  const seen = new Set(order)
  const rest = DEFAULT_NAV_ITEMS.filter(i => !seen.has(i.to))
  return [...ordered, ...rest]
}

export function Layout() {
  const qc = useQueryClient()
  const dragIndex = useRef<number | null>(null)
  const dragOverIndex = useRef<number | null>(null)

  const { data } = useQuery({
    queryKey: ['settings', 'nav-order'],
    queryFn: () => settingsApi.getNavOrder().then(r => r.data),
    staleTime: Infinity,
  })

  const mutation = useMutation({
    mutationFn: (order: string[]) => settingsApi.saveNavOrder(order),
    onSuccess: (_, order) => {
      qc.setQueryData(['settings', 'nav-order'], { order })
    },
  })

  const navItems = data?.order?.length ? applyOrder(data.order) : DEFAULT_NAV_ITEMS

  const handleDragStart = (index: number) => {
    dragIndex.current = index
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    dragOverIndex.current = index
  }

  const handleDrop = () => {
    const from = dragIndex.current
    const to = dragOverIndex.current
    if (from === null || to === null || from === to) return

    const next = [...navItems]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    mutation.mutate(next.map(i => i.to))
    dragIndex.current = null
    dragOverIndex.current = null
  }

  const handleLogout = () => {
    localStorage.removeItem('kura_token')
    window.location.href = '/login'
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-60 border-r bg-sidebar flex flex-col">
        <div className="p-6 border-b">
          <h1 className="text-xl font-bold text-primary">KuraOS</h1>
          <p className="text-xs text-muted-foreground mt-0.5">NAS Control Panel</p>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(({ to, icon: Icon, label }, index) => (
            <NavLink
              key={to}
              to={to}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={handleDrop}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors cursor-grab active:cursor-grabbing',
                  isActive
                    ? 'bg-primary text-primary-foreground font-medium'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                )
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-destructive transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
