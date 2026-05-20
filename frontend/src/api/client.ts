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

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('kura_token')
      window.location.href = '/login'
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

// Files
export const filesApi = {
  list: (path?: string) => api.get('/files/list', { params: { path } }),
}


// Auth
export const authApi = {
  login: (username: string, password: string) =>
    api.post('/auth/login', { username, password }),
  verifyTotp: (username: string, code: string) =>
    api.post('/auth/totp/verify', { username, code }),
}

// Settings
export const settingsApi = {
  getDock: () => api.get<{ pinned: string[] }>('/settings/dock'),
  saveDock: (pinned: string[]) => api.put('/settings/dock', { pinned }),
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
