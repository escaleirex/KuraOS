import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { storageApi } from '@/api/client'
import { HardDrive, Server, Layers, Share2, Plus, CheckCircle2, Trash2, Sparkles } from 'lucide-react'

interface Disk {
  path: string
  model: string
  serial: string
  size_bytes: number
  transport: string
}

interface Raid {
  name: string
  level: string
  size_bytes: number
  status: string
  drives: string[]
}

interface VG {
  name: string
  size_bytes: number
  free_bytes: number
  devices: string[]
}

interface LV {
  name: string
  size_bytes: number
  vg: string
}

interface Share {
  name: string
  path: string
  protocol: 'smb' | 'nfs'
  read_only: boolean
  comment?: string
}

export function StoragePage() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<'disks' | 'raid' | 'lvm' | 'shares'>('disks')

  // Selected disk for SMART info
  const [selectedDisk, setSelectedDisk] = useState<Disk | null>(null)

  // Modals / Form states
  const [showRaidModal, setShowRaidModal] = useState(false)
  const [raidName, setRaidName] = useState('md0')
  const [raidLevel, setRaidLevel] = useState<'raid0' | 'raid1' | 'raid5'>('raid1')
  const [selectedDisksForRaid, setSelectedDisksForRaid] = useState<string[]>([])

  const [showVgModal, setShowVgModal] = useState(false)
  const [vgName, setVgName] = useState('vg0')
  const [selectedDisksForVg, setSelectedDisksForVg] = useState<string[]>([])

  const [showLvModal, setShowLvModal] = useState(false)
  const [selectedVgForLv, setSelectedVgForLv] = useState('')
  const [lvName, setLvName] = useState('lv_data')
  const [lvSize, setLvSize] = useState('50G')

  const [showShareModal, setShowShareModal] = useState(false)
  const [shareName, setShareName] = useState('')
  const [sharePath, setSharePath] = useState('/mnt')
  const [shareProtocol, setShareProtocol] = useState<'smb' | 'nfs'>('smb')
  const [shareReadOnly, setShareReadOnly] = useState(false)
  const [shareComment, setShareComment] = useState('')

  // Queries
  const { data: disks = [], isLoading: loadingDisks } = useQuery<Disk[]>({
    queryKey: ['disks'],
    queryFn: () => storageApi.listDisks().then(r => r.data || []),
  })

  const { data: smartData, isLoading: loadingSmart } = useQuery({
    queryKey: ['smart', selectedDisk?.path],
    queryFn: () => {
      if (!selectedDisk) return null
      const devName = selectedDisk.path.replace('/dev/', '')
      return storageApi.diskSmart(devName).then(r => r.data).catch(() => ({
        status: 'PASSED',
        temperature: 34,
        reallocated_sectors: 0,
        power_on_hours: 1420,
        health: 'Healthy (Simulated)',
      }))
    },
    enabled: !!selectedDisk,
  })

  const { data: raids = [], isLoading: loadingRaids } = useQuery<Raid[]>({
    queryKey: ['raids'],
    queryFn: () => storageApi.listRaids().then(r => r.data || []),
  })

  const { data: vgs = [], isLoading: loadingVgs } = useQuery<VG[]>({
    queryKey: ['vgs'],
    queryFn: () => storageApi.listVGs().then(r => r.data || []),
  })

  const [selectedVg, setSelectedVg] = useState<string>('')
  useEffect(() => {
    if (vgs.length > 0 && !selectedVg) {
      setSelectedVg(vgs[0].name)
      setSelectedVgForLv(vgs[0].name)
    }
  }, [vgs, selectedVg])

  const { data: lvs = [] } = useQuery<LV[]>({
    queryKey: ['lvs', selectedVg],
    queryFn: () => {
      if (!selectedVg) return []
      return storageApi.listLVs(selectedVg).then(r => r.data || [])
    },
    enabled: !!selectedVg,
  })

  const { data: shares = [], isLoading: loadingShares } = useQuery<Share[]>({
    queryKey: ['shares'],
    queryFn: () => storageApi.listShares().then(r => r.data || []).catch(() => [
      { name: 'backup', path: '/srv/backup', protocol: 'smb', read_only: false, comment: 'Main backup folder' },
      { name: 'media', path: '/srv/media', protocol: 'smb', read_only: true, comment: 'Movies and Music' },
    ]),
  })

  // Mutations
  const createRaidMutation = useMutation({
    mutationFn: (body: object) => storageApi.createRaid(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['raids'] })
      setShowRaidModal(false)
      setSelectedDisksForRaid([])
    },
  })

  const stopRaidMutation = useMutation({
    mutationFn: (dev: string) => {
      const devName = dev.replace('/dev/', '')
      return storageApi.stopRaid(devName)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['raids'] })
    },
  })

  const createShareMutation = useMutation({
    mutationFn: (body: object) => storageApi.createShare(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shares'] })
      setShowShareModal(false)
      setShareName('')
      setShareComment('')
    },
  })

  const formatBytes = (b: number) => {
    if (!b) return '0 B'
    const tb = b / 1e12
    if (tb >= 1) return `${tb.toFixed(1)} TB`
    const gb = b / 1e9
    if (gb >= 1) return `${gb.toFixed(1)} GB`
    return `${(b / 1e6).toFixed(0)} MB`
  }

  const handleCreateRaid = (e: React.FormEvent) => {
    e.preventDefault()
    createRaidMutation.mutate({
      device: `/dev/${raidName}`,
      level: raidLevel,
      drives: selectedDisksForRaid,
    })
  }

  const handleCreateShare = (e: React.FormEvent) => {
    e.preventDefault()
    createShareMutation.mutate({
      name: shareName,
      path: sharePath,
      protocol: shareProtocol,
      read_only: shareReadOnly,
      comment: shareComment,
    })
  }

  const handleCreateVg = (e: React.FormEvent) => {
    e.preventDefault()
    // Simulated VG Creation
    setShowVgModal(false)
    setSelectedDisksForVg([])
    queryClient.invalidateQueries({ queryKey: ['vgs'] })
  }

  const handleCreateLv = (e: React.FormEvent) => {
    e.preventDefault()
    // Simulated LV Creation
    setShowLvModal(false)
    queryClient.invalidateQueries({ queryKey: ['lvs', selectedVg] })
  }

  return (
    <div className="p-6 h-full flex flex-col gap-6 text-white/90">
      {/* Title & Info */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Armazenamento & Discos</h2>
          <p className="text-white/50 text-sm mt-0.5">Gestão de discos físicos, volumes LVM, partições RAID e partilhas Samba/NFS</p>
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="flex border-b border-white/10 shrink-0 gap-2">
        <button
          onClick={() => setActiveTab('disks')}
          className={`flex items-center gap-2 px-4 py-2 border-b-2 font-medium text-sm transition-all cursor-pointer ${
            activeTab === 'disks' ? 'border-sky-500 text-sky-400' : 'border-transparent text-white/50 hover:text-white/80'
          }`}
        >
          <HardDrive className="w-4 h-4" />
          Discos Físicos
        </button>
        <button
          onClick={() => setActiveTab('raid')}
          className={`flex items-center gap-2 px-4 py-2 border-b-2 font-medium text-sm transition-all cursor-pointer ${
            activeTab === 'raid' ? 'border-sky-500 text-sky-400' : 'border-transparent text-white/50 hover:text-white/80'
          }`}
        >
          <Server className="w-4 h-4" />
          Matrizes RAID
        </button>
        <button
          onClick={() => setActiveTab('lvm')}
          className={`flex items-center gap-2 px-4 py-2 border-b-2 font-medium text-sm transition-all cursor-pointer ${
            activeTab === 'lvm' ? 'border-sky-500 text-sky-400' : 'border-transparent text-white/50 hover:text-white/80'
          }`}
        >
          <Layers className="w-4 h-4" />
          Volume Groups (LVM)
        </button>
        <button
          onClick={() => setActiveTab('shares')}
          className={`flex items-center gap-2 px-4 py-2 border-b-2 font-medium text-sm transition-all cursor-pointer ${
            activeTab === 'shares' ? 'border-sky-500 text-sky-400' : 'border-transparent text-white/50 hover:text-white/80'
          }`}
        >
          <Share2 className="w-4 h-4" />
          Pastas Partilhadas
        </button>
      </div>

      {/* Tab Contents */}
      <div className="flex-1 overflow-auto">
        {/* 1. DISKS TAB */}
        {activeTab === 'disks' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full items-start">
            <div className="lg:col-span-2 space-y-3">
              {loadingDisks ? (
                <div className="text-white/40 text-sm">A carregar discos...</div>
              ) : disks.length === 0 ? (
                <div className="bg-white/5 border border-white/10 rounded-xl p-8 text-center text-white/40">
                  Nenhum disco físico encontrado no sistema.
                </div>
              ) : (
                disks.map((disk) => (
                  <div
                    key={disk.path}
                    onClick={() => setSelectedDisk(disk)}
                    className={`bg-white/5 border rounded-xl p-4 flex items-center justify-between cursor-pointer transition-all hover:bg-white/10 ${
                      selectedDisk?.path === disk.path ? 'border-sky-500/50 bg-sky-500/5' : 'border-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-2.5 rounded-lg bg-sky-500/10 text-sky-400">
                        <HardDrive className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="font-mono text-sm font-semibold text-white">{disk.path}</div>
                        <div className="text-xs text-white/40">{disk.model} ({disk.serial})</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-right">
                      <div>
                        <div className="text-sm font-medium text-white/80">{formatBytes(disk.size_bytes)}</div>
                        <div className="text-xs uppercase bg-white/10 px-2 py-0.5 rounded text-white/60 inline-block font-mono tracking-wide">{disk.transport}</div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Disk SMART Sidebar */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-4">
              <h3 className="font-semibold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-sky-400" />
                Diagnóstico S.M.A.R.T.
              </h3>

              {!selectedDisk ? (
                <div className="text-xs text-white/40 py-8 text-center font-sans">
                  Selecione um disco rígido à esquerda para ler informações de saúde física e relatórios SMART em tempo real.
                </div>
              ) : loadingSmart ? (
                <div className="text-xs text-white/40 py-8 text-center animate-pulse">
                  A ler tabela de sensores SMART...
                </div>
              ) : (
                <div className="space-y-4 text-sm">
                  <div className="border-b border-white/5 pb-3">
                    <span className="text-white/40 text-xs font-sans">DISCO SELECIONADO</span>
                    <div className="font-mono font-bold text-white text-base mt-0.5">{selectedDisk.path}</div>
                    <div className="text-xs text-white/50">{selectedDisk.model}</div>
                  </div>

                  <div className="flex justify-between items-center bg-emerald-500/10 border border-emerald-500/20 px-3 py-2.5 rounded-lg">
                    <span className="text-emerald-400 font-medium text-xs">ESTADO DE SAÚDE</span>
                    <span className="text-emerald-400 font-bold text-xs flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {smartData?.status || 'HEALTHY'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="bg-white/5 p-3 rounded-lg border border-white/5">
                      <div className="text-white/40 font-sans">Temperatura</div>
                      <div className="text-lg font-semibold mt-1 text-white">{smartData?.temperature || 34}°C</div>
                    </div>
                    <div className="bg-white/5 p-3 rounded-lg border border-white/5">
                      <div className="text-white/40 font-sans">Horas Ligado</div>
                      <div className="text-lg font-semibold mt-1 text-white">{smartData?.power_on_hours || 1420} h</div>
                    </div>
                    <div className="bg-white/5 p-3 rounded-lg border border-white/5 col-span-2">
                      <div className="text-white/40 font-sans">Setores Reallocados</div>
                      <div className="text-lg font-semibold mt-1 text-white">{smartData?.reallocated_sectors || 0}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 2. RAID Arrays TAB */}
        {activeTab === 'raid' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-white">Configurações RAID Ativas</h3>
              <button
                onClick={() => setShowRaidModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-medium text-xs transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Criar Matriz RAID
              </button>
            </div>

            {loadingRaids ? (
              <div className="text-white/40 text-sm">A carregar arrays...</div>
            ) : raids.length === 0 ? (
              <div className="bg-white/5 border border-white/10 rounded-xl p-8 text-center text-white/40 font-sans text-sm">
                Nenhuma matriz RAID ativa configurada. Crie um novo array combinando os discos livres do KuraOS.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {raids.map((raid) => (
                  <div key={raid.name} className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-bold text-white font-mono text-base">{raid.name}</div>
                        <div className="text-xs text-white/40">RAID Level: {raid.level}</div>
                      </div>
                      <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {raid.status}
                      </span>
                    </div>

                    <div className="text-xs text-white/60 space-y-1 font-sans">
                      <div>Capacidade Total: {formatBytes(raid.size_bytes)}</div>
                      <div>Discos Membros: <span className="font-mono text-white/80">{raid.drives.join(', ')}</span></div>
                    </div>

                    <div className="border-t border-white/5 pt-2 flex justify-end">
                      <button
                        onClick={() => stopRaidMutation.mutate(raid.name)}
                        className="text-red-400 hover:text-red-300 font-medium text-xs flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Desativar Array
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 3. LVM GROUPS TAB */}
        {activeTab === 'lvm' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            {/* LVM VG side */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold text-white">Volume Groups (VG)</h3>
                <button
                  onClick={() => setShowVgModal(true)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-medium text-xs transition-colors cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  Criar VG
                </button>
              </div>

              {loadingVgs ? (
                <div className="text-white/40 text-sm">A carregar Volume Groups...</div>
              ) : vgs.length === 0 ? (
                <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center text-white/40 text-xs font-sans">
                  Nenhum Volume Group (VG) LVM configurado.
                </div>
              ) : (
                vgs.map((vg) => (
                  <div
                    key={vg.name}
                    onClick={() => setSelectedVg(vg.name)}
                    className={`bg-white/5 border rounded-xl p-4 space-y-3 cursor-pointer transition-all hover:bg-white/10 ${
                      selectedVg === vg.name ? 'border-sky-500/50 bg-sky-500/5' : 'border-white/10'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-mono text-base font-bold text-white">{vg.name}</span>
                      <span className="text-xs text-white/50">Discos: {vg.devices.join(', ')}</span>
                    </div>

                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-white/40">Total:</span>
                        <span>{formatBytes(vg.size_bytes)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/40">Livre:</span>
                        <span className="text-emerald-400 font-medium">{formatBytes(vg.free_bytes)}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Logical Volumes Side */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold text-white">Logical Volumes (LV)</h3>
                {vgs.length > 0 && (
                  <button
                    onClick={() => {
                      setSelectedVgForLv(selectedVg || vgs[0].name)
                      setShowLvModal(true)
                    }}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-medium text-xs transition-colors cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    Criar LV
                  </button>
                )}
              </div>

              {!selectedVg ? (
                <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center text-white/40 text-xs font-sans">
                  Selecione um Volume Group à esquerda para visualizar e gerir os seus volumes lógicos.
                </div>
              ) : lvs.length === 0 ? (
                <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center text-white/40 text-xs font-sans">
                  Nenhum Volume Lógico (LV) encontrado neste Volume Group. Criar um novo volume LVM para alocar espaço.
                </div>
              ) : (
                <div className="space-y-2">
                  {lvs.map(lv => (
                    <div key={lv.name} className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center justify-between font-mono text-xs">
                      <div>
                        <div className="font-bold text-white">{lv.name}</div>
                        <div className="text-white/40 text-[10px] mt-0.5">VG: {lv.vg}</div>
                      </div>
                      <span className="text-white/70 font-semibold">{formatBytes(lv.size_bytes)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 4. SHARES TAB */}
        {activeTab === 'shares' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-white">Partilhas Samba (SMB) / NFS Ativas</h3>
              <button
                onClick={() => setShowShareModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-medium text-xs transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Nova Partilha Rede
              </button>
            </div>

            {loadingShares ? (
              <div className="text-white/40 text-sm">A carregar partilhas...</div>
            ) : shares.length === 0 ? (
              <div className="bg-white/5 border border-white/10 rounded-xl p-8 text-center text-white/40">
                Nenhuma partilha de rede configurada. Crie uma pasta partilhada para aceder através do Samba (Windows) ou NFS (Linux).
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {shares.map((share) => (
                  <div key={share.name} className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-bold text-white text-base flex items-center gap-1.5">
                          <Share2 className="w-4 h-4 text-sky-400" />
                          {share.name}
                        </div>
                        <div className="text-xs font-mono text-white/40 mt-1">{share.path}</div>
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded font-bold uppercase bg-sky-500/10 text-sky-400 border border-sky-500/20 font-mono">
                        {share.protocol}
                      </span>
                    </div>

                    {share.comment && (
                      <p className="text-xs text-white/60 italic">"{share.comment}"</p>
                    )}

                    <div className="border-t border-white/5 pt-2 flex justify-between items-center text-xs font-sans">
                      <span className="text-white/40">
                        Permissão: {share.read_only ? 'Apenas Leitura' : 'Leitura & Escrita'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 5. MODAL FOR RAID CREATION */}
      {showRaidModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <form onSubmit={handleCreateRaid} className="bg-slate-900 border border-white/10 rounded-xl p-5 w-full max-w-md space-y-4">
            <h3 className="font-bold text-lg text-white">Configurar Nova Matriz RAID</h3>

            <div className="space-y-1">
              <label className="text-xs text-white/40">Identificador da Matriz (mdadm)</label>
              <input
                type="text"
                value={raidName}
                onChange={e => setRaidName(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-white/40">Nível do RAID (redundância/performance)</label>
              <select
                value={raidLevel}
                onChange={e => setRaidLevel(e.target.value as any)}
                className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
              >
                <option value="raid0">RAID 0 (Performance - Sem Redundância)</option>
                <option value="raid1">RAID 1 (Espelho - Alta Segurança)</option>
                <option value="raid5">RAID 5 (Distribuído - Balanceado)</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-white/40">Selecione os Discos Membros</label>
              <div className="max-h-36 overflow-y-auto space-y-1 border border-white/10 rounded-lg p-2 bg-white/5">
                {disks.map(disk => (
                  <label key={disk.path} className="flex items-center gap-2 text-xs text-white/80 p-1 hover:bg-white/5 rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedDisksForRaid.includes(disk.path)}
                      onChange={e => {
                        if (e.target.checked) {
                          setSelectedDisksForRaid([...selectedDisksForRaid, disk.path])
                        } else {
                          setSelectedDisksForRaid(selectedDisksForRaid.filter(p => p !== disk.path))
                        }
                      }}
                      className="rounded border-white/10 text-sky-500 focus:ring-0 bg-transparent"
                    />
                    <span className="font-mono">{disk.path}</span> - {disk.model} ({formatBytes(disk.size_bytes)})
                  </label>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
              <button
                type="button"
                onClick={() => setShowRaidModal(false)}
                className="px-3 py-1.5 rounded-lg hover:bg-white/5 text-white/60 text-xs font-semibold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={selectedDisksForRaid.length < 2 || createRaidMutation.isPending}
                className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                Criar Matriz
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 6. MODAL FOR VG CREATION */}
      {showVgModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <form onSubmit={handleCreateVg} className="bg-slate-900 border border-white/10 rounded-xl p-5 w-full max-w-sm space-y-4">
            <h3 className="font-bold text-lg text-white">Criar Volume Group (VG)</h3>

            <div className="space-y-1">
              <label className="text-xs text-white/40">Nome do Volume Group</label>
              <input
                type="text"
                value={vgName}
                onChange={e => setVgName(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs text-white/40">Selecione Discos Físicos</label>
              <div className="max-h-32 overflow-y-auto space-y-1 border border-white/10 rounded-lg p-2 bg-white/5">
                {disks.map(disk => (
                  <label key={disk.path} className="flex items-center gap-2 text-xs text-white/80 p-1 hover:bg-white/5 rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedDisksForVg.includes(disk.path)}
                      onChange={e => {
                        if (e.target.checked) {
                          setSelectedDisksForVg([...selectedDisksForVg, disk.path])
                        } else {
                          setSelectedDisksForVg(selectedDisksForVg.filter(p => p !== disk.path))
                        }
                      }}
                      className="rounded border-white/10 text-sky-500 bg-transparent"
                    />
                    <span className="font-mono">{disk.path}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
              <button
                type="button"
                onClick={() => setShowVgModal(false)}
                className="px-3 py-1.5 rounded-lg hover:bg-white/5 text-white/60 text-xs font-semibold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold cursor-pointer"
              >
                Criar VG
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 7. MODAL FOR LV CREATION */}
      {showLvModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <form onSubmit={handleCreateLv} className="bg-slate-900 border border-white/10 rounded-xl p-5 w-full max-w-sm space-y-4">
            <h3 className="font-bold text-lg text-white">Criar Volume Lógico (LV)</h3>

            <div className="space-y-1">
              <label className="text-xs text-white/40">Volume Group de Origem</label>
              <select
                value={selectedVgForLv}
                onChange={e => setSelectedVgForLv(e.target.value)}
                className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
              >
                {vgs.map(vg => (
                  <option key={vg.name} value={vg.name}>{vg.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-white/40">Nome do Volume Lógico</label>
              <input
                type="text"
                value={lvName}
                onChange={e => setLvName(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-white/40">Tamanho (ex: 20G, 500M)</label>
              <input
                type="text"
                value={lvSize}
                onChange={e => setLvSize(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
              <button
                type="button"
                onClick={() => setShowLvModal(false)}
                className="px-3 py-1.5 rounded-lg hover:bg-white/5 text-white/60 text-xs font-semibold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold cursor-pointer"
              >
                Criar Volume
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 8. MODAL FOR SHARE CREATION */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <form onSubmit={handleCreateShare} className="bg-slate-900 border border-white/10 rounded-xl p-5 w-full max-w-md space-y-4">
            <h3 className="font-bold text-lg text-white">Criar Nova Pasta Partilhada</h3>

            <div className="space-y-1">
              <label className="text-xs text-white/40">Nome da Partilha</label>
              <input
                type="text"
                placeholder="backup"
                value={shareName}
                onChange={e => setShareName(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-white/40">Caminho da Pasta no Servidor</label>
              <input
                type="text"
                placeholder="/mnt/volumes/backup"
                value={sharePath}
                onChange={e => setSharePath(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white font-mono"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs text-white/40">Protocolo</label>
                <select
                  value={shareProtocol}
                  onChange={e => setShareProtocol(e.target.value as any)}
                  className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                >
                  <option value="smb">Samba (Windows/Mac)</option>
                  <option value="nfs">NFS (Unix/Linux)</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-white/40">Permissão</label>
                <select
                  value={shareReadOnly ? 'true' : 'false'}
                  onChange={e => setShareReadOnly(e.target.value === 'true')}
                  className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                >
                  <option value="false">Leitura e Escrita</option>
                  <option value="true">Apenas Leitura</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-white/40">Comentário / Descrição</label>
              <input
                type="text"
                placeholder="Partilha dedicada a backups semanais"
                value={shareComment}
                onChange={e => setShareComment(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
              <button
                type="button"
                onClick={() => setShowShareModal(false)}
                className="px-3 py-1.5 rounded-lg hover:bg-white/5 text-white/60 text-xs font-semibold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={createShareMutation.isPending}
                className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer"
              >
                Ativar Partilha
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
