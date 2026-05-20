import { useState, useEffect } from 'react'
import { WidgetShell } from './WidgetShell'

function ClockContent() {
  const [time, setTime] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const hh   = time.getHours().toString().padStart(2, '0')
  const mm   = time.getMinutes().toString().padStart(2, '0')
  const ss   = time.getSeconds().toString().padStart(2, '0')
  const date = time.toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div
      className="w-full h-full rounded-2xl px-4 py-3 flex flex-col justify-center select-none"
      style={{
        background:     'rgba(12,14,22,0.75)',
        backdropFilter: 'blur(20px) saturate(1.4)',
        border:         '1px solid rgba(255,255,255,0.07)',
        boxShadow:      '0 8px 32px rgba(0,0,0,0.45)',
      }}
    >
      <div className="flex items-baseline gap-1.5">
        <span className="text-4xl font-bold text-white tabular-nums tracking-tight">{hh}:{mm}</span>
        <span className="text-lg text-white/35 tabular-nums">{ss}</span>
      </div>
      <p className="text-xs text-white/35 mt-1 capitalize">{date}</p>
    </div>
  )
}

export function ClockWidget({ id }: { id: string }) {
  return (
    <WidgetShell id={id}>
      <ClockContent />
    </WidgetShell>
  )
}
