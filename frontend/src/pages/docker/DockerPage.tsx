import { useState, useEffect } from 'react'
import { Play, Square, RotateCw, Terminal, Layers, Plus, HardDrive, Activity, Cpu, Trash2 } from 'lucide-react'

interface Container {
  id: string
  name: string
  image: string
  status: 'running' | 'stopped'
  ports: string
  cpu: number
  memory: string
  uptime: string
}

interface DockerImage {
  repository: string
  tag: string
  size: string
  id: string
}

export function DockerPage() {
  const [activeTab, setActiveTab] = useState<'containers' | 'stacks' | 'images' | 'stats'>('containers')

  // Mock containers state with realistic NAS server containers
  const [containers, setContainers] = useState<Container[]>([
    { id: 'c1', name: 'portainer', image: 'portainer/portainer-ce:latest', status: 'running', ports: '9000:9000', cpu: 0.8, memory: '48.2 MB', uptime: '3 dias' },
    { id: 'c2', name: 'nginx-proxy-manager', image: 'jc21/nginx-proxy-manager:latest', status: 'running', ports: '80:80, 443:443, 81:81', cpu: 1.4, memory: '128.4 MB', uptime: '3 dias' },
    { id: 'c3', name: 'transmission', image: 'lscr.io/linuxserver/transmission:latest', status: 'running', ports: '9091:9091, 51413:51413', cpu: 12.5, memory: '256.1 MB', uptime: '1 dia' },
    { id: 'c4', name: 'plex-media-server', image: 'lscr.io/linuxserver/plex:latest', status: 'running', ports: '32400:32400', cpu: 3.2, memory: '512.9 MB', uptime: '12 horas' },
    { id: 'c5', name: 'nextcloud', image: 'nextcloud:latest', status: 'stopped', ports: '8080:80', cpu: 0, memory: '0 MB', uptime: 'Parado' },
  ])

  const [images, setImages] = useState<DockerImage[]>([
    { repository: 'portainer/portainer-ce', tag: 'latest', size: '286 MB', id: 'sha256:d82bf4f' },
    { repository: 'jc21/nginx-proxy-manager', tag: 'latest', size: '412 MB', id: 'sha256:a48cf3b' },
    { repository: 'lscr.io/linuxserver/transmission', tag: 'latest', size: '185 MB', id: 'sha256:f123bd8' },
    { repository: 'lscr.io/linuxserver/plex', tag: 'latest', size: '750 MB', id: 'sha256:9c84fa2' },
    { repository: 'nextcloud', tag: 'latest', size: '820 MB', id: 'sha256:e138cd9' },
  ])

  // Active stack logs / Compose state
  const [showComposeModal, setShowComposeModal] = useState(false)
  const [composeText, setComposeText] = useState(`version: '3.8'
services:
  homeassistant:
    container_name: homeassistant
    image: "ghcr.io/home-assistant/home-assistant:stable"
    volumes:
      - /srv/homeassistant/config:/config
      - /etc/localtime:/etc/localtime:ro
    restart: unless-stopped
    network_mode: host`)

  const [logsContainer, setLogsContainer] = useState<Container | null>(null)
  const [logs, setLogs] = useState<string[]>([])

  // Simulate active CPU/Memory changes for containers
  useEffect(() => {
    const id = setInterval(() => {
      setContainers(prev =>
        prev.map(c => {
          if (c.status === 'stopped') return c
          const change = (Math.random() - 0.5) * 1.5
          const newCpu = Math.max(0.1, Math.min(60, Number((c.cpu + change).toFixed(1))))
          return { ...c, cpu: newCpu }
        })
      )
    }, 3000)
    return () => clearInterval(id)
  }, [])

  const handleToggleStatus = (id: string) => {
    setContainers(prev =>
      prev.map(c => {
        if (c.id === id) {
          const newStatus = c.status === 'running' ? 'stopped' : 'running'
          return {
            ...c,
            status: newStatus,
            cpu: 0,
            memory: newStatus === 'running' ? '128 MB' : '0 MB',
            uptime: newStatus === 'running' ? 'Poucos segundos' : 'Parado',
          }
        }
        return c
      })
    )
  }

  const handleDeployStack = (e: React.FormEvent) => {
    e.preventDefault()
    // Simulate stack deploy
    const newContainer: Container = {
      id: 'c' + (containers.length + 1),
      name: 'homeassistant',
      image: 'ghcr.io/home-assistant/home-assistant:stable',
      status: 'running',
      ports: '8123:8123',
      cpu: 2.5,
      memory: '190.2 MB',
      uptime: 'Criado agora',
    }
    setContainers([...containers, newContainer])
    setShowComposeModal(false)
  }

  const openLogs = (c: Container) => {
    setLogsContainer(c)
    setLogs([
      `[kura-docker-daemon] Fetching logs for container "${c.name}"...`,
      `[${c.name}] Loading environment configurations...`,
      `[${c.name}] Initializing database connectivity: SUCCESS`,
      `[${c.name}] Listening on virtual interface: http://0.0.0.0:${c.ports.split(':')[0]}`,
      `[${c.name}] Ready for connections. Listening for HTTP requests.`,
      `[${c.name}] [info] Cron workers successfully scheduled.`,
    ])
  }

  return (
    <div className="p-6 h-full flex flex-col gap-6 text-white/90">
      {/* Title & Info */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Docker Engine</h2>
          <p className="text-white/50 text-sm mt-0.5">Gestão de contentores, ficheiros docker-compose, imagens e métricas de desempenho</p>
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="flex border-b border-white/10 shrink-0 gap-2">
        <button
          onClick={() => setActiveTab('containers')}
          className={`flex items-center gap-2 px-4 py-2 border-b-2 font-medium text-sm transition-all cursor-pointer ${
            activeTab === 'containers' ? 'border-sky-500 text-sky-400' : 'border-transparent text-white/50 hover:text-white/80'
          }`}
        >
          <Activity className="w-4 h-4" />
          Contentores
        </button>
        <button
          onClick={() => setActiveTab('stacks')}
          className={`flex items-center gap-2 px-4 py-2 border-b-2 font-medium text-sm transition-all cursor-pointer ${
            activeTab === 'stacks' ? 'border-sky-500 text-sky-400' : 'border-transparent text-white/50 hover:text-white/80'
          }`}
        >
          <Layers className="w-4 h-4" />
          Compose & Stacks
        </button>
        <button
          onClick={() => setActiveTab('images')}
          className={`flex items-center gap-2 px-4 py-2 border-b-2 font-medium text-sm transition-all cursor-pointer ${
            activeTab === 'images' ? 'border-sky-500 text-sky-400' : 'border-transparent text-white/50 hover:text-white/80'
          }`}
        >
          <HardDrive className="w-4 h-4" />
          Imagens
        </button>
      </div>

      {/* Contents */}
      <div className="flex-1 overflow-auto">
        {/* 1. CONTAINERS */}
        {activeTab === 'containers' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full items-start">
            <div className="lg:col-span-2 space-y-3">
              {containers.map(c => (
                <div key={c.id} className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center justify-between hover:bg-white/8 transition-all">
                  <div className="flex items-center gap-4">
                    <div className={`w-3 h-3 rounded-full ${c.status === 'running' ? 'bg-emerald-500 animate-pulse' : 'bg-white/20'}`} />
                    <div>
                      <div className="font-bold text-white text-sm flex items-center gap-2">
                        {c.name}
                        <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded text-white/40 font-mono font-normal">{c.ports}</span>
                      </div>
                      <div className="text-xs text-white/40 font-mono mt-0.5">{c.image}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    {c.status === 'running' && (
                      <div className="text-right hidden sm:block text-xs">
                        <div className="flex items-center gap-1.5 text-white/70">
                          <Cpu className="w-3.5 h-3.5 text-sky-400" />
                          <span>CPU: {c.cpu}%</span>
                        </div>
                        <div className="text-white/40 mt-0.5">RAM: {c.memory}</div>
                      </div>
                    )}

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleToggleStatus(c.id)}
                        className={`p-1.5 rounded-lg border cursor-pointer transition-colors ${
                          c.status === 'running'
                            ? 'border-red-500/20 text-red-400 hover:bg-red-500/10'
                            : 'border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10'
                        }`}
                        title={c.status === 'running' ? 'Stop Container' : 'Start Container'}
                      >
                        {c.status === 'running' ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => handleToggleStatus(c.id)}
                        className="p-1.5 rounded-lg border border-white/10 text-white/60 hover:text-white hover:bg-white/5 cursor-pointer"
                        title="Restart Container"
                        disabled={c.status === 'stopped'}
                      >
                        <RotateCw className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => openLogs(c)}
                        className="p-1.5 rounded-lg border border-white/10 text-white/60 hover:text-white hover:bg-white/5 cursor-pointer"
                        title="View Container Logs"
                      >
                        <Terminal className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Terminal Logs Sidebar */}
            <div className="bg-slate-950 border border-white/10 rounded-xl p-5 space-y-4 font-mono h-[350px] lg:h-full flex flex-col">
              <h3 className="font-semibold text-white/90 text-sm flex items-center gap-2 font-sans">
                <Terminal className="w-4 h-4 text-sky-400" />
                Terminal Logs
              </h3>

              {!logsContainer ? (
                <div className="text-[11px] text-white/30 text-center py-16 flex-1 flex items-center justify-center font-sans">
                  Selecione o ícone de consola (&gt;_) de um contentor para ler os logs de execução em tempo real.
                </div>
              ) : (
                <div className="flex-1 flex flex-col overflow-hidden text-[10px] space-y-2">
                  <div className="text-white/40 font-bold border-b border-white/5 pb-2 font-sans flex items-center justify-between">
                    <span>Logs: {logsContainer.name}</span>
                    <span className="text-[9px] uppercase bg-emerald-500/10 text-emerald-400 px-1.5 rounded">Active</span>
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-1.5 text-white/70 select-text leading-relaxed">
                    {logs.map((log, index) => (
                      <div key={index} className={log.startsWith('[kura-') ? 'text-sky-400' : ''}>
                        {log}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 2. STACKS / COMPOSE */}
        {activeTab === 'stacks' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-white">Stacks de Serviços Criadas</h3>
              <button
                onClick={() => setShowComposeModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-medium text-xs transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Nova Stack (Compose)
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-white font-mono text-base">media-stack</span>
                  <span className="text-[10px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-semibold px-2 py-0.5 rounded uppercase">Ativa</span>
                </div>
                <p className="text-xs text-white/50 font-mono">Serviços: plex-media-server, transmission, prowlarr</p>
                <div className="border-t border-white/5 pt-2 flex justify-between items-center text-xs">
                  <span className="text-white/40">Ficheiro: docker-compose.yml</span>
                  <button className="text-sky-400 hover:underline cursor-pointer">Editar Código</button>
                </div>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-white font-mono text-base">reverse-proxy</span>
                  <span className="text-[10px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-semibold px-2 py-0.5 rounded uppercase">Ativa</span>
                </div>
                <p className="text-xs text-white/50 font-mono">Serviços: nginx-proxy-manager, db</p>
                <div className="border-t border-white/5 pt-2 flex justify-between items-center text-xs">
                  <span className="text-white/40">Ficheiro: docker-compose.yml</span>
                  <button className="text-sky-400 hover:underline cursor-pointer">Editar Código</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 3. IMAGES */}
        {activeTab === 'images' && (
          <div className="space-y-3">
            <h3 className="font-semibold text-white">Imagens Armazenadas Localmente</h3>
            {images.map(img => (
              <div key={img.id} className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center justify-between hover:bg-white/8 transition-all font-mono text-xs">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-white/5 rounded-lg border border-white/5 text-white/40 font-sans">IMG</div>
                  <div>
                    <div className="font-bold text-white font-sans text-sm">{img.repository}</div>
                    <div className="text-white/40 mt-0.5">Tag: {img.tag} · ID: {img.id}</div>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <span className="text-white/60 font-semibold">{img.size}</span>
                  <button
                    onClick={() => setImages(prev => prev.filter(i => i.id !== img.id))}
                    className="p-1 rounded text-red-400 hover:bg-red-500/10 transition-all cursor-pointer"
                    title="Remover Imagem"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* COMPOSE STACK DEPLOY MODAL */}
      {showComposeModal && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <form onSubmit={handleDeployStack} className="rounded-xl p-5 w-full max-w-xl flex flex-col h-[500px]"
            style={{
              background: 'var(--kura-glass)',
              backdropFilter: 'blur(32px) saturate(1.5)',
              border: '1px solid var(--kura-alpha-08)',
              boxShadow: '0 32px 80px var(--kura-shadow), 0 0 0 0.5px var(--kura-glass-border) inset',
            }}>
            <h3 className="font-bold text-lg text-white mb-2 shrink-0">Nova Stack Docker Compose</h3>

            <div className="flex-1 flex flex-col min-h-0 space-y-1.5 mb-4">
              <label className="text-xs text-white/40 shrink-0">Ficheiro YAML de Compose</label>
              <textarea
                value={composeText}
                onChange={e => setComposeText(e.target.value)}
                className="flex-1 w-full bg-slate-950 border border-white/10 rounded-lg p-3 text-xs text-white font-mono leading-relaxed resize-none focus:outline-none focus:border-sky-500/50"
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-white/5 shrink-0">
              <button
                type="button"
                onClick={() => setShowComposeModal(false)}
                className="px-3 py-1.5 rounded-lg hover:bg-white/5 text-white/60 text-xs font-semibold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Deploy Stack
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
