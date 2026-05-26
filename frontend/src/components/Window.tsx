import { useRef, useLayoutEffect, useEffect } from 'react'
import { Rnd } from 'react-rnd'
import { motion, AnimatePresence } from 'framer-motion'
import { Minus, Square, Copy, X } from 'lucide-react'
import { useWindowStore, type WindowState } from '@/stores/windowStore'

const MENUBAR_H = 32
const SNAP_PX   = 8

type SnapZone = 'top' | 'left' | 'right' | null

function getSnapZone(cx: number, cy: number): SnapZone {
  if (cy <= MENUBAR_H + SNAP_PX) return 'top'
  if (cx <= SNAP_PX)              return 'left'
  if (cx >= window.innerWidth - SNAP_PX) return 'right'
  return null
}

interface Props { win: WindowState; children: React.ReactNode }

type PendingDrag = { ratio: number; width: number; height: number }

export function Window({ win, children }: Props) {
  const { closeWindow, markClosed, minimizeWindow, bringToFront,
          toggleMaximize, setMaximized, updateGeometry } = useWindowStore()

  const rndRef         = useRef<Rnd>(null)
  const pendingDrag    = useRef<PendingDrag | null>(null)
  const skipMountAnim  = useRef(false)
  const prevZone       = useRef<SnapZone>(null)
  // Continuation drag state (refs only — zero React state during drag)
  const isCont         = useRef(false)
  const contPos        = useRef({ x: 0, y: 0 })
  // Snap preview element lives in body, manipulated directly
  const previewEl      = useRef<HTMLDivElement | null>(null)

  const maxH = window.innerHeight - MENUBAR_H

  // Create persistent snap-preview div in body
  useEffect(() => {
    const el = document.createElement('div')
    Object.assign(el.style, {
      display:       'none',
      position:      'fixed',
      top:           `${MENUBAR_H}px`,
      left:          '0',
      background:    'color-mix(in srgb, var(--kura-accent) 12%, transparent)',
      border:        '1.5px solid color-mix(in srgb, var(--kura-accent) 45%, transparent)',
      pointerEvents: 'none',
      zIndex:        '99998',
      transition:    'width 0.12s ease, height 0.12s ease, left 0.12s ease',
    })
    document.body.appendChild(el)
    previewEl.current = el
    return () => { document.body.removeChild(el); previewEl.current = null }
  }, [])

  const showPreview = (zone: SnapZone) => {
    const el = previewEl.current
    if (!el) return
    if (!zone) { el.style.display = 'none'; return }
    const W = window.innerWidth, H = window.innerHeight - MENUBAR_H
    const half = Math.floor(W / 2)
    el.style.display      = 'block'
    el.style.left         = zone === 'right' ? `${half}px` : '0'
    el.style.width        = zone === 'top'   ? `${W}px`    : `${half}px`
    el.style.height       = `${H}px`
    el.style.borderRadius = zone === 'top' ? '0' : zone === 'left' ? '0 12px 12px 0' : '12px 0 0 12px'
  }

  // Re-apply continuation-drag transform after EVERY render.
  // Prevents React reconciliation from overriding our direct DOM position.
  useLayoutEffect(() => {
    if (!isCont.current) return
    const el = getRndEl()
    if (el) el.style.transform = `translate(${contPos.current.x}px,${contPos.current.y}px)`
  })

  const getRndEl = () =>
    (rndRef.current as any)?.resizable?.resizable as HTMLElement | null

  const applySnap = (
    clientX: number, clientY: number,
    finalX: number, finalY: number,
    w: number, h: number,
  ) => {
    const zone = getSnapZone(clientX, clientY)
    if (zone === 'top') {
      updateGeometry(win.id, { x: finalX, y: finalY }, { width: w, height: h })
      setMaximized(win.id, true)
    } else if (zone === 'left') {
      const half = Math.floor(window.innerWidth / 2)
      const pos  = { x: 0, y: MENUBAR_H }
      const size = { width: half, height: maxH }
      rndRef.current?.updatePosition(pos)
      rndRef.current?.updateSize(size)
      updateGeometry(win.id, pos, size)
    } else if (zone === 'right') {
      const half = Math.floor(window.innerWidth / 2)
      const pos  = { x: half, y: MENUBAR_H }
      const size = { width: window.innerWidth - half, height: maxH }
      rndRef.current?.updatePosition(pos)
      rndRef.current?.updateSize(size)
      updateGeometry(win.id, pos, size)
    } else {
      rndRef.current?.updatePosition({ x: finalX, y: finalY })
      updateGeometry(win.id, { x: finalX, y: finalY }, { width: w, height: h })
    }
  }

  // Wire continuation drag after unmaximize-by-drag
  useLayoutEffect(() => {
    if (!win.maximized && pendingDrag.current) {
      const { ratio, width, height } = pendingDrag.current
      pendingDrag.current = null

      isCont.current   = true
      contPos.current  = { x: win.position.x, y: win.position.y }

      const move = (me: MouseEvent) => {
        const x = me.clientX - ratio * width
        const y = Math.max(MENUBAR_H, me.clientY - 18)
        contPos.current = { x, y }
        const el = getRndEl()
        if (el) el.style.transform = `translate(${x}px,${y}px)`

        const zone = getSnapZone(me.clientX, me.clientY)
        if (zone !== prevZone.current) { prevZone.current = zone; showPreview(zone) }
      }

      const up = (me: MouseEvent) => {
        document.removeEventListener('mousemove', move)
        document.removeEventListener('mouseup', up)
        isCont.current   = false
        prevZone.current = null
        showPreview(null)

        const finalX = me.clientX - ratio * width
        const finalY = Math.max(MENUBAR_H, me.clientY - 18)
        applySnap(me.clientX, me.clientY, finalX, finalY, width, height)
      }

      document.addEventListener('mousemove', move)
      document.addEventListener('mouseup', up)
    }
  }, [win.maximized, win.id])

  const handleMaxTitleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return
    e.preventDefault()
    bringToFront(win.id)
    const startX = e.clientX, startY = e.clientY

    const onMove = (me: MouseEvent) => {
      if (Math.abs(me.clientX - startX) < 5 && Math.abs(me.clientY - startY) < 5) return
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)

      const ratio = startX / window.innerWidth
      const { width, height } = win.size
      const newX = me.clientX - ratio * width
      const newY = Math.max(MENUBAR_H, me.clientY - 18)

      skipMountAnim.current = true
      pendingDrag.current   = { ratio, width, height }
      updateGeometry(win.id, { x: newX, y: newY }, { width, height })
      toggleMaximize(win.id)
    }
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  // ─── Maximized branch ────────────────────────────────────────────────────────
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
            style={{ position:'fixed', zIndex:win.zIndex, top:MENUBAR_H, left:0, width:'100%', height:maxH, pointerEvents:'all' }}
            onMouseDown={() => bringToFront(win.id)}
          >
            <div className="flex flex-col h-full overflow-hidden"
              style={{ background: 'var(--kura-glass)', backdropFilter:'blur(32px) saturate(1.5)' }}>
              <div
                className="flex items-center justify-between px-3 shrink-0 select-none gap-2 cursor-grab active:cursor-grabbing"
                onMouseDown={handleMaxTitleMouseDown}
                onDoubleClick={e => { e.stopPropagation(); toggleMaximize(win.id) }}
                style={{ height:'36px', background:'var(--kura-surface-alt)', borderBottom:'1px solid var(--kura-border)' }}
              >
                <div className="flex items-center gap-1.5 z-10 pl-1 shrink-0 flex-1 min-w-0">
                  <win.Icon size={14} weight="fill" className="text-white/50 shrink-0" />
                  <span className="text-white/80 text-xs font-semibold tracking-wide truncate">{win.title}</span>
                </div>
                <div className="flex items-center gap-1 z-10 pr-1 shrink-0">
                  <button className="w-6 h-6 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors cursor-pointer" onClick={e=>{e.stopPropagation();minimizeWindow(win.id)}} title="Minimize"><Minus className="w-3.5 h-3.5"/></button>
                  <button className="w-6 h-6 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors cursor-pointer" onClick={e=>{e.stopPropagation();toggleMaximize(win.id)}} title="Restore"><Copy className="w-3 h-3"/></button>
                  <button className="w-6 h-6 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:bg-rose-500/85 transition-colors cursor-pointer" onClick={e=>{e.stopPropagation();closeWindow(win.id)}} title="Close"><X className="w-3.5 h-3.5"/></button>
                </div>
              </div>
              <div className="relative flex-1 overflow-auto">{children}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    )
  }

  // ─── Windowed branch ─────────────────────────────────────────────────────────
  const noAnim = skipMountAnim.current
  if (noAnim) skipMountAnim.current = false

  return (
    <AnimatePresence onExitComplete={() => markClosed(win.id)}>
      {!win.closing && !win.minimized && (
        <motion.div
          key={win.id}
          initial={noAnim ? false : { opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8, y: 40 }}
          transition={{ type: 'spring', stiffness: 380, damping: 28 }}
          style={{ position:'fixed', zIndex:win.zIndex, top:0, left:0, width:'100%', height:'100%', pointerEvents:'none' }}
        >
          <Rnd
            ref={rndRef}
            size={win.size}
            position={win.position}
            minWidth={320}
            minHeight={240}
            dragHandleClassName="window-titlebar"
            style={{ pointerEvents: 'all' }}
            onMouseDown={() => bringToFront(win.id)}
            onDrag={e => {
              const me = e as MouseEvent
              const zone = getSnapZone(me.clientX, me.clientY)
              if (zone !== prevZone.current) { prevZone.current = zone; showPreview(zone) }
            }}
            onDragStop={(e, d) => {
              const me = e as MouseEvent
              prevZone.current = null
              showPreview(null)
              applySnap(me.clientX, me.clientY, d.x, d.y, win.size.width, win.size.height)
            }}
            onResizeStop={(_e, _dir, ref, _delta, pos) => {
              updateGeometry(win.id, pos, { width: ref.offsetWidth, height: ref.offsetHeight })
            }}
          >
            <div className="flex flex-col h-full rounded-2xl overflow-hidden shadow-2xl"
              style={{ background: 'var(--kura-glass)', backdropFilter:'blur(32px) saturate(1.5)', border:'1px solid var(--kura-glass-border)', boxShadow:'0 32px 80px var(--kura-shadow), 0 0 0 0.5px var(--kura-glass-border) inset' }}>
              <div
                className="window-titlebar flex items-center justify-between px-3 shrink-0 select-none cursor-grab active:cursor-grabbing gap-2"
                onDoubleClick={e => { e.stopPropagation(); toggleMaximize(win.id) }}
                style={{ height:'36px', background:'var(--kura-surface-alt)', borderBottom:'1px solid var(--kura-border)' }}
              >
                <div className="flex items-center gap-1.5 z-10 pl-1 shrink-0 flex-1 min-w-0">
                  <win.Icon size={14} weight="fill" className="text-white/50 shrink-0" />
                  <span className="text-white/80 text-xs font-semibold tracking-wide truncate">{win.title}</span>
                </div>
                <div className="flex items-center gap-1 z-10 pr-1 shrink-0">
                  <button className="w-6 h-6 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors cursor-pointer" onClick={e=>{e.stopPropagation();minimizeWindow(win.id)}} title="Minimize"><Minus className="w-3.5 h-3.5"/></button>
                  <button className="w-6 h-6 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors cursor-pointer" onClick={e=>{e.stopPropagation();toggleMaximize(win.id)}} title="Maximize"><Square className="w-3 h-3"/></button>
                  <button className="w-6 h-6 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:bg-rose-500/85 transition-colors cursor-pointer" onClick={e=>{e.stopPropagation();closeWindow(win.id)}} title="Close"><X className="w-3.5 h-3.5"/></button>
                </div>
              </div>
              <div className="relative flex-1 overflow-auto">{children}</div>
            </div>
          </Rnd>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
