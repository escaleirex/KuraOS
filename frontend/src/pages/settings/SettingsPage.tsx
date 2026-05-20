import { useState } from 'react'
import { Settings, User, Shield, RefreshCw, Plus, Trash2, QrCode, Lock, CheckCircle2 } from 'lucide-react'

interface SystemUser {
  username: string
  role: 'admin' | 'user'
  samba: boolean
  lastLogin: string
}

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'general' | 'users' | 'security' | 'updates'>('general')

  // General States
  const [hostname, setHostname] = useState('KuraNAS')
  const [httpPort, setHttpPort] = useState('8080')
  const [timezone, setTimezone] = useState('Europe/Lisbon')
  const [savedSettings, setSavedSettings] = useState(false)

  // Users State
  const [users, setUsers] = useState<SystemUser[]>([
    { username: 'admin', role: 'admin', samba: true, lastLogin: 'Hoje, 11:20' },
    { username: 'escaleirex', role: 'admin', samba: true, lastLogin: 'Ontem, 20:45' },
    { username: 'guest_user', role: 'user', samba: false, lastLogin: 'Nunca' },
  ])

  const [showAddUserModal, setShowAddUserModal] = useState(false)
  const [newUsername, setNewUsername] = useState('')
  const [newUserRole, setNewUserRole] = useState<'admin' | 'user'>('user')
  const [newUserSamba, setNewUserSamba] = useState(true)

  // Security (2FA) State
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false)
  const [show2faModal, setShow2faModal] = useState(false)
  const [verificationCode, setVerificationCode] = useState('')

  // Updates State
  const [currentVersion] = useState('v1.0.3')
  const [updateAvailable, setUpdateAvailable] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [updateProgress, setUpdateProgress] = useState(0)

  const handleSaveGeneral = (e: React.FormEvent) => {
    e.preventDefault()
    setSavedSettings(true)
    setTimeout(() => setSavedSettings(false), 3000)
  }

  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault()
    const newUser: SystemUser = {
      username: newUsername,
      role: newUserRole,
      samba: newUserSamba,
      lastLogin: 'Nunca',
    }
    setUsers([...users, newUser])
    setShowAddUserModal(false)
    setNewUsername('')
  }

  const handleToggleSamba = (username: string) => {
    setUsers(prev =>
      prev.map(u => (u.username === username ? { ...u, samba: !u.samba } : u))
    )
  }

  const handleEnable2fa = (e: React.FormEvent) => {
    e.preventDefault()
    setTwoFactorEnabled(true)
    setShow2faModal(false)
    setVerificationCode('')
  }

  const handleInstallUpdate = () => {
    setUpdating(true)
    setUpdateProgress(0)
    const interval = setInterval(() => {
      setUpdateProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval)
          setUpdating(false)
          setUpdateAvailable(false)
          return 100
        }
        return prev + 5
      })
    }, 200)
  }

  return (
    <div className="p-6 h-full flex flex-col gap-6 text-white/90">
      {/* Title & Info */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Definições do Sistema</h2>
          <p className="text-white/50 text-sm mt-0.5">Configure o nome da rede, contas de utilizadores locais, autenticação multifator e atualizações do KuraOS</p>
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="flex border-b border-white/10 shrink-0 gap-2">
        <button
          onClick={() => setActiveTab('general')}
          className={`flex items-center gap-2 px-4 py-2 border-b-2 font-medium text-sm transition-all cursor-pointer ${
            activeTab === 'general' ? 'border-sky-500 text-sky-400' : 'border-transparent text-white/50 hover:text-white/80'
          }`}
        >
          <Settings className="w-4 h-4" />
          Configurações Gerais
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 px-4 py-2 border-b-2 font-medium text-sm transition-all cursor-pointer ${
            activeTab === 'users' ? 'border-sky-500 text-sky-400' : 'border-transparent text-white/50 hover:text-white/80'
          }`}
        >
          <User className="w-4 h-4" />
          Utilizadores & Contas
        </button>
        <button
          onClick={() => setActiveTab('security')}
          className={`flex items-center gap-2 px-4 py-2 border-b-2 font-medium text-sm transition-all cursor-pointer ${
            activeTab === 'security' ? 'border-sky-500 text-sky-400' : 'border-transparent text-white/50 hover:text-white/80'
          }`}
        >
          <Shield className="w-4 h-4" />
          Segurança e 2FA
        </button>
        <button
          onClick={() => setActiveTab('updates')}
          className={`flex items-center gap-2 px-4 py-2 border-b-2 font-medium text-sm transition-all cursor-pointer ${
            activeTab === 'updates' ? 'border-sky-500 text-sky-400' : 'border-transparent text-white/50 hover:text-white/80'
          }`}
        >
          <RefreshCw className="w-4 h-4" />
          Sistema & Atualização
        </button>
      </div>

      {/* Contents */}
      <div className="flex-1 overflow-auto">
        {/* 1. GENERAL TAB */}
        {activeTab === 'general' && (
          <form onSubmit={handleSaveGeneral} className="max-w-md bg-white/5 border border-white/10 rounded-xl p-5 space-y-4">
            <div className="space-y-1">
              <label className="text-xs text-white/40">Nome de Anfitrião (Hostname do NAS)</label>
              <input
                type="text"
                value={hostname}
                onChange={e => setHostname(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500/50"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs text-white/40">Porta HTTP (Web UI)</label>
                <input
                  type="text"
                  value={httpPort}
                  onChange={e => setHttpPort(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500/50"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-white/40">Fuso Horário</label>
                <select
                  value={timezone}
                  onChange={e => setTimezone(e.target.value)}
                  className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                >
                  <option value="Europe/Lisbon">Europa / Lisboa</option>
                  <option value="Europe/London">Europa / Londres</option>
                  <option value="America/New_York">América / Nova Iorque</option>
                  <option value="America/Sao_Paulo">América / São Paulo</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-white/5 pt-4">
              {savedSettings && (
                <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Definições salvas com sucesso!
                </span>
              )}
              <div className="flex-1" />
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs cursor-pointer transition-colors"
              >
                Salvar Alterações
              </button>
            </div>
          </form>
        )}

        {/* 2. USERS TAB */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-white">Contas de Utilizadores Locais</h3>
              <button
                onClick={() => setShowAddUserModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-medium text-xs transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Criar Utilizador
              </button>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-white/10 bg-white/5 text-white/40">
                    <th className="p-3">Utilizador</th>
                    <th className="p-3">Permissões</th>
                    <th className="p-3">Acesso Samba (Partilhas)</th>
                    <th className="p-3">Último Login</th>
                    <th className="p-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-white/80">
                  {users.map(user => (
                    <tr key={user.username} className="hover:bg-white/5 transition-colors">
                      <td className="p-3 font-bold text-white flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-sky-500/10 text-sky-400 flex items-center justify-center font-sans text-xs">
                          {user.username[0].toUpperCase()}
                        </div>
                        {user.username}
                      </td>
                      <td className="p-3 uppercase">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          user.role === 'admin' ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20' : 'bg-white/10 text-white/50'
                        }`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="p-3">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={user.samba}
                            onChange={() => handleToggleSamba(user.username)}
                            className="rounded border-white/10 text-sky-500 bg-transparent focus:ring-0"
                          />
                          <span>{user.samba ? 'Permitido' : 'Bloqueado'}</span>
                        </label>
                      </td>
                      <td className="p-3 text-white/40">{user.lastLogin}</td>
                      <td className="p-3 text-right">
                        {user.username !== 'admin' && (
                          <button
                            onClick={() => setUsers(prev => prev.filter(u => u.username !== user.username))}
                            className="text-red-400 hover:text-red-300 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 3. SECURITY TAB */}
        {activeTab === 'security' && (
          <div className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-5">
            <div className="flex justify-between items-start border-b border-white/5 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-sky-500/10 text-sky-400 rounded-xl border border-sky-500/20">
                  <Lock className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Autenticação de Dois Fatores (2FA)</h3>
                  <p className="text-xs text-white/40">Injete uma barreira extra de proteção na Web Portal utilizando códigos geradores TOTP</p>
                </div>
              </div>

              <button
                onClick={() => {
                  if (twoFactorEnabled) {
                    setTwoFactorEnabled(false)
                  } else {
                    setShow2faModal(true)
                  }
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white font-semibold text-xs transition-colors cursor-pointer ${
                  twoFactorEnabled ? 'bg-red-500 hover:bg-red-600' : 'bg-sky-600 hover:bg-sky-700'
                }`}
              >
                {twoFactorEnabled ? 'Desativar 2FA' : 'Ativar 2FA'}
              </button>
            </div>

            <div className="flex items-center justify-between bg-white/5 p-4 rounded-xl border border-white/5">
              <span className="text-sm font-medium text-white/70">Estado da Proteção da Conta</span>
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase ${
                twoFactorEnabled ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'
              }`}>
                {twoFactorEnabled ? 'Protegido (2FA Ativo)' : 'Não Protegido'}
              </span>
            </div>
          </div>
        )}

        {/* 4. UPDATES TAB */}
        {activeTab === 'updates' && (
          <div className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-5">
            <div className="flex items-center gap-3 border-b border-white/5 pb-4">
              <div className="p-3 bg-sky-500/10 text-sky-400 rounded-xl border border-sky-500/20">
                <RefreshCw className={`w-6 h-6 ${updating ? 'animate-spin' : ''}`} />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">Atualizações de Firmware (OS Update)</h3>
                <p className="text-xs text-white/40">Versão atual instalada: <span className="font-mono text-white/80">{currentVersion}</span></p>
              </div>
            </div>

            {updating ? (
              <div className="space-y-2 bg-white/5 p-4 rounded-xl border border-white/5">
                <div className="flex justify-between text-xs text-white/50">
                  <span>A descarregar e instalar atualizações de segurança...</span>
                  <span>{updateProgress}%</span>
                </div>
                <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-sky-500 h-full transition-all duration-200" style={{ width: `${updateProgress}%` }} />
                </div>
              </div>
            ) : updateAvailable ? (
              <div className="bg-sky-500/5 border border-sky-500/10 p-4 rounded-xl flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-sky-300">Nova versão disponível! KuraOS v1.0.4</h4>
                  <p className="text-xs text-sky-300/60 mt-1">Correções de estabilidade no módulo LVM, patches de segurança no Linux kernel e suporte a cache SSD.</p>
                </div>
                <button
                  onClick={handleInstallUpdate}
                  className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs transition-all cursor-pointer shadow-lg shadow-sky-600/25"
                >
                  Instalar Firmware
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-4 rounded-xl text-xs font-semibold">
                <CheckCircle2 className="w-4 h-4" />
                O seu KuraOS está totalmente atualizado! Não há novas atualizações disponíveis.
              </div>
            )}
          </div>
        )}
      </div>

      {/* ADD USER MODAL */}
      {showAddUserModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <form onSubmit={handleAddUser} className="bg-slate-900 border border-white/10 rounded-xl p-5 w-full max-w-sm space-y-4">
            <h3 className="font-bold text-lg text-white">Criar Nova Conta</h3>

            <div className="space-y-1">
              <label className="text-xs text-white/40">Nome de Utilizador</label>
              <input
                type="text"
                placeholder="exemplo"
                value={newUsername}
                onChange={e => setNewUsername(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs text-white/40">Função</label>
                <select
                  value={newUserRole}
                  onChange={e => setNewUserRole(e.target.value as any)}
                  className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                >
                  <option value="user">Utilizador</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-white/40">Acesso Samba</label>
                <select
                  value={newUserSamba ? 'true' : 'false'}
                  onChange={e => setNewUserSamba(e.target.value === 'true')}
                  className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                >
                  <option value="true">Permitido</option>
                  <option value="false">Bloqueado</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
              <button
                type="button"
                onClick={() => setShowAddUserModal(false)}
                className="px-3 py-1.5 rounded-lg hover:bg-white/5 text-white/60 text-xs font-semibold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold cursor-pointer"
              >
                Criar Utilizador
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 2FA SETUP MODAL */}
      {show2faModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <form onSubmit={handleEnable2fa} className="bg-slate-900 border border-white/10 rounded-xl p-5 w-full max-w-sm space-y-4 flex flex-col items-center">
            <h3 className="font-bold text-lg text-white font-sans text-center self-stretch">Configurar 2FA Seguro</h3>

            <div className="p-3 bg-white rounded-lg">
              <QrCode className="w-36 h-36 text-slate-900" />
            </div>

            <p className="text-xs text-white/45 text-center px-4 leading-relaxed">
              Leia o código QR acima com o seu telemóvel usando o Google Authenticator ou Authy e insira o código gerado abaixo.
            </p>

            <div className="space-y-1 w-full text-center">
              <label className="text-xs text-white/40">Código de Verificação de 6 Dígitos</label>
              <input
                type="text"
                placeholder="123456"
                value={verificationCode}
                onChange={e => setVerificationCode(e.target.value)}
                className="w-full text-center bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white font-mono tracking-widest focus:outline-none"
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-white/5 w-full shrink-0">
              <button
                type="button"
                onClick={() => setShow2faModal(false)}
                className="px-3 py-1.5 rounded-lg hover:bg-white/5 text-white/60 text-xs font-semibold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold cursor-pointer"
              >
                Ativar Autenticação
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
