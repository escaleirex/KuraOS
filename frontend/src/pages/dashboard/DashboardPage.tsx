import { useQuery } from '@tanstack/react-query'
import { HardDrive, Cpu, MemoryStick, Thermometer } from 'lucide-react'
import { systemApi, storageApi } from '@/api/client'

function MetricCard({ label, value, icon: Icon, sub }: {
  label: string; value: string; icon: React.ElementType; sub?: string
}) {
  return (
    <div className="bg-card border rounded-xl p-5 flex items-start gap-4">
      <div className="bg-primary/10 p-2.5 rounded-lg">
        <Icon className="w-5 h-5 text-primary" />
      </div>
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold mt-0.5">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

export function DashboardPage() {
  const { data: metrics } = useQuery({
    queryKey: ['system-metrics'],
    queryFn: () => systemApi.metrics().then(r => r.data),
    refetchInterval: 5000,
  })

  const { data: disks } = useQuery({
    queryKey: ['disks'],
    queryFn: () => storageApi.listDisks().then(r => r.data),
  })

  const { data: raids } = useQuery({
    queryKey: ['raids'],
    queryFn: () => storageApi.listRaids().then(r => r.data),
  })

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Dashboard</h2>
        <p className="text-muted-foreground text-sm mt-1">System overview</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="CPU Usage"
          value={`${metrics?.cpu_pct ?? 0}%`}
          icon={Cpu}
        />
        <MetricCard
          label="Memory"
          value={`${metrics?.mem_used_pct ?? 0}%`}
          icon={MemoryStick}
          sub={metrics ? `${formatBytes(metrics.mem_used)} / ${formatBytes(metrics.mem_total)}` : '—'}
        />
        <MetricCard
          label="Drives"
          value={String(disks?.length ?? '—')}
          icon={HardDrive}
        />
        <MetricCard
          label="Temperature"
          value={metrics?.cpu_temp ? `${metrics.cpu_temp}°C` : '—'}
          icon={Thermometer}
        />
      </div>

      {raids && raids.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            RAID Arrays
          </h3>
          <div className="space-y-2">
            {raids.map((r: { device: string; level: string; state: string; active_drives: number; total_drives: number }) => (
              <div key={r.device} className="bg-card border rounded-lg px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm">{r.device}</span>
                  <span className="text-xs bg-secondary px-2 py-0.5 rounded">RAID {r.level}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">{r.active_drives}/{r.total_drives} drives</span>
                  <span className={`text-xs font-medium ${r.state === 'clean' ? 'text-green-500' : 'text-yellow-500'}`}>
                    {r.state}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B'
  const gb = bytes / 1024 / 1024 / 1024
  return gb >= 1 ? `${gb.toFixed(1)} GB` : `${(bytes / 1024 / 1024).toFixed(0)} MB`
}
