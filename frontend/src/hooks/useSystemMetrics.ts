import { useEffect, useState } from 'react'
import { api } from '@/api/client'

export interface SystemMetrics {
  cpu_percent: number
  memory_percent: number
  memory_used_gb: number
  memory_total_gb: number
  cpu_temp?: number
}

export function useSystemMetrics(intervalMs = 5000) {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null)

  useEffect(() => {
    let mounted = true
    async function fetch() {
      try {
        const res = await api.get<{ cpu_pct: number; mem_total: number; mem_used: number; cpu_temp?: number }>('/system/metrics')
        const d = res.data
        if (mounted) setMetrics({
          cpu_percent:    d.cpu_pct,
          memory_percent: d.mem_total > 0 ? (d.mem_used / d.mem_total) * 100 : 0,
          memory_used_gb: d.mem_used  / 1024 / 1024 / 1024,
          memory_total_gb: d.mem_total / 1024 / 1024 / 1024,
          cpu_temp:       d.cpu_temp,
        })
      } catch {
        // metrics are cosmetic
      }
    }
    fetch()
    const id = setInterval(fetch, intervalMs)
    return () => { mounted = false; clearInterval(id) }
  }, [intervalMs])

  return metrics
}
