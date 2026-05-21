import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AppID } from './windowStore'
import { settingsApi } from '@/api/client'

interface DockStore {
  pinned: AppID[]
  pin:      (app: AppID) => void
  unpin:    (app: AppID) => void
  isPinned: (app: AppID) => boolean
}

const DEFAULT_PINNED: AppID[] = ['settings', 'appstore', 'axis', 'notepad']

function syncToServer(pinned: AppID[]) {
  settingsApi.saveDock(pinned).catch(() => {})
}

export const useDockStore = create<DockStore>()(
  persist(
    (set, get) => ({
      pinned: DEFAULT_PINNED,

      pin(app) {
        if (!get().pinned.includes(app)) {
          const next = [...get().pinned, app]
          set({ pinned: next })
          syncToServer(next)
        }
      },

      unpin(app) {
        const next = get().pinned.filter(p => p !== app)
        set({ pinned: next })
        syncToServer(next)
      },

      isPinned(app) {
        return get().pinned.includes(app)
      },
    }),
    { name: 'kura-dock', version: 2 }
  )
)

settingsApi.getDock()
  .then(res => {
    if (res.data.pinned?.length > 0) {
      useDockStore.setState({ pinned: res.data.pinned as AppID[] })
    }
  })
  .catch(() => {})
