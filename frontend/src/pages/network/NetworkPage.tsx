import { useState, useEffect } from 'react'
import { Wifi, ShieldCheck, Cable, Plus, Trash2, Power, Globe } from 'lucide-react'

interface Interface {
  name: string
  ip: string
  mac: string
  status: 'connected' | 'disconnected'
  speed: string
  rx: number // KB/s
  tx: number // KB/s
}

interface FirewallRule {
  id: string
  port: string
  protocol: 'tcp' | 'udp'
  allow: boolean
  comment: string
}

interface ProxyHost {
  id: string
  domain: string
  forwardIp: string
  forwardPort: string
  ssl: boolean
}

export function NetworkPage() {
  const [activeTab, setActiveTab] = useState<'interfaces' | 'tailscale' | 'firewall' | 'proxy'>('interfaces')

  // Mock data representing a NAS network configuration
  const [interfaces, setInterfaces] = useState<Interface[]>([
    { name: 'enp3s0 (Ethernet 1)', ip: '192.168.1.150', mac: 'b4:2e:99:a4:f1:22', status: 'connected', speed: '1000 Mbps', rx: 34.2, tx: 12.8 },
    { name: 'enp4s0 (Ethernet 2)', ip: 'Nenhum', mac: 'b4:2e:99:a4:f1:23', status: 'disconnected', speed: 'Desconhecido', rx: 0, tx: 0 },
    { name: 'tailscale0 (VPN)', ip: '100.84.150.12', mac: 'N/A', status: 'connected', speed: 'Virtual', rx: 1.5, tx: 0.8 },
  ])

  const [tailscaleConnected, setTailscaleConnected] = useState(true)
  const [tailscaleNode] = useState('kura-nas.taila581.ts.net')

  const [firewallRules, setFirewallRules] = useState<FirewallRule[]>([
    { id: 'f1', port: '80', protocol: 'tcp', allow: true, comment: 'HTTP Default' },
    { id: 'f2', port: '443', protocol: 'tcp', allow: true, comment: 'HTTPS Default' },
    { id: 'f3', port: '22', protocol: 'tcp', allow: true, comment: 'SSH Daemon' },
    { id: 'f4', port: '8080', protocol: 'tcp', allow: true, comment: 'Kura Web Portal' },
    { id: 'f5', port: '32400', protocol: 'tcp', allow: false, comment: 'Plex WAN Block' },
  ])

  const [proxyHosts, setProxyHosts] = useState<ProxyHost[]>([
    { id: 'p1', domain: 'nas.kura.local', forwardIp: '127.0.0.1', forwardPort: '8080', ssl: true },
    { id: 'p2', domain: 'plex.kura.local', forwardIp: '127.0.0.1', forwardPort: '32400', ssl: false },
    { id: 'p3', domain: 'docker.kura.local', forwardIp: '127.0.0.1', forwardPort: '9000', ssl: true },
  ])

  // Modals state
  const [showFirewallModal, setShowFirewallModal] = useState(false)
  const [newRulePort, setNewRulePort] = useState('')
  const [newRuleProto, setNewRuleProto] = useState<'tcp' | 'udp'>('tcp')
  const [newRuleAllow, setNewRuleAllow] = useState(true)
  const [newRuleComment, setNewRuleComment] = useState('')

  const [showProxyModal, setShowProxyModal] = useState(false)
  const [newProxyDomain, setNewProxyDomain] = useState('')
  const [newProxyIp, setNewProxyIp] = useState('127.0.0.1')
  const [newProxyPort, setNewProxyPort] = useState('')
  const [newProxySsl, setNewProxySsl] = useState(true)

  // Dynamic traffic update loop
  useEffect(() => {
    const id = setInterval(() => {
      setInterfaces(prev =>
        prev.map(i => {
          if (i.status === 'disconnected') return i
          const rxChange = (Math.random() - 0.5) * 15
          const txChange = (Math.random() - 0.5) * 8
          return {
            ...i,
            rx: Math.max(0.5, Number((i.rx + rxChange).toFixed(1))),
            tx: Math.max(0.2, Number((i.tx + txChange).toFixed(1))),
          }
        })
      )
    }, 2500)
    return () => clearInterval(id)
  }, [])

  const handleAddRule = (e: React.FormEvent) => {
    e.preventDefault()
    const newRule: FirewallRule = {
      id: 'f' + (firewallRules.length + 1),
      port: newRulePort,
      protocol: newRuleProto,
      allow: newRuleAllow,
      comment: newRuleComment,
    }
    setFirewallRules([...firewallRules, newRule])
    setShowFirewallModal(false)
    setNewRulePort('')
    setNewRuleComment('')
  }

  const handleAddProxy = (e: React.FormEvent) => {
    e.preventDefault()
    const newProxy: ProxyHost = {
      id: 'p' + (proxyHosts.length + 1),
      domain: newProxyDomain,
      forwardIp: newProxyIp,
      forwardPort: newProxyPort,
      ssl: newProxySsl,
    }
    setProxyHosts([...proxyHosts, newProxy])
    setShowProxyModal(false)
    setNewProxyDomain('')
    setNewProxyPort('')
  }

  return (
    <div className="p-6 h-full flex flex-col gap-6 text-white/90">
      {/* Title & Info */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Rede & Conectividade</h2>
          <p className="text-white/50 text-sm mt-0.5">Configuração de interfaces físicas, túnel VPN Tailscale, regras de firewall e proxy inverso</p>
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="flex border-b border-white/10 shrink-0 gap-2">
        <button
          onClick={() => setActiveTab('interfaces')}
          className={`flex items-center gap-2 px-4 py-2 border-b-2 font-medium text-sm transition-all cursor-pointer ${
            activeTab === 'interfaces' ? 'border-sky-500 text-sky-400' : 'border-transparent text-white/50 hover:text-white/80'
          }`}
        >
          <Cable className="w-4 h-4" />
          Interfaces Físicas
        </button>
        <button
          onClick={() => setActiveTab('tailscale')}
          className={`flex items-center gap-2 px-4 py-2 border-b-2 font-medium text-sm transition-all cursor-pointer ${
            activeTab === 'tailscale' ? 'border-sky-500 text-sky-400' : 'border-transparent text-white/50 hover:text-white/80'
          }`}
        >
          <Wifi className="w-4 h-4" />
          Tailscale VPN
        </button>
        <button
          onClick={() => setActiveTab('firewall')}
          className={`flex items-center gap-2 px-4 py-2 border-b-2 font-medium text-sm transition-all cursor-pointer ${
            activeTab === 'firewall' ? 'border-sky-500 text-sky-400' : 'border-transparent text-white/50 hover:text-white/80'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          Firewall (UFW)
        </button>
        <button
          onClick={() => setActiveTab('proxy')}
          className={`flex items-center gap-2 px-4 py-2 border-b-2 font-medium text-sm transition-all cursor-pointer ${
            activeTab === 'proxy' ? 'border-sky-500 text-sky-400' : 'border-transparent text-white/50 hover:text-white/80'
          }`}
        >
          <Globe className="w-4 h-4" />
          Proxy Inverso
        </button>
      </div>

      {/* Contents */}
      <div className="flex-1 overflow-auto">
        {/* 1. PHYSICAL INTERFACES */}
        {activeTab === 'interfaces' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {interfaces.map(i => (
              <div key={i.name} className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3 hover:bg-white/8 transition-all">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2.5">
                    <Cable className={`w-5 h-5 ${i.status === 'connected' ? 'text-sky-400' : 'text-white/30'}`} />
                    <span className="font-bold text-white text-sm">{i.name}</span>
                  </div>
                  <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                    i.status === 'connected' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-white/10 text-white/40'
                  }`}>
                    {i.status === 'connected' ? 'Ativo' : 'Inativo'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-white/5 p-2 rounded border border-white/5">
                    <span className="text-white/40">Endereço IP</span>
                    <div className="font-mono mt-0.5 text-white/80">{i.ip}</div>
                  </div>
                  <div className="bg-white/5 p-2 rounded border border-white/5">
                    <span className="text-white/40">MAC Address</span>
                    <div className="font-mono mt-0.5 text-white/80">{i.mac}</div>
                  </div>
                </div>

                {i.status === 'connected' && (
                  <div className="border-t border-white/5 pt-2.5 flex justify-between items-center text-xs font-mono text-white/50">
                    <span>Velocidade: {i.speed}</span>
                    <span className="text-sky-400">Rx: {i.rx} KB/s · Tx: {i.tx} KB/s</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* 2. TAILSCALE VPN */}
        {activeTab === 'tailscale' && (
          <div className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-5">
            <div className="flex justify-between items-center border-b border-white/5 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-sky-500/10 text-sky-400 rounded-xl border border-sky-500/20">
                  <Wifi className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Túnel VPN Tailscale</h3>
                  <p className="text-xs text-white/40">Aceda ao seu NAS KuraOS de qualquer lugar do mundo de forma segura e criptografada</p>
                </div>
              </div>

              <button
                onClick={() => setTailscaleConnected(!tailscaleConnected)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white font-semibold text-xs transition-colors cursor-pointer ${
                  tailscaleConnected ? 'bg-red-500 hover:bg-red-600' : 'bg-emerald-500 hover:bg-emerald-600'
                }`}
              >
                <Power className="w-3.5 h-3.5" />
                {tailscaleConnected ? 'Desconectar' : 'Conectar VPN'}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="bg-white/5 p-3 rounded-lg border border-white/5 space-y-1">
                <span className="text-xs text-white/40">Endereço IP VPN (100.X.X.X)</span>
                <div className="font-mono text-white font-bold">{tailscaleConnected ? '100.84.150.12' : 'N/A'}</div>
              </div>
              <div className="bg-white/5 p-3 rounded-lg border border-white/5 space-y-1">
                <span className="text-xs text-white/40">Nome do Nó de Rede</span>
                <div className="font-mono text-white font-bold">{tailscaleConnected ? tailscaleNode : 'N/A'}</div>
              </div>
            </div>

            <div className="text-xs bg-sky-500/5 border border-sky-500/10 p-3 rounded-lg text-sky-300">
              * O Tailscale está ativo em modo de rede partilhada. Pode utilizar o NAS como Exit Node para encriptar a sua ligação móvel pública!
            </div>
          </div>
        )}

        {/* 3. FIREWALL */}
        {activeTab === 'firewall' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-white">Regras de Acesso e Segurança (UFW)</h3>
              <button
                onClick={() => setShowFirewallModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-medium text-xs transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Adicionar Regra
              </button>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-white/10 bg-white/5 text-white/40">
                    <th className="p-3">Porta</th>
                    <th className="p-3">Protocolo</th>
                    <th className="p-3">Ação</th>
                    <th className="p-3">Descrição</th>
                    <th className="p-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-white/80">
                  {firewallRules.map(rule => (
                    <tr key={rule.id} className="hover:bg-white/5 transition-colors">
                      <td className="p-3 font-mono font-bold text-white">{rule.port}</td>
                      <td className="p-3 uppercase font-mono">{rule.protocol}</td>
                      <td className="p-3">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                          rule.allow ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                        }`}>
                          {rule.allow ? 'Permitir' : 'Bloquear'}
                        </span>
                      </td>
                      <td className="p-3 text-white/50">{rule.comment}</td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => setFirewallRules(prev => prev.filter(r => r.id !== rule.id))}
                          className="text-red-400 hover:text-red-300 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 4. PROXY INVERSO */}
        {activeTab === 'proxy' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-white">Proxy Inverso (Serviços Web do Servidor)</h3>
              <button
                onClick={() => setShowProxyModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-medium text-xs transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Adicionar Proxy Host
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {proxyHosts.map(proxy => (
                <div key={proxy.id} className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3 hover:bg-white/8 transition-all">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-bold text-white text-sm flex items-center gap-1.5">
                        <Globe className="w-4 h-4 text-sky-400" />
                        {proxy.domain}
                      </div>
                      <div className="text-xs text-white/40 font-mono mt-1">
                        Encaminha para: <span className="text-white/80 font-bold">{proxy.forwardIp}:{proxy.forwardPort}</span>
                      </div>
                    </div>
                    {proxy.ssl && (
                      <span className="text-[9px] uppercase bg-teal-500/10 border border-teal-500/20 text-teal-400 font-bold px-1.5 py-0.5 rounded font-mono">
                        SSL Ativo
                      </span>
                    )}
                  </div>

                  <div className="border-t border-white/5 pt-2 flex justify-end">
                    <button
                      onClick={() => setProxyHosts(prev => prev.filter(p => p.id !== proxy.id))}
                      className="text-red-400 hover:text-red-300 text-xs flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Remover Host
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* FIREWALL ADD MODAL */}
      {showFirewallModal && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <form onSubmit={handleAddRule} className="rounded-xl p-5 w-full max-w-sm space-y-4 animate-in fade-in zoom-in duration-200"
            style={{
              background: 'var(--kura-glass)',
              backdropFilter: 'blur(32px) saturate(1.5)',
              border: '1px solid var(--kura-alpha-08)',
              boxShadow: '0 32px 80px var(--kura-shadow), 0 0 0 0.5px var(--kura-glass-border) inset',
            }}>
            <h3 className="font-bold text-lg text-white">Criar Nova Regra de Acesso</h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs text-white/40">Porta de Entrada</label>
                <input
                  type="text"
                  placeholder="8080"
                  value={newRulePort}
                  onChange={e => setNewRulePort(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-white/40">Protocolo</label>
                <select
                  value={newRuleProto}
                  onChange={e => setNewRuleProto(e.target.value as any)}
                  className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                >
                  <option value="tcp">TCP</option>
                  <option value="udp">UDP</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-white/40">Ação de Segurança</label>
              <select
                value={newRuleAllow ? 'true' : 'false'}
                onChange={e => setNewRuleAllow(e.target.value === 'true')}
                className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
              >
                <option value="true">Permitir Tráfego</option>
                <option value="false">Bloquear Porta</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-white/40">Comentário / Descrição</label>
              <input
                type="text"
                placeholder="Serviço de FTP"
                value={newRuleComment}
                onChange={e => setNewRuleComment(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
              <button
                type="button"
                onClick={() => setShowFirewallModal(false)}
                className="px-3 py-1.5 rounded-lg hover:bg-white/5 text-white/60 text-xs font-semibold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold cursor-pointer"
              >
                Ativar Regra
              </button>
            </div>
          </form>
        </div>
      )}

      {/* PROXY ADD MODAL */}
      {showProxyModal && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <form onSubmit={handleAddProxy} className="rounded-xl p-5 w-full max-w-sm space-y-4"
            style={{
              background: 'var(--kura-glass)',
              backdropFilter: 'blur(32px) saturate(1.5)',
              border: '1px solid var(--kura-alpha-08)',
              boxShadow: '0 32px 80px var(--kura-shadow), 0 0 0 0.5px var(--kura-glass-border) inset',
            }}>
            <h3 className="font-bold text-lg text-white">Configurar Novo Proxy Host</h3>

            <div className="space-y-1">
              <label className="text-xs text-white/40">Domínio da Partilha (Subdomain)</label>
              <input
                type="text"
                placeholder="dashboard.kura.local"
                value={newProxyDomain}
                onChange={e => setNewProxyDomain(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white font-mono"
                required
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2 space-y-1">
                <label className="text-xs text-white/40">Encaminhar IP</label>
                <input
                  type="text"
                  value={newProxyIp}
                  onChange={e => setNewProxyIp(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white font-mono"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-white/40">Porta Destino</label>
                <input
                  type="text"
                  placeholder="8080"
                  value={newProxyPort}
                  onChange={e => setNewProxyPort(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white font-mono"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-white/40">Encriptação SSL (Let's Encrypt)</label>
              <select
                value={newProxySsl ? 'true' : 'false'}
                onChange={e => setNewProxySsl(e.target.value === 'true')}
                className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
              >
                <option value="true">Forçar SSL / Redirecionar HTTPS</option>
                <option value="false">Desativado (HTTP Simples)</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
              <button
                type="button"
                onClick={() => setShowProxyModal(false)}
                className="px-3 py-1.5 rounded-lg hover:bg-white/5 text-white/60 text-xs font-semibold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold cursor-pointer"
              >
                Criar Host Proxy
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
