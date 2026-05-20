import { useEffect, useRef } from 'react'

export function AuroraBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    let animId: number

    const resize = () => {
      canvas.width  = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    // phase offsets so orbs don't all move in sync
    const orbs = [
      { bx: 0.20, by: 0.30, r: 0.45, hue: 240, px: 0.00, py: 1.20, spd: 0.28 },
      { bx: 0.75, by: 0.20, r: 0.50, hue: 200, px: 2.10, py: 0.40, spd: 0.22 },
      { bx: 0.50, by: 0.70, r: 0.55, hue: 270, px: 1.05, py: 3.30, spd: 0.18 },
      { bx: 0.80, by: 0.75, r: 0.42, hue: 180, px: 3.70, py: 0.80, spd: 0.25 },
    ]

    function draw(now: number) {
      const t = now / 1000   // seconds — smooth, frame-rate independent
      const W = canvas!.width
      const H = canvas!.height

      ctx.clearRect(0, 0, W, H)
      ctx.fillStyle = '#050810'
      ctx.fillRect(0, 0, W, H)

      for (const o of orbs) {
        const cx = (o.bx + 0.08 * Math.sin(t * o.spd + o.px)) * W
        const cy = (o.by + 0.06 * Math.cos(t * o.spd * 0.7 + o.py)) * H
        const radius = o.r * Math.min(W, H)
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius)
        grad.addColorStop(0,   `hsla(${o.hue}, 80%, 55%, 0.20)`)
        grad.addColorStop(0.5, `hsla(${o.hue + 20}, 70%, 45%, 0.09)`)
        grad.addColorStop(1,   `hsla(${o.hue + 40}, 60%, 35%, 0)`)
        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.arc(cx, cy, radius, 0, Math.PI * 2)
        ctx.fill()
      }

      animId = requestAnimationFrame(draw)
    }

    animId = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full"
      style={{ zIndex: 0 }}
    />
  )
}
