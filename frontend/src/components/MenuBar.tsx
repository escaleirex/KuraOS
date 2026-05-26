import { useState, useEffect } from 'react'
import { Sun, Moon } from 'lucide-react'
import { useWindowStore, APP_META } from '@/stores/windowStore'
import { useSystemMetrics } from '@/hooks/useSystemMetrics'

function Clock() {
  const [time, setTime] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return (
    <span className="tabular-nums text-white/80 text-sm font-medium">
      {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
    </span>
  )
}

export function MenuBar() {
  const activeId  = useWindowStore(s => s.activeId)
  const windows   = useWindowStore(s => s.windows)
  const metrics   = useSystemMetrics()

  const activeWin = windows.find(w => w.id === activeId)
  const appTitle  = activeWin ? APP_META[activeWin.app].title : null

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof document !== 'undefined') {
      return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
    }
    return 'dark'
  })

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  }, [theme])

  const toggleTheme = () => {
    setTheme(t => t === 'dark' ? 'light' : 'dark')
  }

  function logout() {
    localStorage.removeItem('kura_token')
    window.location.href = '/login'
  }

  return (
    <div
      className="fixed top-0 left-0 right-0 h-8 flex items-center px-4 gap-4 select-none"
      style={{
        zIndex: 9000,
        backdropFilter: 'blur(24px)',
        background: 'var(--kura-glass)',
        borderBottom: '1px solid var(--kura-border)',
      }}
    >
      {/* Left */}
      <span className="text-white font-bold text-sm tracking-wider">KuraOS</span>
      {appTitle && (
        <>
          <span className="text-white/20">·</span>
          <span className="text-white/60 text-sm">{appTitle}</span>
        </>
      )}

      <div className="flex-1" />

      {/* Right */}
      {metrics && (
        <>
          <span className="text-white/50 text-xs tabular-nums">
            CPU {Math.round(metrics.cpu_percent)}%
          </span>
          <span className="text-white/50 text-xs tabular-nums">
            RAM {Math.round(metrics.memory_percent)}%
          </span>
        </>
      )}
      <Clock />
      
      {/* Theme Switcher */}
      <button
        onClick={toggleTheme}
        className="text-white/40 hover:text-white/80 p-1 rounded-lg transition-colors cursor-pointer flex items-center justify-center"
        title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      >
        {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
      </button>

      <button
        onClick={logout}
        className="text-white/40 hover:text-white/80 text-xs transition-colors cursor-pointer"
      >
        Logout
      </button>
    </div>
  )
}
