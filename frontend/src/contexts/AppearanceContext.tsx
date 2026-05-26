import { createContext, useContext, useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { settingsApi, type AppearanceSettings } from '@/api/client'

interface AppearanceContextValue {
  theme: 'dark' | 'light' | 'auto'
  accent: string
  scale: string
  density: 'comfortable' | 'compact'
  isLight: boolean
}

const AppearanceContext = createContext<AppearanceContextValue>({
  theme: 'dark',
  accent: '#3b82f6',
  scale: '100',
  density: 'comfortable',
  isLight: false,
})

export function useAppearance() {
  return useContext(AppearanceContext)
}

const DEFAULTS: AppearanceSettings = {
  theme: 'dark',
  accent: '#3b82f6',
  scale: '100',
  density: 'comfortable',
}

export function AppearanceProvider({ children }: { children: React.ReactNode }) {
  const { data } = useQuery({
    queryKey: ['settings', 'appearance'],
    queryFn: () => settingsApi.getAppearance().then(r => r.data),
  })

  const s = data ?? DEFAULTS

  const isLight = s.theme === 'light' || (s.theme === 'auto' && window.matchMedia('(prefers-color-scheme: light)').matches)

  useEffect(() => {
    const root = document.documentElement

    // Theme class
    if (isLight) {
      root.classList.add('theme-light')
      root.classList.remove('theme-dark', 'dark')
    } else {
      root.classList.add('theme-dark', 'dark')
      root.classList.remove('theme-light')
    }

    // Accent color
    root.style.setProperty('--kura-accent', s.accent)

    // Scale as CSS zoom on root
    root.style.setProperty('--kura-scale', `${Number(s.scale) / 100}`)

    // Density
    root.setAttribute('data-kura-density', s.density)
  }, [s.theme, s.accent, s.scale, s.density, isLight])

  const value = useMemo(() => ({
    theme: s.theme,
    accent: s.accent,
    scale: s.scale,
    density: s.density,
    isLight,
  }), [s.theme, s.accent, s.scale, s.density, isLight])

  return (
    <AppearanceContext.Provider value={value}>
      {children}
    </AppearanceContext.Provider>
  )
}
