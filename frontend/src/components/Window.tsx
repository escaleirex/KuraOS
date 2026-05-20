import { useRef } from 'react'
import { Rnd } from 'react-rnd'
import { motion, AnimatePresence } from 'framer-motion'
import { Minus, Square, Copy, X } from 'lucide-react'
import { useWindowStore, type WindowState } from '@/stores/windowStore'

const MENUBAR_H = 32

interface Props {
  win: WindowState
  children: React.ReactNode
}

export function Window({ win, children }: Props) {
  const { closeWindow, markClosed, minimizeWindow, bringToFront, toggleMaximize, updateGeometry } = useWindowStore()
  const rndRef = useRef<Rnd>(null)

  const maxH = window.innerHeight - MENUBAR_H

  if (win.maximized) {
    return (
      <AnimatePresence onExitComplete={() => markClosed(win.id)}>
        {!win.closing && !win.minimized && (
          <motion.div
            key={win.id}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96, y: 30 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            style={{
              position: 'fixed',
              zIndex: win.zIndex,
              top: MENUBAR_H,
              left: 0,
              width: '100%',
              height: maxH,
              pointerEvents: 'all',
            }}
            onMouseDown={() => bringToFront(win.id)}
          >
            <div
              className="flex flex-col h-full overflow-hidden"
              style={{
                background:     'rgba(12,14,22,0.92)',
                backdropFilter: 'blur(32px) saturate(1.5)',
              }}
            >
              {/* Title bar */}
              <div
                className="flex items-center justify-between px-3 shrink-0 select-none gap-2 cursor-default"
                style={{
                  height:     '36px',
                  background: 'rgba(255,255,255,0.03)',
                  borderBottom: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                {/* Left Side: Icon */}
                <div className="flex items-center gap-1.5 z-10 pl-1 shrink-0">
                  <win.Icon size={14} weight="fill" className="text-white/50" />
                </div>

                {/* Center: Title */}
                <div className="flex-1 flex items-center justify-center pointer-events-none">
                  <span className="text-white/80 text-xs font-semibold tracking-wide">{win.title}</span>
                </div>

                {/* Right Side: GNOME Window Controls */}
                <div className="flex items-center gap-1 z-10 pr-1 shrink-0">
                  <button
                    className="w-6 h-6 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                    onClick={e => { e.stopPropagation(); minimizeWindow(win.id) }}
                    title="Minimize"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <button
                    className="w-6 h-6 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                    onClick={e => { e.stopPropagation(); toggleMaximize(win.id) }}
                    title="Restore"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                  <button
                    className="w-6 h-6 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:bg-rose-500/85 transition-colors cursor-pointer"
                    onClick={e => { e.stopPropagation(); closeWindow(win.id) }}
                    title="Close"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-auto">
                {children}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    )
  }

  return (
    <AnimatePresence onExitComplete={() => markClosed(win.id)}>
      {!win.closing && !win.minimized && (
        <motion.div
          key={win.id}
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8, y: 40 }}
          transition={{ type: 'spring', stiffness: 380, damping: 28 }}
          style={{
            position: 'fixed',
            zIndex: win.zIndex,
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
          }}
        >
          <Rnd
            ref={rndRef}
            size={win.size}
            position={win.position}
            minWidth={320}
            minHeight={240}
            bounds="window"
            dragHandleClassName="window-titlebar"
            style={{ pointerEvents: 'all' }}
            onMouseDown={() => bringToFront(win.id)}
            onDragStop={(_e, d) => {
              updateGeometry(win.id, { x: d.x, y: d.y }, win.size)
            }}
            onResizeStop={(_e, _dir, ref, _delta, pos) => {
              updateGeometry(win.id, pos, {
                width:  ref.offsetWidth,
                height: ref.offsetHeight,
              })
            }}
          >
            <div
              className="flex flex-col h-full rounded-2xl overflow-hidden shadow-2xl"
              style={{
                background:     'rgba(12,14,22,0.82)',
                backdropFilter: 'blur(32px) saturate(1.5)',
                border:         '1px solid rgba(255,255,255,0.08)',
                boxShadow:      '0 32px 80px rgba(0,0,0,0.6), 0 0 0 0.5px rgba(255,255,255,0.04) inset',
              }}
            >
              {/* Title bar */}
              <div
                className="window-titlebar flex items-center justify-between px-3 shrink-0 select-none cursor-grab active:cursor-grabbing gap-2"
                style={{
                  height:     '36px',
                  background: 'rgba(255,255,255,0.03)',
                  borderBottom: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                {/* Left Side: Icon */}
                <div className="flex items-center gap-1.5 z-10 pl-1 shrink-0">
                  <win.Icon size={14} weight="fill" className="text-white/50" />
                </div>

                {/* Center: Title */}
                <div className="flex-1 flex items-center justify-center pointer-events-none">
                  <span className="text-white/80 text-xs font-semibold tracking-wide">{win.title}</span>
                </div>

                {/* Right Side: GNOME Window Controls */}
                <div className="flex items-center gap-1 z-10 pr-1 shrink-0">
                  <button
                    className="w-6 h-6 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                    onClick={e => { e.stopPropagation(); minimizeWindow(win.id) }}
                    title="Minimize"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <button
                    className="w-6 h-6 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                    onClick={e => { e.stopPropagation(); toggleMaximize(win.id) }}
                    title="Maximize"
                  >
                    <Square className="w-3 h-3" />
                  </button>
                  <button
                    className="w-6 h-6 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:bg-rose-500/85 transition-colors cursor-pointer"
                    onClick={e => { e.stopPropagation(); closeWindow(win.id) }}
                    title="Close"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-auto">
                {children}
              </div>
            </div>
          </Rnd>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
