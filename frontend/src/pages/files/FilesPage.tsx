import { useState, useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Folder,
  File,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  RotateCw,
  Search,
  HardDrive,
  Info,
  FolderOpen,
  FileText,
  FileImage,
  FileAudio,
  FileVideo,
  ChevronRight,
  Grid3x3,
  List,
  Home,
  AlertCircle,
  Clock,
  Download,
  Music,
  Image,
  Film,
  FileArchive,
  X,
  ChevronDown,
  MoreVertical,
  Code,
} from 'lucide-react'
import { filesApi, storageApi } from '@/api/client'
import { useWindowStore } from '@/stores/windowStore'

interface Disk {
  path: string
  model: string
  serial: string
  size_bytes: number
  fs_type?: string
  mount_point?: string
  transport: string
  rpm?: number
}

interface FileEntry {
  name: string
  path: string
  isDir: boolean
  size: number
  modTime: string
  mode: string
}

interface ListDirResponse {
  path: string
  parent: string
  entries: FileEntry[]
}

const SIDEBAR_BOOKMARKS_LABELS = [
  { name: 'Home', sub: '', icon: Home },
  { name: 'Downloads', sub: 'Downloads', icon: Download },
  { name: 'Documents', sub: 'Documents', icon: FileText },
  { name: 'Pictures', sub: 'Pictures', icon: Image },
  { name: 'Music', sub: 'Music', icon: Music },
  { name: 'Videos', sub: 'Videos', icon: Film },
]


type SortField = 'name' | 'size' | 'time' | 'type'
type SortOrder = 'asc' | 'desc'

export function FilesPage() {
  const openWindow = useWindowStore(s => s.openWindow)
  const [currentPath, setCurrentPath] = useState<string>('/')
  const [history, setHistory] = useState<string[]>(['/'])
  const [historyIndex, setHistoryIndex] = useState<number>(0)

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [selectedItem, setSelectedItem] = useState<FileEntry | null>(null)
  const [showDetails, setShowDetails] = useState<boolean>(false)
  const [searchActive, setSearchActive] = useState<boolean>(false)
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [sortBy, setSortBy] = useState<SortField>('name')
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc')

  const [isEditingPath, setIsEditingPath] = useState<boolean>(false)
  const [pathInput, setPathInput] = useState<string>('/')

  const [ctxMenu, setCtxMenu] = useState<{ pos: { x: number; y: number }; entry: FileEntry } | null>(null)

  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setPathInput(currentPath)
    setSelectedItem(null)
  }, [currentPath])

  useEffect(() => {
    if (searchActive && searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [searchActive])

  useEffect(() => {
    if (!ctxMenu) return
    function onClick() { setCtxMenu(null) }
    window.addEventListener('click', onClick)
    return () => window.removeEventListener('click', onClick)
  }, [ctxMenu])

  const { data: disks } = useQuery<Disk[]>({
    queryKey: ['storage-disks'],
    queryFn: () => storageApi.listDisks().then(r => r.data),
    staleTime: 30_000,
  })

  const { data: homeInfo } = useQuery<{ username: string; home: string }>({
    queryKey: ['files-home'],
    queryFn: () => filesApi.home().then(r => r.data),
    staleTime: 60_000,
  })

  const bookmarks = useMemo(() => {
    if (!homeInfo) return []
    return SIDEBAR_BOOKMARKS_LABELS.map(b => ({
      name: b.name,
      path: b.sub ? `${homeInfo.home}/${b.sub}` : homeInfo.home,
      icon: b.icon,
    }))
  }, [homeInfo])

  const { data, isLoading, error, refetch, isFetching } = useQuery<ListDirResponse>({
    queryKey: ['files-list', currentPath],
    queryFn: () => filesApi.list(currentPath).then(res => res.data),
    retry: false,
  })

  const navigateToPath = (newPath: string, skipHistory = false) => {
    if (newPath === currentPath) return
    if (!skipHistory) {
      const next = history.slice(0, historyIndex + 1)
      setHistory([...next, newPath])
      setHistoryIndex(next.length)
    }
    setCurrentPath(newPath)
    setSearchActive(false)
    setSearchQuery('')
  }

  const handleBack = () => {
    if (historyIndex > 0) {
      const i = historyIndex - 1
      setHistoryIndex(i)
      setCurrentPath(history[i])
    }
  }

  const handleForward = () => {
    if (historyIndex < history.length - 1) {
      const i = historyIndex + 1
      setHistoryIndex(i)
      setCurrentPath(history[i])
    }
  }

  const handleUp = () => {
    if (data?.parent !== undefined) navigateToPath(data.parent || '/')
  }

  const handleBreadcrumbClick = (index: number, parts: string[]) => {
    navigateToPath('/' + parts.slice(0, index + 1).join('/'))
  }

  const handlePathSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setIsEditingPath(false)
    navigateToPath(pathInput.trim() || '/')
  }

  const handleFolderContextMenu = (e: React.MouseEvent, entry: FileEntry) => {
    if (!entry.isDir) return
    e.preventDefault()
    e.stopPropagation()
    setCtxMenu({ pos: { x: e.clientX, y: e.clientY }, entry })
  }

  const openInCodeEditor = (folderPath: string) => {
    openWindow('code', { folder: folderPath })
    setCtxMenu(null)
  }

  const getFileApp = (name: string): 'notepad' | 'imageviewer' | 'videoplayer' | null => {
    const ext = name.split('.').pop()?.toLowerCase() ?? ''
    if (['png','jpg','jpeg','gif','svg','webp','bmp','ico','tiff','tif','avif'].includes(ext)) return 'imageviewer'
    if (['mp4','mkv','avi','mov','webm','flv','wmv','m4v'].includes(ext)) return 'videoplayer'
    if (['txt','md','log','csv','json','yml','yaml','xml','sh','py','js','ts','tsx','jsx','css','html','htm','ini','cfg','conf','toml','env','gitignore','dockerfile','makefile','rs','c','cpp','h','go','rb','php','sql','bat','ps1'].includes(ext)) return 'notepad'
    return null
  }

  const handleFileOpen = (entry: FileEntry) => {
    if (entry.isDir) {
      navigateToPath(entry.path)
      return
    }
    const app = getFileApp(entry.name)
    if (app) {
      openWindow(app, { filePath: entry.path })
    }
  }

  const createNewTextFile = async () => {
    const name = prompt('File name:', 'untitled.txt')
    if (!name) { setCtxMenu(null); return }
    try {
      await filesApi.create(ctxMenu.entry.path, name, false)
      refetch()
    } catch {}
    setCtxMenu(null)
  }

  const createNewFolder = async () => {
    const name = prompt('Folder name:', 'New Folder')
    if (!name) { setCtxMenu(null); return }
    try {
      await filesApi.create(ctxMenu.entry.path, name, true)
      refetch()
    } catch {}
    setCtxMenu(null)
  }

  const handleFileContextMenu = (e: React.MouseEvent, entry: FileEntry) => {
    e.preventDefault()
    e.stopPropagation()
    setCtxMenu({ pos: { x: e.clientX, y: e.clientY }, entry })
  }

  const toggleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortOrder(o => o === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortOrder('asc')
    }
  }

  const getFileType = (entry: FileEntry): string => {
    if (entry.isDir) return 'Folder'
    const ext = entry.name.split('.').pop()?.toLowerCase()
    if (!ext) return 'File'
    const map: Record<string, string> = {
      png: 'PNG Image', jpg: 'JPEG Image', jpeg: 'JPEG Image', gif: 'GIF Image',
      svg: 'SVG Image', webp: 'WebP Image', bmp: 'Bitmap',
      mp4: 'MP4 Video', mkv: 'MKV Video', avi: 'AVI Video', mov: 'MOV Video',
      mp3: 'MP3 Audio', wav: 'WAV Audio', flac: 'FLAC Audio', ogg: 'OGG Audio',
      txt: 'Text', md: 'Markdown', pdf: 'PDF', json: 'JSON', yml: 'YAML', yaml: 'YAML',
      xml: 'XML', sh: 'Shell Script', go: 'Go Source', ts: 'TypeScript', tsx: 'TSX',
      js: 'JavaScript', py: 'Python', zip: 'ZIP Archive', tar: 'TAR Archive',
      gz: 'GZ Archive',
    }
    return map[ext] || `${ext.toUpperCase()} File`
  }

  const processedEntries = useMemo(() => {
    if (!data?.entries) return []
    let items = data.entries.filter(e =>
      e.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
    items.sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1
      let cmp = 0
      if (sortBy === 'name') cmp = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
      else if (sortBy === 'size') cmp = a.size - b.size
      else if (sortBy === 'time') cmp = new Date(a.modTime).getTime() - new Date(b.modTime).getTime()
      else if (sortBy === 'type') cmp = getFileType(a).localeCompare(getFileType(b))
      return sortOrder === 'asc' ? cmp : -cmp
    })
    return items
  }, [data, searchQuery, sortBy, sortOrder])

  const pathParts = useMemo(() => currentPath.split('/').filter(Boolean), [currentPath])

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '—'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  const getFileIcon = (entry: FileEntry) => {
    if (entry.isDir) return Folder
    const ext = entry.name.split('.').pop()?.toLowerCase()
    if (!ext) return File
    if (['png','jpg','jpeg','gif','svg','webp','bmp','ico'].includes(ext)) return FileImage
    if (['mp4','mkv','avi','mov','webm','flv','wmv'].includes(ext)) return FileVideo
    if (['mp3','wav','ogg','flac','m4a','aac'].includes(ext)) return FileAudio
    if (['zip','tar','gz','bz2','xz','7z','rar'].includes(ext)) return FileArchive
    if (['txt','md','pdf','doc','docx','json','yml','yaml','xml','sh','go','ts','tsx','js','py'].includes(ext)) return FileText
    return File
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortBy !== field) return <ChevronDown className="w-3 h-3 opacity-0 group-hover:opacity-30" />
    return <ChevronDown className={`w-3 h-3 text-[#3584e4] transition-transform ${sortOrder === 'desc' ? 'rotate-180' : ''}`} />
  }

  const formatDiskSize = (bytes: number) => {
    if (!bytes) return ''
    const tb = bytes / 1e12
    if (tb >= 1) return tb.toFixed(1) + ' TB'
    const gb = bytes / 1e9
    return gb.toFixed(0) + ' GB'
  }

  const SidebarItem = ({ name, path, icon: Icon }: { name: string; path: string; icon: React.ElementType }) => {
    const isActive = currentPath === path || (path !== '/' && currentPath.startsWith(path + '/'))
    return (
      <button
        onClick={() => navigateToPath(path)}
        className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-left text-[13px] transition-all cursor-pointer ${
          isActive
            ? 'bg-[#3584e4]/20 text-[#3584e4] font-medium'
            : 'text-white/55 hover:bg-white/[0.05] hover:text-white/85'
        }`}
      >
        <Icon className="w-4 h-4 shrink-0" />
        <span className="truncate">{name}</span>
      </button>
    )
  }

  return (
    <div className="flex h-full text-white bg-[#0a0c14]/50 select-none">
      {/* Sidebar */}
      <div className="w-52 shrink-0 border-r border-white/[0.06] bg-[#0d0f1b]/90 pt-3 pb-4 px-2 flex flex-col gap-5 overflow-y-auto">
        <div>
          <p className="text-[10px] text-white/25 font-semibold uppercase tracking-widest px-3 mb-1">Bookmarks</p>
          <div className="space-y-0.5">
            {bookmarks.map(s => <SidebarItem key={s.path} {...s} />)}
          </div>
        </div>
        <div>
          <p className="text-[10px] text-white/25 font-semibold uppercase tracking-widest px-3 mb-1">Devices</p>
          <div className="space-y-0.5">
            {!disks || disks.length === 0 ? (
              <p className="text-[11px] text-white/20 px-3 py-1">No disks found</p>
            ) : disks.map(disk => {
              const canNav = !!disk.mount_point
              const isActive = canNav && (
                currentPath === disk.mount_point ||
                currentPath.startsWith(disk.mount_point! + '/')
              )
              const label = disk.model || disk.path.replace('/dev/', '')
              const sub = disk.mount_point || disk.path
              return (
                <button
                  key={disk.path}
                  onClick={() => canNav && navigateToPath(disk.mount_point!)}
                  disabled={!canNav}
                  className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-left transition-all ${
                    canNav ? 'cursor-pointer' : 'cursor-default opacity-40'
                  } ${
                    isActive
                      ? 'bg-[#3584e4]/20 text-[#3584e4]'
                      : canNav
                        ? 'text-white/55 hover:bg-white/[0.05] hover:text-white/85'
                        : 'text-white/30'
                  }`}
                >
                  <HardDrive className="w-4 h-4 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-medium truncate">{label}</div>
                    <div className="text-[10px] text-white/30 truncate flex items-center gap-1">
                      <span>{formatDiskSize(disk.size_bytes)}</span>
                      {disk.transport && <span className="uppercase">{disk.transport}</span>}
                      {sub && <span className="opacity-60">· {sub}</span>}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="h-12 border-b border-white/[0.06] px-3 flex items-center gap-2 bg-[#0e1019]/95 shrink-0">
          {/* Nav buttons */}
          <div className="flex items-center gap-0.5">
            <button
              onClick={handleBack}
              disabled={historyIndex === 0}
              className="p-1.5 rounded-md hover:bg-white/[0.06] disabled:opacity-25 disabled:cursor-default text-white/70 hover:text-white cursor-pointer transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleForward}
              disabled={historyIndex >= history.length - 1}
              className="p-1.5 rounded-md hover:bg-white/[0.06] disabled:opacity-25 disabled:cursor-default text-white/70 hover:text-white cursor-pointer transition-colors"
            >
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={handleUp}
              disabled={currentPath === '/' || !data}
              className="p-1.5 rounded-md hover:bg-white/[0.06] disabled:opacity-25 disabled:cursor-default text-white/70 hover:text-white cursor-pointer transition-colors"
            >
              <ArrowUp className="w-4 h-4" />
            </button>
          </div>

          {/* Path / Search area */}
          <div className="flex-1 min-w-0 mx-1">
            {searchActive ? (
              <div className="flex items-center gap-2 bg-[#161926] border border-white/10 rounded-lg h-8 px-3">
                <Search className="w-3.5 h-3.5 text-white/40 shrink-0" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder={`Search in ${currentPath === '/' ? 'Root' : pathParts[pathParts.length - 1]}…`}
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="flex-1 bg-transparent text-sm text-white focus:outline-none placeholder-white/30"
                />
                <button
                  onClick={() => { setSearchActive(false); setSearchQuery('') }}
                  className="text-white/30 hover:text-white/70 cursor-pointer transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : isEditingPath ? (
              <form onSubmit={handlePathSubmit} className="h-8 flex items-center bg-[#161926] border border-[#3584e4]/50 rounded-lg px-3">
                <input
                  type="text"
                  value={pathInput}
                  onChange={e => setPathInput(e.target.value)}
                  onBlur={() => setTimeout(() => setIsEditingPath(false), 200)}
                  autoFocus
                  className="flex-1 bg-transparent text-sm text-white focus:outline-none font-mono"
                />
              </form>
            ) : (
              <div
                onClick={() => setIsEditingPath(true)}
                className="h-8 flex items-center gap-1 overflow-x-auto scrollbar-none cursor-text text-sm bg-[#161926]/60 hover:bg-[#161926] border border-white/[0.06] rounded-lg px-3 transition-colors"
              >
                <button
                  onClick={e => { e.stopPropagation(); navigateToPath('/') }}
                  className="text-white/55 hover:text-white transition-colors shrink-0 text-[13px]"
                >
                  Root
                </button>
                {pathParts.map((part, i) => (
                  <div key={i} className="flex items-center gap-1 shrink-0">
                    <ChevronRight className="w-3 h-3 text-white/20" />
                    <button
                      onClick={e => { e.stopPropagation(); handleBreadcrumbClick(i, pathParts) }}
                      className="text-white/55 hover:text-white transition-colors text-[13px] max-w-[100px] truncate"
                    >
                      {part}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => refetch()}
              className="p-1.5 rounded-md hover:bg-white/[0.06] text-white/60 hover:text-white cursor-pointer transition-colors"
            >
              <RotateCw className={`w-4 h-4 ${isFetching ? 'animate-spin text-[#3584e4]' : ''}`} />
            </button>
            <button
              onClick={() => { setSearchActive(v => !v); if (searchActive) setSearchQuery('') }}
              className={`p-1.5 rounded-md cursor-pointer transition-colors ${
                searchActive ? 'bg-[#3584e4]/20 text-[#3584e4]' : 'hover:bg-white/[0.06] text-white/60 hover:text-white'
              }`}
            >
              <Search className="w-4 h-4" />
            </button>
            <div className="w-px h-5 bg-white/[0.08] mx-1" />
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-md cursor-pointer transition-colors ${
                viewMode === 'grid' ? 'bg-white/10 text-white' : 'text-white/50 hover:bg-white/[0.06] hover:text-white'
              }`}
            >
              <Grid3x3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-md cursor-pointer transition-colors ${
                viewMode === 'list' ? 'bg-white/10 text-white' : 'text-white/50 hover:bg-white/[0.06] hover:text-white'
              }`}
            >
              <List className="w-4 h-4" />
            </button>
            <div className="w-px h-5 bg-white/[0.08] mx-1" />
            <button
              onClick={() => setShowDetails(v => !v)}
              className={`p-1.5 rounded-md cursor-pointer transition-colors ${
                showDetails ? 'bg-[#3584e4]/20 text-[#3584e4]' : 'text-white/50 hover:bg-white/[0.06] hover:text-white'
              }`}
            >
              <Info className="w-4 h-4" />
            </button>
            <button className="p-1.5 rounded-md hover:bg-white/[0.06] text-white/50 hover:text-white cursor-pointer transition-colors">
              <MoreVertical className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 flex">
          <div className="flex-1 overflow-y-auto relative">
            {isLoading ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                <div className="w-8 h-8 border-2 border-[#3584e4]/20 border-t-[#3584e4] rounded-full animate-spin" />
                <p className="text-sm text-white/35">Loading…</p>
              </div>
            ) : error ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-4 text-red-400">
                  <AlertCircle className="w-8 h-8" />
                </div>
                <h3 className="text-base font-semibold text-white/80 mb-1">Unable to open location</h3>
                <p className="text-sm text-white/35 max-w-sm mb-6">
                  {(error as any)?.response?.data?.error || "This location doesn't exist or is not accessible."}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => navigateToPath('/')}
                    className="px-4 py-2 bg-white/[0.06] border border-white/10 text-sm rounded-lg hover:bg-white/10 transition-all cursor-pointer"
                  >
                    Go to Root
                  </button>
                  {historyIndex > 0 && (
                    <button
                      onClick={handleBack}
                      className="px-4 py-2 bg-[#3584e4] text-white text-sm rounded-lg hover:bg-[#4a95f4] transition-all cursor-pointer"
                    >
                      Go Back
                    </button>
                  )}
                </div>
              </div>
            ) : processedEntries.length === 0 ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                <FolderOpen className="w-16 h-16 text-white/10 mb-4" />
                <h3 className="text-sm font-semibold text-white/40">
                  {searchQuery ? 'No files match the search' : 'Empty Folder'}
                </h3>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="mt-3 text-xs text-[#3584e4] hover:underline cursor-pointer"
                  >
                    Clear search
                  </button>
                )}
              </div>
            ) : viewMode === 'grid' ? (
              /* Grid view */
              <div className="p-4 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-1">
                {processedEntries.map(entry => {
                  const Icon = getFileIcon(entry)
                  const isSelected = selectedItem?.path === entry.path
                  return (
                    <div
                      key={entry.path}
                      onClick={() => setSelectedItem(isSelected ? null : entry)}
                      onDoubleClick={() => handleFileOpen(entry)}
                      onContextMenu={(e) => handleFileContextMenu(e, entry)}
                      className={`flex flex-col items-center p-2 pt-3 rounded-xl border transition-all duration-100 cursor-pointer text-center group ${
                        isSelected
                          ? 'bg-[#3584e4]/15 border-[#3584e4]/35'
                          : 'bg-transparent border-transparent hover:bg-white/[0.04] hover:border-white/[0.06]'
                      }`}
                    >
                      <div className={`w-[72px] h-[72px] rounded-2xl flex items-center justify-center mb-2 transition-transform duration-150 group-hover:scale-[1.03] ${
                        entry.isDir
                          ? 'bg-[#1e6db5]/20 text-[#5baef7] border border-[#3584e4]/15'
                          : 'bg-white/[0.04] text-white/50 border border-white/[0.06]'
                      }`}>
                        <Icon className="w-9 h-9" />
                      </div>
                      <span className={`text-xs leading-tight font-medium line-clamp-2 w-full px-1 ${
                        isSelected ? 'text-[#5baef7]' : 'text-white/75 group-hover:text-white/90'
                      }`}>
                        {entry.name}
                      </span>
                      {!entry.isDir && (
                        <span className="text-[10px] text-white/30 mt-0.5">{formatBytes(entry.size)}</span>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              /* List view */
              <div className="flex flex-col">
                {/* Column headers */}
                <div className="flex items-center px-4 py-2 border-b border-white/[0.06] bg-[#0d0f1b]/50 sticky top-0 z-10">
                  <button
                    onClick={() => toggleSort('name')}
                    className="flex-1 flex items-center gap-1 text-[11px] font-semibold text-white/35 uppercase tracking-wider hover:text-white/60 cursor-pointer group transition-colors"
                  >
                    Name <SortIcon field="name" />
                  </button>
                  <button
                    onClick={() => toggleSort('size')}
                    className="w-24 flex items-center justify-end gap-1 text-[11px] font-semibold text-white/35 uppercase tracking-wider hover:text-white/60 cursor-pointer group transition-colors"
                  >
                    <SortIcon field="size" /> Size
                  </button>
                  <button
                    onClick={() => toggleSort('type')}
                    className="w-32 flex items-center gap-1 pl-4 text-[11px] font-semibold text-white/35 uppercase tracking-wider hover:text-white/60 cursor-pointer group transition-colors"
                  >
                    Type <SortIcon field="type" />
                  </button>
                  <button
                    onClick={() => toggleSort('time')}
                    className="w-40 flex items-center justify-end gap-1 text-[11px] font-semibold text-white/35 uppercase tracking-wider hover:text-white/60 cursor-pointer group transition-colors"
                  >
                    <SortIcon field="time" /> Modified
                  </button>
                </div>

                <div className="px-2 py-1">
                  {processedEntries.map(entry => {
                    const Icon = getFileIcon(entry)
                    const isSelected = selectedItem?.path === entry.path
                    return (
                      <div
                        key={entry.path}
                        onClick={() => setSelectedItem(isSelected ? null : entry)}
                        onDoubleClick={() => handleFileOpen(entry)}
                        onContextMenu={(e) => handleFileContextMenu(e, entry)}
                        className={`flex items-center gap-3 px-3 py-1.5 rounded-lg transition-all duration-100 cursor-pointer group text-[13px] ${
                          isSelected
                            ? 'bg-[#3584e4]/15 text-[#5baef7]'
                            : 'text-white/70 hover:bg-white/[0.04] hover:text-white/90'
                        }`}
                      >
                        <Icon className={`w-4 h-4 shrink-0 ${
                          entry.isDir ? 'text-[#5baef7]' : isSelected ? 'text-[#5baef7]' : 'text-white/40'
                        }`} />
                        <span className="flex-1 font-medium truncate">{entry.name}</span>
                        <span className="w-24 text-right text-[12px] text-white/35 group-hover:text-white/50 font-mono">
                          {entry.isDir ? '—' : formatBytes(entry.size)}
                        </span>
                        <span className="w-32 pl-4 text-[12px] text-white/30 group-hover:text-white/45 truncate">
                          {getFileType(entry)}
                        </span>
                        <span className="w-40 text-right text-[12px] text-white/30 group-hover:text-white/45">
                          {new Date(entry.modTime).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Details panel */}
          {showDetails && (
            <div className="w-60 shrink-0 border-l border-white/[0.06] bg-[#0d0f1b]/90 flex flex-col">
              {selectedItem ? (
                <>
                  <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
                    <span className="text-[11px] text-white/30 font-semibold uppercase tracking-wider">Properties</span>
                    <button
                      onClick={() => setSelectedItem(null)}
                      className="p-0.5 rounded hover:bg-white/[0.06] text-white/30 hover:text-white/60 cursor-pointer transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="p-4 flex flex-col items-center text-center border-b border-white/[0.06]">
                    <div className={`w-20 h-20 rounded-2xl flex items-center justify-center mb-3 ${
                      selectedItem.isDir
                        ? 'bg-[#1e6db5]/20 text-[#5baef7] border border-[#3584e4]/15'
                        : 'bg-white/[0.04] text-white/50 border border-white/[0.06]'
                    }`}>
                      {(() => { const I = getFileIcon(selectedItem); return <I className="w-10 h-10" /> })()}
                    </div>
                    <h4 className="text-sm font-semibold text-white/90 break-all leading-snug px-2">{selectedItem.name}</h4>
                    <p className="text-[11px] text-white/35 mt-1">{getFileType(selectedItem)}</p>
                  </div>

                  <div className="p-4 space-y-4 flex-1 overflow-y-auto">
                    <div>
                      <p className="text-[10px] text-white/25 uppercase tracking-widest font-bold mb-1">Location</p>
                      <p className="text-[12px] text-white/70 font-mono break-all bg-black/20 rounded-lg p-2 border border-white/[0.06] select-all">
                        {selectedItem.path}
                      </p>
                    </div>
                    {!selectedItem.isDir && (
                      <div>
                        <p className="text-[10px] text-white/25 uppercase tracking-widest font-bold mb-1">Size</p>
                        <p className="text-[13px] text-white/70 font-mono">{formatBytes(selectedItem.size)}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-[10px] text-white/25 uppercase tracking-widest font-bold mb-1">Permissions</p>
                      <p className="text-[12px] text-white/70 font-mono bg-white/[0.04] rounded px-2 py-0.5 w-max border border-white/[0.06]">
                        {selectedItem.mode}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-white/25 uppercase tracking-widest font-bold mb-1">Modified</p>
                      <p className="text-[12px] text-white/60 flex items-center gap-1.5">
                        <Clock className="w-3 h-3 text-white/25 shrink-0" />
                        {new Date(selectedItem.modTime).toLocaleString(undefined, {
                          month: 'short', day: 'numeric', year: 'numeric',
                          hour: '2-digit', minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>

                  <div className="p-4 border-t border-white/[0.06]">
                    {selectedItem.isDir ? (
                      <button
                        onClick={() => navigateToPath(selectedItem.path)}
                        className="w-full py-2 px-3 bg-white/[0.06] border border-white/10 hover:bg-white/10 text-white/80 text-[13px] font-medium rounded-lg transition-all cursor-pointer"
                      >
                        Open
                      </button>
                    ) : (
                      <a
                        href={`/api/files/download?path=${encodeURIComponent(selectedItem.path)}`}
                        download
                        className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-[#3584e4] hover:bg-[#4a95f4] text-white text-[13px] font-medium rounded-lg transition-all cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download
                      </a>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                  <Info className="w-8 h-8 text-white/10 mb-3" />
                  <p className="text-[12px] text-white/25">Select a file or folder to see its properties</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Status bar */}
        <div className="h-7 border-t border-white/[0.06] bg-[#0a0c13]/95 px-4 flex items-center justify-between text-[11px] text-white/35 shrink-0 select-none">
          <span>
            {data?.entries
              ? searchQuery
                ? `${processedEntries.length} of ${data.entries.length} items`
                : `${data.entries.length} item${data.entries.length !== 1 ? 's' : ''}`
              : '—'
            }
          </span>
          {selectedItem && (
            <span className="text-white/50 truncate max-w-[300px]">
              {selectedItem.name}
              {!selectedItem.isDir && ` — ${formatBytes(selectedItem.size)}`}
            </span>
          )}
        </div>
      </div>

      {/* Context menu */}
      {ctxMenu && createPortal(
        <div
          className="fixed py-1.5 rounded-xl select-none z-[9999]"
          style={{
            left: Math.min(ctxMenu.pos.x, window.innerWidth - 240),
            top: Math.min(ctxMenu.pos.y, window.innerHeight - 100),
            minWidth: '220px',
            background: 'rgba(18,20,30,0.96)',
            backdropFilter: 'blur(24px)',
            border: '1px solid rgba(255,255,255,0.10)',
            boxShadow: '0 16px 48px rgba(0,0,0,0.7)',
          }}
        >
          <div className="px-3 py-1.5 text-[11px] text-white/30 font-medium truncate border-b border-white/[0.06] mb-1 pb-1">
            {ctxMenu.entry.name}
          </div>
          {ctxMenu.entry.isDir && (
            <>
              <button
                onClick={createNewTextFile}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-white/80
                           hover:bg-white/[0.07] transition-colors cursor-pointer"
              >
                <File className="w-4 h-4" />
                New Text File
              </button>
              <button
                onClick={createNewFolder}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-white/80
                           hover:bg-white/[0.07] transition-colors cursor-pointer"
              >
                <Folder className="w-4 h-4" />
                New Folder
              </button>
              <div className="border-t border-white/[0.06] my-1" />
              <button
                onClick={() => openInCodeEditor(ctxMenu.entry.path + '/')}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-white/80
                           hover:bg-white/[0.07] transition-colors cursor-pointer"
              >
                <Code className="w-4 h-4" />
                Open in Code Editor
              </button>
            </>
          )}
          {!ctxMenu.entry.isDir && (
            <>
              <button
                onClick={() => { handleFileOpen(ctxMenu.entry); setCtxMenu(null) }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-white/80
                           hover:bg-white/[0.07] transition-colors cursor-pointer"
              >
                <FolderOpen className="w-4 h-4" />
                Open
              </button>
              <button
                onClick={() => openInCodeEditor(ctxMenu.entry.path)}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-white/80
                           hover:bg-white/[0.07] transition-colors cursor-pointer"
              >
                <Code className="w-4 h-4" />
                Open in Code Editor
              </button>
            </>
          )}
        </div>,
        document.body
      )}
    </div>
  )
}
