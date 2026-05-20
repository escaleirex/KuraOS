import { useState } from 'react'
import { X, Download, ExternalLink } from 'lucide-react'
import { appsApi } from '@/api/client'

interface PortMapping {
  host: number
  container: number
  protocol: string
}

interface VolumeMapping {
  host_path: string
  container_path: string
  read_only: boolean
}

interface EnvVar {
  key: string
  value: string
  required: boolean
  hint?: string
}

interface AppTemplate {
  id: string
  name: string
  category: string
  description: string
  icon: string
  image: string
  ports: PortMapping[]
  volumes: VolumeMapping[]
  env: EnvVar[]
  web_port?: number
}

interface Props {
  app: AppTemplate
  onClose: () => void
  onInstalled: () => void
}

export function AppDetail({ app, onClose, onInstalled }: Props) {
  const [ports, setPorts] = useState<PortMapping[]>(app.ports ?? [])
  const [dataDir, setDataDir] = useState('')
  const [envVars, setEnvVars] = useState<EnvVar[]>(app.env ?? [])
  const [installing, setInstalling] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const updatePort = (idx: number, host: number) => {
    setPorts(p => p.map((m, i) => i === idx ? { ...m, host } : m))
  }

  const updateEnv = (idx: number, value: string) => {
    setEnvVars(v => v.map((e, i) => i === idx ? { ...e, value } : e))
  }

  const install = async () => {
    setInstalling(true)
    setError(null)
    try {
      await appsApi.install(app.id, { ports, env: envVars, data_dir: dataDir || undefined })
      onInstalled()
      onClose()
    } catch (e: any) {
      setError(e?.response?.data?.error ?? e?.message ?? 'Install failed')
    } finally {
      setInstalling(false)
    }
  }

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: 20000, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-[560px] max-h-[80vh] overflow-y-auto rounded-2xl flex flex-col"
        style={{
          background: 'rgba(18,20,30,0.97)',
          border: '1px solid rgba(255,255,255,0.10)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.7)',
        }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 p-5 border-b border-white/5">
          <span className="text-4xl">{app.icon}</span>
          <div className="flex-1">
            <h2 className="text-white font-semibold text-lg">{app.name}</h2>
            <span
              className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }}
            >
              {app.category}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/40 hover:text-white/80 hover:bg-white/5 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 flex flex-col gap-5">
          <p className="text-sm text-white/60 leading-relaxed">{app.description}</p>

          <div className="text-xs text-white/30 font-mono">{app.image}</div>

          {/* Ports */}
          {ports.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Ports</h3>
              <div className="flex flex-col gap-2">
                {ports.map((p, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="number"
                      value={p.host}
                      onChange={e => updatePort(i, parseInt(e.target.value) || p.host)}
                      className="w-24 px-3 py-1.5 rounded-lg text-sm text-white bg-white/5 border border-white/10 focus:outline-none focus:border-white/25"
                    />
                    <span className="text-white/30 text-xs">→ :{p.container}/{p.protocol}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Data directory */}
          <section>
            <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Data Directory</h3>
            <input
              type="text"
              value={dataDir}
              onChange={e => setDataDir(e.target.value)}
              placeholder={`/var/lib/kura/apps/${app.id}/data`}
              className="w-full px-3 py-1.5 rounded-lg text-sm text-white bg-white/5 border border-white/10 focus:outline-none focus:border-white/25 placeholder-white/20"
            />
          </section>

          {/* Env vars */}
          {envVars.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Environment</h3>
              <div className="flex flex-col gap-2">
                {envVars.map((e, i) => (
                  <div key={i} className="flex flex-col gap-1">
                    <label className="text-xs text-white/40">
                      {e.key}
                      {e.required && <span className="text-red-400 ml-1">*</span>}
                      {e.hint && <span className="text-white/25 ml-1">— {e.hint}</span>}
                    </label>
                    <input
                      type="text"
                      value={e.value}
                      onChange={ev => updateEnv(i, ev.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg text-sm text-white bg-white/5 border border-white/10 focus:outline-none focus:border-white/25"
                    />
                  </div>
                ))}
              </div>
            </section>
          )}

          {error && (
            <div className="px-3 py-2 rounded-lg text-sm text-red-300 bg-red-500/10 border border-red-500/20">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-white/5 flex items-center justify-between gap-3">
          <a
            href={`https://hub.docker.com/r/${app.image.split(':')[0]}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition-colors"
          >
            <ExternalLink size={12} />
            Docker Hub
          </a>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm text-white/60 hover:text-white/90 hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={install}
              disabled={installing}
              className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium text-white transition-all disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg,#d97706,#b45309)' }}
            >
              <Download size={14} />
              {installing ? 'Installing…' : 'Install'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
