import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useWidgetStore, WIDGET_META, type WidgetType } from '@/stores/widgetStore'
import { useIconStore } from '@/stores/iconStore'

interface Pos { x: number; y: number }

const WIDGET_TYPES: WidgetType[] = ['clock', 'metrics']

const MENU_STYLE: React.CSSProperties = {
  minWidth:       '188px',
  background:     'rgba(18,20,30,0.96)',
  backdropFilter: 'blur(24px)',
  border:         '1px solid rgba(255,255,255,0.10)',
  boxShadow:      '0 16px 48px rgba(0,0,0,0.7)',
}

export function DesktopContextMenu() {
  const [pos, setPos]         = useState<Pos | null>(null)
  const [subOpen, setSubOpen] = useState(false)
  const menuRef               = useRef<HTMLDivElement>(null)
  const leaveTimer            = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { addWidget }         = useWidgetStore()
  const { arrangeIcons }      = useIconStore()

  useEffect(() => {
    function onCtx(e: MouseEvent) {
      const target = e.target as HTMLElement
      if (target.closest('[data-no-ctx]')) return
      e.preventDefault()
      const mW = 188, mH = 160
      setPos({
        x: Math.min(e.clientX, window.innerWidth  - mW - 8),
        y: Math.min(e.clientY, window.innerHeight - mH - 8),
      })
      setSubOpen(false)
    }
    function onDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setPos(null)
        setSubOpen(false)
      }
    }
    window.addEventListener('contextmenu', onCtx)
    window.addEventListener('mousedown',   onDown)
    return () => {
      window.removeEventListener('contextmenu', onCtx)
      window.removeEventListener('mousedown',   onDown)
    }
  }, [])

  const openSub  = () => { leaveTimer.current && clearTimeout(leaveTimer.current); setSubOpen(true) }
  const closeSub = () => { leaveTimer.current = setTimeout(() => setSubOpen(false), 80) }

  function add(type: WidgetType) {
    addWidget(type)
    setPos(null)
    setSubOpen(false)
  }

  // Open submenu to the left only when submenu would overflow right edge
  const subLeft = pos ? pos.x + 188 + 172 > window.innerWidth - 8 : false

  return (
    <AnimatePresence>
      {pos && (
        <motion.div
          ref={menuRef}
          data-no-ctx
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.92 }}
          transition={{ duration: 0.12 }}
          className="fixed py-1.5 rounded-xl select-none"
          style={{ left: pos.x, top: pos.y, zIndex: 9500, ...MENU_STYLE }}
        >
          {/* Add Widget row */}
          <div
            className="relative"
            onMouseEnter={openSub}
            onMouseLeave={closeSub}
          >
            <button
              className="w-full flex items-center justify-between px-3 py-2 text-sm text-white/80
                         hover:bg-white/[0.07] transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <span className="text-base">＋</span> Add Widget
              </span>
              <span className="text-white/30 text-xs">{subLeft ? '‹' : '›'}</span>
            </button>

            <AnimatePresence>
              {subOpen && (
                <motion.div
                  data-no-ctx
                  onMouseEnter={openSub}
                  onMouseLeave={closeSub}
                  initial={{ opacity: 0, scale: 0.94 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.94 }}
                  transition={{ duration: 0.10 }}
                  className="absolute top-0 py-1.5 rounded-xl"
                  style={{
                    ...(subLeft ? { right: '100%', marginRight: 4 } : { left: '100%', marginLeft: 4 }),
                    zIndex:   9600,
                    minWidth: '172px',
                    ...MENU_STYLE,
                    background: 'rgba(18,20,30,0.98)',
                  }}
                >
                  {WIDGET_TYPES.map(type => {
                    const WidgetIcon = WIDGET_META[type].Icon
                    return (
                      <button
                        key={type}
                        onClick={() => add(type)}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-white/80
                                   hover:bg-white/[0.07] transition-colors cursor-pointer"
                      >
                        <WidgetIcon size={16} weight="fill" />
                        {WIDGET_META[type].label}
                      </button>
                    )
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="h-px bg-white/[0.06] mx-2 my-1" />

          <button
            onClick={() => { arrangeIcons(); setPos(null) }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white/80
                       hover:bg-white/[0.07] transition-colors cursor-pointer"
          >
            <span className="text-base">⊟</span> Arrange Icons
          </button>

          <div className="h-px bg-white/[0.06] mx-2 my-1" />

          <button
            onClick={() => setPos(null)}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white/40
                       hover:bg-white/[0.07] transition-colors cursor-pointer"
          >
            <span className="text-base">✕</span> Dismiss
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
