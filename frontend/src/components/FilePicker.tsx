import { useState, useEffect, useMemo } from 'react'
import {
  Home, Clock, Star, Globe, FileText, Music, Image, Film, Download,
  Folder, ArrowLeft, ArrowUp, Grid3x3, List, ChevronDown,
} from 'lucide-react'
import { filesApi } from '@/api/client'

interface FileEntry {
  name: string
  path: string
  isDir: boolean
  size: number
  modTime: string
  mode: string
}

interface FilePickerProps {
  onOpen: (path: string) => void
  onCancel: () => void
  accept?: string[]
  title?: string
}

const SIDEBAR_ITEMS = [
  { name: 'Home', path: '/home', icon: Home },
  { name: 'Documents', path: '/home/kura/Documents', icon: FileText },
  { name: 'Music', path: '/home/kura/Music', icon: Music },
  { name: 'Pictures', path: '/home/kura/Pictures', icon: Image },
  { name: 'Videos', path: '/home/kura/Videos', icon: Film },
  { name: 'Downloads', path: '/home/kura/Downloads', icon: Download },
]

const TYPE_FILTERS: Record<string, { label: string; exts: string[] }> = {
  all:    { label: 'All Files', exts: [] },
  images: { label: 'Images', exts: ['png','jpg','jpeg','gif','svg','webp','bmp','ico','tiff','avif'] },
  videos: { label: 'Videos', exts: ['mp4','mkv','avi','mov','webm','flv','wmv','m4v'] },
  text:   { label: 'Text Files', exts: ['txt','md','log','csv','json','yml','yaml','xml','sh','py','js','ts','tsx','jsx','css','html','htm','ini','cfg','toml','env'] },
}

function formatBytes(bytes: number) {
  if (bytes === 0) return '—'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

export function FilePicker({ onOpen, onCancel, accept = [], title = 'Open File' }: FilePickerProps) {
  const [currentPath, setCurrentPath] = useState('/home')
  const [entries, setEntries] = useState<FileEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<FileEntry | null>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [typeFilter, setTypeFilter] = useState('all')
  const [showTypes, setShowTypes] = useState(false)

  const filters = accept.length > 0
    ? Object.entries(TYPE_FILTERS).filter(([k]) => accept.includes(k)).map(([k, v]) => [k, v] as const)
    : Object.entries(TYPE_FILTERS).map(([k, v]) => [k, v] as const)

  const activeFilter = filters.find(([k]) => k === typeFilter)?.[1] ?? TYPE_FILTERS.all

  useEffect(() => {
    setLoading(true)
    setError(null)
    setSelected(null)
    filesApi.list(currentPath)
      .then(res => {
        setEntries(res.data.entries ?? [])
        setLoading(false)
      })
      .catch(() => {
        setError('Cannot open location')
        setLoading(false)
      })
  }, [currentPath])

  const filteredEntries = useMemo(() => {
    let items = entries
    if (activeFilter.exts.length > 0) {
      items = items.filter(e =>
        e.isDir || activeFilter.exts.includes(e.name.split('.').pop()?.toLowerCase() ?? '')
      )
    }
    return items.sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    })
  }, [entries, activeFilter])

  const navigate = (path: string) => {
    if (path) setCurrentPath(path)
  }

  const goUp = () => {
    const parts = currentPath.split('/').filter(Boolean)
    if (parts.length > 1) navigate('/' + parts.slice(0, -1).join('/'))
    else navigate('/')
  }

  const handleDoubleClick = (entry: FileEntry) => {
    if (entry.isDir) {
      navigate(entry.path)
    } else {
      onOpen(entry.path)
    }
  }

  const handleOpen = () => {
    if (selected && !selected.isDir) onOpen(selected.path)
  }

  const pathParts = currentPath.split('/').filter(Boolean)

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center"
      style={{ background: 'var(--kura-overlay)', backdropFilter: 'blur(8px)' }}
      onClick={onCancel}
    >
      <div
        className="flex w-[720px] h-[480px] rounded-2xl overflow-hidden select-none"
        style={{
          background: 'rgba(20,22,34,0.97)',
          border: '1px solid var(--kura-alpha-08)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Sidebar */}
        <div className="w-48 shrink-0 border-r border-white/[0.06] bg-[#0d0f1b]/90 pt-2 pb-4 flex flex-col">
          <div className="px-3 py-2 text-[13px] font-semibold text-white/80 border-b border-white/[0.06] mb-1">
            {title}
          </div>
          <div className="flex-1 overflow-y-auto px-1.5 space-y-0.5">
            {SIDEBAR_ITEMS.map(item => (
              <button
                key={item.path || item.name}
                onClick={() => item.path && navigate(item.path)}
                disabled={!item.path}
                className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-left text-[12px] transition-all ${
                  item.path
                    ? 'cursor-pointer text-white/55 hover:bg-white/[0.05] hover:text-white/85'
                    : 'cursor-default text-white/20'
                }`}
              >
                <item.icon className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{item.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Main */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Toolbar */}
          <div className="h-10 border-b border-white/[0.06] px-3 flex items-center gap-2 shrink-0">
            <button
              onClick={goUp}
              disabled={currentPath === '/'}
              className="p-1.5 rounded-md hover:bg-white/[0.06] disabled:opacity-25 text-white/70 hover:text-white cursor-pointer transition-colors"
            >
              <ArrowUp className="w-4 h-4" />
            </button>

            {/* Breadcrumb */}
            <div className="flex-1 flex items-center gap-1 overflow-x-auto text-[12px] bg-[#161926]/60 rounded-lg px-3 h-7">
              <button onClick={() => navigate('/home')} className="text-white/55 hover:text-white transition-colors shrink-0">
                Home
              </button>
              {pathParts.slice(1).map((part, i) => (
                <div key={i} className="flex items-center gap-1 shrink-0">
                  <span className="text-white/20">/</span>
                  <button
                    onClick={() => navigate('/' + pathParts.slice(0, i + 2).join('/'))}
                    className="text-white/55 hover:text-white transition-colors truncate max-w-[80px]"
                  >
                    {part}
                  </button>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-0.5">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-md cursor-pointer transition-colors ${
                  viewMode === 'grid' ? 'bg-white/10 text-white' : 'text-white/50 hover:bg-white/[0.06]'
                }`}
              >
                <Grid3x3 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-md cursor-pointer transition-colors ${
                  viewMode === 'list' ? 'bg-white/10 text-white' : 'text-white/50 hover:bg-white/[0.06]'
                }`}
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="w-6 h-6 border-2 border-white/10 border-t-white/40 rounded-full animate-spin" />
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center h-full text-white/30 text-sm">
                <p>{error}</p>
              </div>
            ) : filteredEntries.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-white/20 text-sm">
                <Folder className="w-10 h-10 mb-2" />
                <p>No files</p>
              </div>
            ) : viewMode === 'grid' ? (
              <div className="p-3 grid grid-cols-4 gap-1">
                {filteredEntries.map(entry => {
                  const isSelected = selected?.path === entry.path
                  return (
                    <div
                      key={entry.path}
                      onClick={() => !entry.isDir && setSelected(isSelected ? null : entry)}
                      onDoubleClick={() => handleDoubleClick(entry)}
                      className={`flex flex-col items-center p-2 rounded-xl border transition-all cursor-pointer text-center ${
                        isSelected
                          ? 'bg-[#3584e4]/15 border-[#3584e4]/35'
                          : 'border-transparent hover:bg-white/[0.04]'
                      }`}
                    >
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-1.5 ${
                        entry.isDir
                          ? 'bg-[#1e6db5]/20 text-[#5baef7]'
                          : 'bg-white/[0.04] text-white/40'
                      }`}>
                        {entry.isDir ? <Folder className="w-6 h-6" /> : <FileText className="w-6 h-6" />}
                      </div>
                      <span className={`text-[11px] leading-tight line-clamp-2 ${
                        isSelected ? 'text-[#5baef7]' : 'text-white/70'
                      }`}>
                        {entry.name}
                      </span>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="px-2 py-1">
                {filteredEntries.map(entry => {
                  const isSelected = selected?.path === entry.path
                  return (
                    <div
                      key={entry.path}
                      onClick={() => !entry.isDir && setSelected(isSelected ? null : entry)}
                      onDoubleClick={() => handleDoubleClick(entry)}
                      className={`flex items-center gap-3 px-3 py-1.5 rounded-lg transition-all cursor-pointer text-[12px] ${
                        isSelected
                          ? 'bg-[#3584e4]/15 text-[#5baef7]'
                          : 'text-white/60 hover:bg-white/[0.04]'
                      }`}
                    >
                      {entry.isDir ? <Folder className="w-4 h-4 text-[#5baef7] shrink-0" /> : <FileText className="w-4 h-4 text-white/40 shrink-0" />}
                      <span className="flex-1 truncate">{entry.name}</span>
                      {!entry.isDir && <span className="text-white/25 w-16 text-right">{formatBytes(entry.size)}</span>}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="h-12 border-t border-white/[0.06] px-3 flex items-center gap-3 shrink-0">
            {/* Type filter */}
            <div className="relative">
              <button
                onClick={() => setShowTypes(v => !v)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] text-white/50 hover:text-white/80 hover:bg-white/[0.05] transition-colors cursor-pointer"
              >
                {activeFilter.label}
                <ChevronDown className={`w-3 h-3 transition-transform ${showTypes ? 'rotate-180' : ''}`} />
              </button>
              {showTypes && (
                <div
                  className="absolute bottom-full left-0 mb-1 py-1 rounded-xl min-w-[140px]"
                  style={{
                    background: 'var(--kura-menu-bg)',
                    border: '1px solid var(--kura-alpha-10)',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                  }}
                >
                  {filters.map(([key, val]) => (
                    <button
                      key={key}
                      onClick={() => { setTypeFilter(key); setShowTypes(false) }}
                      className={`w-full text-left px-3 py-1.5 text-[12px] transition-colors cursor-pointer ${
                        typeFilter === key
                          ? 'text-white bg-white/[0.07]'
                          : 'text-white/60 hover:text-white hover:bg-white/[0.05]'
                      }`}
                    >
                      {val.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex-1" />

            {selected && (
              <span className="text-[11px] text-white/30 truncate max-w-[200px]">{selected.name}</span>
            )}

            <button
              onClick={onCancel}
              className="px-4 py-1.5 rounded-lg text-[12px] text-white/60 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleOpen}
              disabled={!selected}
              className="px-5 py-1.5 rounded-lg text-[12px] font-medium text-white bg-[#3584e4] hover:bg-[#4a95f4] disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              Open
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
