import axios from 'axios'

export const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('kura_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

let _redirecting = false

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && !_redirecting && !window.location.pathname.startsWith('/login')) {
      _redirecting = true
      localStorage.removeItem('kura_token')
      window.location.replace('/login')
    }
    return Promise.reject(err)
  }
)

// Storage
export const storageApi = {
  listDisks: () => api.get('/storage/disks'),
  diskSmart: (device: string) => api.get(`/storage/disks/${device}/smart`),
  listRaids: () => api.get('/storage/raids'),
  createRaid: (body: object) => api.post('/storage/raids', body),
  stopRaid: (device: string) => api.delete(`/storage/raids/${device}`),
  listVGs: () => api.get('/storage/vgs'),
  listLVs: (vg: string) => api.get(`/storage/vgs/${vg}/lvs`),
  listShares: () => api.get('/storage/shares'),
  createShare: (body: object) => api.post('/storage/shares', body),
  updateShare: (name: string, body: object) => api.put(`/storage/shares/${name}`, body),
  deleteShare: (name: string) => api.delete(`/storage/shares/${name}`),
}

// System
export const systemApi = {
  metrics: () => api.get('/system/metrics'),
  resources: () => api.get<SystemResources>('/system/resources'),
}

export interface SensorReading { label: string; kind: string; value: number; unit: string; crit?: number }
export interface HwmonChip { name: string; path: string; sensors: SensorReading[] }
export interface SystemResources {
  timestamp: number
  cpu: { name: string; cores: number; threads: number; usage_pct: number; per_core: number[]; freq_mhz: number[]; temp_c?: number; power_w?: number }
  memory: { total_bytes: number; used_bytes: number; avail_bytes: number; cached_bytes: number; buffer_bytes: number; swap_total: number; swap_used: number }
  gpus: Array<{ name: string; driver: string; usage_pct: number; vram_used: number; vram_total: number; temp_c?: number; power_w?: number; encoder_pct?: number; decoder_pct?: number }>
  disks: Array<{ name: string; mount_point?: string; read_bps: number; write_bps: number; total_bytes?: number; used_bytes?: number; free_bytes?: number; temp_c?: number }>
  network: Array<{ name: string; rx_bps: number; tx_bps: number }>
  sensors: HwmonChip[]
}

// Network
export interface WifiNetwork {
  ssid: string
  signal: number
  secured: boolean
  connected: boolean
}

export interface EthConfig {
  mode: 'dhcp' | 'static'
  ip: string
  gateway: string
  dns1: string
  dns2: string
}

export interface EthIface {
  name: string
  speed: string
  status: string
}

export const networkApi = {
  getInterfaces: () => api.get<{ wifi: { enabled: boolean; networks: WifiNetwork[] }; eth: EthIface[] }>('/network/interfaces'),
  setWifi: (enabled: boolean) => api.put('/network/wifi', { enabled }),
  scanWifi: () => api.post<WifiNetwork[]>('/network/wifi/scan'),
  connectWifi: (ssid: string, password?: string) => api.post('/network/wifi/connect', { ssid, ...(password ? { password } : {}) }),
  getEthConfig: (iface: string) => api.get<EthConfig>(`/network/eth/${iface}`),
  setEthConfig: (iface: string, config: EthConfig) => api.put(`/network/eth/${iface}`, config),
}

// Files
export const filesApi = {
  home: () => api.get<{ username: string; home: string }>('/files/home'),
  list: (path?: string) => api.get('/files/list', { params: { path } }),
  create: (path: string, name: string, dir = false) => api.post('/files/create', { path, name, dir }),
}


// Auth
export const authApi = {
  login: (username: string, password: string) =>
    api.post('/auth/login', { username, password }),
  verifyTotp: (username: string, code: string) =>
    api.post('/auth/totp/verify', { username, code }),
  totpStatus: () =>
    api.get<{ enabled: boolean }>('/auth/totp/status'),
  setupTOTP: () =>
    api.post<{ secret: string; otpauth_url: string }>('/auth/totp/setup'),
  enableTOTP: (code: string) =>
    api.post<{ enabled: boolean }>('/auth/totp/enable', { code }),
  disableTOTP: (code: string) =>
    api.post<{ enabled: boolean }>('/auth/totp/disable', { code }),
}

export interface NotificationSettings {
  diskFull: boolean
  raidDegraded: boolean
  backupFail: boolean
  updateAvail: boolean
  loginFail: boolean
  tempCrit: boolean
  dockerDown: boolean
}

export interface AxisSettings {
  mode: 'auto' | 'local' | 'cloud'
  ollamaUrl: string
  localModel: string
  preferred: 'groq' | 'openai' | 'anthropic' | 'openrouter' | 'nvidia' | 'custom'
  apiKeys: Record<string, string>
  customUrl?: string
  providerModels?: Record<string, string>
}

export interface OllamaModel {
  name: string
  modified_at: string
  size: number
}

export interface AppearanceSettings {
  theme: 'dark' | 'light' | 'auto'
  accent: string
  scale: string
  density: 'comfortable' | 'compact'
}

export interface PowerSettings {
  profile: 'performance' | 'balanced' | 'saver'
  spindown: '0' | '10' | '30' | '60' | '180'
  wol: boolean
}

export interface OnlineAccount {
  id: string
  provider: string
  name: string
  connected: boolean
  purpose: string
}

export interface DatetimeSettings {
  ntpEnabled: boolean
  ntpServer: string
  timezone: string
}

export interface RemoteDesktopSettings {
  rdpEnabled: boolean
  vncEnabled: boolean
  de: string
  resolution: string
  autoInstall: boolean
}

export interface RemoteDesktopStatus {
  rdpRunning: boolean
  vncRunning: boolean
  deInstalled: boolean
}

export interface SearchSettings {
  aiSearch: boolean
  axisModel: string
  scopeContent: boolean
  indexedPaths: string[]
  schedule: string
}

export interface LocaleSettings {
  language: string
  dateFormat: string
  timeFormat: string
  currency: string
  numberFormat: string
}

export interface SshSettings {
  enabled: boolean
  port: number
  passwordAuth: boolean
  rootLogin: boolean
}

// Settings
export const settingsApi = {
  getDock: () => api.get<{ pinned: string[] }>('/settings/dock'),
  saveDock: (pinned: string[]) => api.put('/settings/dock', { pinned }),
  getNavOrder: () => api.get<{ order: string[] }>('/settings/nav-order'),
  saveNavOrder: (order: string[]) => api.put('/settings/nav-order', { order }),
  getNotifications: () => api.get<NotificationSettings>('/settings/notifications'),
  saveNotifications: (data: NotificationSettings) => api.put<NotificationSettings>('/settings/notifications', data),
  getAxis: () => api.get<AxisSettings>('/settings/axis'),
  saveAxis: (data: AxisSettings) => api.put('/settings/axis', data),
  listAxisModels: () => api.get<{ models: OllamaModel[] }>('/settings/axis/models'),
  getAppearance: () => api.get<AppearanceSettings>('/settings/appearance'),
  saveAppearance: (data: AppearanceSettings) => api.put<AppearanceSettings>('/settings/appearance', data),
  getPower: () => api.get<PowerSettings>('/settings/power'),
  savePower: (data: PowerSettings) => api.put<PowerSettings>('/settings/power', data),
  getAccounts: () => api.get<OnlineAccount[]>('/settings/accounts'),
  saveAccount: (provider: string, data: Partial<OnlineAccount>) => api.put<OnlineAccount>(`/settings/accounts/${provider}`, data),
  connectAccount: (provider: string) => api.post<OnlineAccount>(`/settings/accounts/${provider}/connect`),
  disconnectAccount: (provider: string) => api.post<OnlineAccount>(`/settings/accounts/${provider}/disconnect`),
  getSSH: () => api.get<SshSettings>('/settings/ssh'),
  saveSSH: (data: SshSettings) => api.put<SshSettings>('/settings/ssh', data),
  listSSHKeys: () => api.get<{ keys: SshKey[] }>('/settings/ssh/keys'),
  addSSHKey: (key: string) => api.post<SshKey>('/settings/ssh/keys', { key }),
  removeSSHKey: (id: string) => api.delete(`/settings/ssh/keys/${id}`),
  getRemoteDesktop: () => api.get<RemoteDesktopSettings>('/settings/remote-desktop'),
  saveRemoteDesktop: (data: RemoteDesktopSettings) => api.put<RemoteDesktopSettings>('/settings/remote-desktop', data),
  getRemoteDesktopStatus: () => api.get<RemoteDesktopStatus>('/settings/remote-desktop/status'),
}

export interface SshKey {
  id: string
  comment: string
  fingerprint: string
  added: string
}

// App Store
export const appsApi = {
  list: (params?: { category?: string; search?: string }) =>
    api.get('/apps', { params }),
  get: (id: string) => api.get(`/apps/${id}`),
  install: (id: string, config?: object) => api.post(`/apps/${id}/install`, config ?? {}),
  listInstalled: () => api.get('/apps/installed'),
  getInstalled: (id: string) => api.get(`/apps/${id}/installed`),
  uninstall: (id: string) => api.post(`/apps/${id}/uninstall`),
  start: (id: string) => api.post(`/apps/${id}/start`),
  stop: (id: string) => api.post(`/apps/${id}/stop`),
  restart: (id: string) => api.post(`/apps/${id}/restart`),
  update: (id: string) => api.post(`/apps/${id}/update`),
  logs: (id: string, tail = 100) => api.get(`/apps/${id}/logs`, { params: { tail } }),
  community: (params?: { category?: string; search?: string }) =>
    api.get('/apps/community', { params }),
  searchDockerHub: (q: string, limit = 25) =>
    api.get('/apps/search', { params: { q, limit } }),
  featured: () => api.get('/apps/featured'),
  hubDetails: (image: string) => api.get('/apps/hub/details', { params: { image } }),
}

// Axis
export const axisApi = {
  chat: (messages: object[], options?: object) =>
    axios.post('http://localhost:9765/axis/chat', { messages, ...options }),
  listTools: () => axios.get('http://localhost:9765/axis/mcp/tools'),
}

// Code Server
export const codeServerApi = {
  setup: () => api.post('/code-server/setup'),
  status: () => api.get('/code-server/status'),
}

// Services
export const servicesApi = {
  list: () => api.get('/services'),
  start: (id: string) => api.post(`/services/${id}/start`),
  stop: (id: string) => api.post(`/services/${id}/stop`),
  restart: (id: string) => api.post(`/services/${id}/restart`),
  enable: (id: string) => api.post(`/services/${id}/enable`),
  disable: (id: string) => api.post(`/services/${id}/disable`),
}

// Updates
export interface UpdateInfo {
  currentVersion: string
  latestVersion: string
  available: boolean
  changelog: string
  packageCount: number
}

export interface UpdateProgress {
  running: boolean
  progress: number
  stage: string
  message: string
}

export interface UpdateSettings {
  autoCheck: boolean
}

export const updatesApi = {
  check: () => api.get<UpdateInfo>('/updates/check'),
  install: () => api.post('/updates/install'),
  status: () => api.get<UpdateProgress>('/updates/status'),
  getSettings: () => api.get<UpdateSettings>('/updates/settings'),
  saveSettings: (data: UpdateSettings) => api.put<UpdateSettings>('/updates/settings', data),
}

export interface UserEntry {
  username: string
  role: 'admin' | 'user'
  samba: boolean
  lastLogin: string
}

export const usersApi = {
  list: () => api.get<UserEntry[]>('/users'),
  create: (data: { username: string; password: string; role: 'admin' | 'user'; samba: boolean }) =>
    api.post('/users', data),
  delete: (username: string) => api.delete(`/users/${username}`),
  setPassword: (username: string, password: string) =>
    api.put(`/users/${username}/password`, { password }),
  setRole: (username: string, role: 'admin' | 'user') =>
    api.put(`/users/${username}/role`, { role }),
  setSamba: (username: string, samba: boolean, password?: string) =>
    api.put(`/users/${username}/samba`, { samba, ...(password ? { password } : {}) }),
}
