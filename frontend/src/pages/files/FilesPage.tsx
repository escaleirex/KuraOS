import { useState, useEffect, useMemo } from 'react'
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
  Grid,
  List,
  Home,
  AlertCircle,
  Clock,
  Settings,
  Database
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

interface ListDirResponse {
  path: string
  parent: string
  entries: FileEntry[]
}

const SIDEBAR_SHORTCUTS = [
  { name: 'Root (/)', path: '/', icon: Home, color: 'text-sky-500' },
  { name: 'Mounts (/mnt)', path: '/mnt', icon: HardDrive, color: 'text-indigo-400' },
  { name: 'Home (/home)', path: '/home', icon: Database, color: 'text-emerald-400' },
  { name: 'Media (/media)', path: '/media', icon: FileVideo, color: 'text-rose-400' },
  { name: 'Services (/srv)', path: '/srv', icon: Settings, color: 'text-amber-400' },
  { name: 'Data (/data)', path: '/data', icon: HardDrive, color: 'text-teal-400' },
]

export function FilesPage() {
  // Navigation & History State
  const [currentPath, setCurrentPath] = useState<string>('/')
  const [history, setHistory] = useState<string[]>(['/'])
  const [historyIndex, setHistoryIndex] = useState<number>(0)

  // View state
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [selectedItem, setSelectedItem] = useState<FileEntry | null>(null)
  const [showDetails, setShowDetails] = useState<boolean>(false)
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [sortBy, setSortBy] = useState<'name' | 'size' | 'time'>('name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')

  // Manual Path input state
  const [isEditingPath, setIsEditingPath] = useState<boolean>(false)
  const [pathInput, setPathInput] = useState<string>('/')

  // Sync manual input path with currentPath
  useEffect(() => {
    setPathInput(currentPath)
    setSelectedItem(null) // clear selection on path change
  }, [currentPath])

  // Fetch API
  const { data, isLoading, error, refetch, isFetching } = useQuery<ListDirResponse>({
    queryKey: ['files-list', currentPath],
    queryFn: () => filesApi.list(currentPath).then(res => res.data),
    retry: false,
  })

  // Navigate helper that manages history
  const navigateToPath = (newPath: string, isBackOrForward: boolean = false) => {
    if (newPath === currentPath) return

    if (!isBackOrForward) {
      const nextHistory = history.slice(0, historyIndex + 1)
      setHistory([...nextHistory, newPath])
      setHistoryIndex(nextHistory.length)
    }
    setCurrentPath(newPath)
  }

  // Back / Forward / Up
  const handleBack = () => {
    if (historyIndex > 0) {
      const prevIdx = historyIndex - 1
      setHistoryIndex(prevIdx)
      navigateToPath(history[prevIdx], true)
    }
  }

  const handleForward = () => {
    if (historyIndex < history.length - 1) {
      const nextIdx = historyIndex + 1
      setHistoryIndex(nextIdx)
      navigateToPath(history[nextIdx], true)
    }
  }

  const handleUp = () => {
    if (data?.parent !== undefined) {
      // If the parent is empty but we're not at "/", fallback to "/"
      navigateToPath(data.parent || '/')
    }
  }

  // Key handlers for breadcrumbs
  const handleBreadcrumbClick = (index: number, parts: string[]) => {
    const targetPath = '/' + parts.slice(0, index + 1).join('/')
    navigateToPath(targetPath)
  }

  const handlePathSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setIsEditingPath(false)
    let target = pathInput.trim()
    if (!target) target = '/'
    navigateToPath(target)
  }

  // Filter & Sort entries
  const processedEntries = useMemo(() => {
    if (!data?.entries) return []

    // Search filter
    let items = data.entries.filter(entry =>
      entry.name.toLowerCase().includes(searchQuery.toLowerCase())
    )

    // Sorting logic
    items.sort((a, b) => {
      // Always put directories first
      if (a.isDir !== b.isDir) {
        return a.isDir ? -1 : 1
      }

      let comparison = 0
      if (sortBy === 'name') {
        comparison = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
      } else if (sortBy === 'size') {
        comparison = a.size - b.size
      } else if (sortBy === 'time') {
        comparison = new Date(a.modTime).getTime() - new Date(b.modTime).getTime()
      }

      return sortOrder === 'asc' ? comparison : -comparison
    })

    return items
  }, [data, searchQuery, sortBy, sortOrder])

  // Split path into parts for breadcrumb rendering
  const pathParts = useMemo(() => {
    return currentPath.split('/').filter(Boolean)
  }, [currentPath])

  // Helper for displaying file size
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  // Helper to determine file icon
  const getFileIcon = (entry: FileEntry) => {
    if (entry.isDir) return Folder

    const ext = entry.name.split('.').pop()?.toLowerCase()
    if (!ext) return File

    const imageExts = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'ico']
    const videoExts = ['mp4', 'mkv', 'avi', 'mov', 'webm', 'flv', 'wmv']
    const audioExts = ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac']
    const docExts = ['txt', 'md', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'json', 'yml', 'yaml', 'xml']

    if (imageExts.includes(ext)) return FileImage
    if (videoExts.includes(ext)) return FileVideo
    if (audioExts.includes(ext)) return FileAudio
    if (docExts.includes(ext)) return FileText

    return File
  }

  return (
    <div className="flex h-full text-white bg-[#0a0c14]/50 select-none">
      {/* 1. Left Sidebar - Places & Allowed Roots */}
      <div className="w-56 shrink-0 border-r border-white/5 bg-[#0f111a]/85 backdrop-blur-xl p-3 flex flex-col justify-between">
        <div className="space-y-4">
          <div>
            <p className="text-[10px] text-white/30 font-semibold uppercase tracking-wider px-2 mb-2">Places</p>
            <nav className="space-y-1">
              {SIDEBAR_SHORTCUTS.map(shortcut => {
                const IconComponent = shortcut.icon
                const isActive = currentPath === shortcut.path ||
                  (shortcut.path !== '/' && currentPath.startsWith(shortcut.path))
                return (
                  <button
                    key={shortcut.path}
                    onClick={() => navigateToPath(shortcut.path)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left text-sm transition-all cursor-pointer ${
                      isActive
                        ? 'bg-white/10 text-white font-medium shadow-sm'
                        : 'text-white/60 hover:bg-white/[0.04] hover:text-white'
                    }`}
                  >
                    <IconComponent className={`w-4 h-4 ${shortcut.color}`} />
                    <span>{shortcut.name}</span>
                  </button>
                )
              })}
            </nav>
          </div>
        </div>

        {/* Sidebar Footer info */}
        <div className="p-2 bg-white/[0.02] border border-white/5 rounded-xl text-center">
          <p className="text-[10px] text-white/40 font-medium">Server Filesystem</p>
          <p className="text-[9px] text-emerald-400 mt-0.5 flex items-center justify-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            Connected
          </p>
        </div>
      </div>

      {/* 2. Main Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#0c0d16]/30">
        {/* Header Toolbar */}
        <div className="h-14 border-b border-white/5 px-4 flex items-center justify-between gap-4 bg-[#0e1019]/90 shrink-0">
          {/* Navigation & Refresh buttons */}
          <div className="flex items-center gap-1">
            <button
              onClick={handleBack}
              disabled={historyIndex === 0}
              className="p-1.5 rounded-lg hover:bg-white/5 disabled:opacity-30 disabled:hover:bg-transparent text-white/80 hover:text-white cursor-pointer transition-colors"
              title="Back"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleForward}
              disabled={historyIndex >= history.length - 1}
              className="p-1.5 rounded-lg hover:bg-white/5 disabled:opacity-30 disabled:hover:bg-transparent text-white/80 hover:text-white cursor-pointer transition-colors"
              title="Forward"
            >
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={handleUp}
              disabled={currentPath === '/' || !data}
              className="p-1.5 rounded-lg hover:bg-white/5 disabled:opacity-30 disabled:hover:bg-transparent text-white/80 hover:text-white cursor-pointer transition-colors"
              title="Up one level"
            >
              <ArrowUp className="w-4 h-4" />
            </button>
            <button
              onClick={() => refetch()}
              className="p-1.5 rounded-lg hover:bg-white/5 text-white/80 hover:text-white cursor-pointer transition-colors"
              title="Refresh"
            >
              <RotateCw className={`w-4 h-4 ${isFetching ? 'animate-spin text-sky-400' : ''}`} />
            </button>
          </div>

          {/* Breadcrumbs / Path Input */}
          <div className="flex-1 min-w-0 flex items-center bg-[#151722] border border-white/5 rounded-xl h-9 px-3 relative">
            {isEditingPath ? (
              <form onSubmit={handlePathSubmit} className="w-full h-full flex items-center">
                <input
                  type="text"
                  value={pathInput}
                  onChange={e => setPathInput(e.target.value)}
                  onBlur={() => setTimeout(() => setIsEditingPath(false), 200)}
                  autoFocus
                  className="w-full bg-transparent text-sm text-white focus:outline-none border-none"
                />
              </form>
            ) : (
              <div
                onClick={() => setIsEditingPath(true)}
                className="w-full h-full flex items-center gap-1 overflow-x-auto scrollbar-none cursor-text text-sm text-white/70"
              >
                <button
                  onClick={e => { e.stopPropagation(); navigateToPath('/') }}
                  className="hover:text-white hover:underline transition-colors shrink-0"
                >
                  Root
                </button>
                {pathParts.map((part, index) => (
                  <div key={index} className="flex items-center gap-1 shrink-0">
                    <ChevronRight className="w-3.5 h-3.5 text-white/30" />
                    <button
                      onClick={e => { e.stopPropagation(); handleBreadcrumbClick(index, pathParts) }}
                      className="hover:text-white hover:underline transition-colors max-w-[120px] truncate"
                    >
                      {part}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Search bar */}
          <div className="w-48 shrink-0 relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-white/40 pointer-events-none" />
            <input
              type="text"
              placeholder="Search directory..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-[#151722] border border-white/5 rounded-xl h-9 pl-9 pr-4 text-xs text-white focus:outline-none focus:border-white/20 transition-all placeholder-white/30"
            />
          </div>

          {/* View Mode & Sort Toggle */}
          <div className="flex items-center gap-1 border-l border-white/5 pl-4 shrink-0">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
                viewMode === 'grid' ? 'bg-white/10 text-white' : 'text-white/50 hover:bg-white/5 hover:text-white'
              }`}
              title="Grid View"
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
                viewMode === 'list' ? 'bg-white/10 text-white' : 'text-white/50 hover:bg-white/5 hover:text-white'
              }`}
              title="List View"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowDetails(v => !v)}
              className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
                showDetails ? 'bg-white/10 text-white' : 'text-white/50 hover:bg-white/5 hover:text-white'
              }`}
              title="Toggle Details Panel"
            >
              <Info className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Sorting options toolbar (Only visible if we have entries) */}
        {data && data.entries.length > 0 && (
          <div className="h-8 border-b border-white/5 px-4 flex items-center justify-between text-[11px] text-white/40 bg-[#0d0f17]/50 shrink-0">
            <div className="flex items-center gap-3">
              <span>Sort by:</span>
              <button
                onClick={() => {
                  if (sortBy === 'name') setSortOrder(o => o === 'asc' ? 'desc' : 'asc')
                  else { setSortBy('name'); setSortOrder('asc') }
                }}
                className={`hover:text-white cursor-pointer font-medium ${sortBy === 'name' ? 'text-sky-400 font-semibold' : ''}`}
              >
                Name {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
              </button>
              <button
                onClick={() => {
                  if (sortBy === 'size') setSortOrder(o => o === 'asc' ? 'desc' : 'asc')
                  else { setSortBy('size'); setSortOrder('asc') }
                }}
                className={`hover:text-white cursor-pointer font-medium ${sortBy === 'size' ? 'text-sky-400 font-semibold' : ''}`}
              >
                Size {sortBy === 'size' && (sortOrder === 'asc' ? '↑' : '↓')}
              </button>
              <button
                onClick={() => {
                  if (sortBy === 'time') setSortOrder(o => o === 'asc' ? 'desc' : 'asc')
                  else { setSortBy('time'); setSortOrder('asc') }
                }}
                className={`hover:text-white cursor-pointer font-medium ${sortBy === 'time' ? 'text-sky-400 font-semibold' : ''}`}
              >
                Modified {sortBy === 'time' && (sortOrder === 'asc' ? '↑' : '↓')}
              </button>
            </div>
            <div>
              <span>{processedEntries.length} items</span>
            </div>
          </div>
        )}

        {/* Content Viewer */}
        <div className="flex-1 overflow-y-auto p-4 relative min-h-0 custom-scrollbar">
          {isLoading ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <div className="w-10 h-10 border-2 border-sky-500/20 border-t-sky-500 rounded-full animate-spin"></div>
              <p className="text-sm text-white/40">Reading files...</p>
            </div>
          ) : error ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
              <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/25 flex items-center justify-center mb-4 text-rose-500 shadow-lg shadow-rose-950/20">
                <AlertCircle className="w-7 h-7" />
              </div>
              <h3 className="text-base font-semibold text-white/90">Unable to access location</h3>
              <p className="text-sm text-white/40 max-w-sm mt-1 mb-6">
                {(error as any)?.response?.data?.error || "This directory doesn't exist or is not inside KuraOS allowed access directories."}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => navigateToPath('/')}
                  className="px-4 py-2 bg-white/5 border border-white/10 text-xs font-semibold rounded-xl hover:bg-white/10 transition-all cursor-pointer"
                >
                  Go to Root (/)
                </button>
                {historyIndex > 0 && (
                  <button
                    onClick={handleBack}
                    className="px-4 py-2 bg-sky-600 text-[#07090e] text-xs font-semibold rounded-xl hover:bg-sky-500 transition-all cursor-pointer shadow-lg shadow-sky-950/20"
                  >
                    Go Back
                  </button>
                )}
              </div>
            </div>
          ) : processedEntries.length === 0 ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center opacity-60">
              <div className="w-16 h-16 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-center mb-3 text-white/20">
                <FolderOpen className="w-8 h-8" />
              </div>
              <h3 className="text-sm font-semibold text-white/80">Empty Directory</h3>
              <p className="text-xs text-white/30 mt-1 max-w-[240px]">
                {searchQuery ? "No search results match your criteria." : "This directory contains no files or folders."}
              </p>
            </div>
          ) : viewMode === 'grid' ? (
            /* Grid View Mode */
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
              {processedEntries.map(entry => {
                const IconComponent = getFileIcon(entry)
                const isSelected = selectedItem?.path === entry.path
                return (
                  <div
                    key={entry.path}
                    onClick={() => setSelectedItem(entry)}
                    onDoubleClick={() => entry.isDir && navigateToPath(entry.path)}
                    className={`flex flex-col items-center p-3 rounded-2xl border transition-all duration-150 cursor-pointer text-center select-none group relative ${
                      isSelected
                        ? 'bg-sky-500/10 border-sky-500/30 text-sky-400 shadow-md shadow-sky-950/20'
                        : 'bg-white/[0.01] border-white/[0.04] text-white/80 hover:bg-white/[0.04] hover:border-white/10 hover:text-white'
                    }`}
                  >
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-2.5 transition-transform duration-200 group-hover:scale-105 ${
                      entry.isDir
                        ? 'bg-amber-500/10 text-amber-500 border border-amber-500/10 shadow-lg shadow-amber-950/15'
                        : 'bg-sky-500/10 text-sky-400 border border-sky-500/10 shadow-lg shadow-sky-950/15'
                    }`}>
                      <IconComponent className="w-6 h-6" />
                    </div>
                    <span className="text-xs leading-tight font-medium max-w-full truncate px-1">
                      {entry.name}
                    </span>
                    {entry.isDir ? (
                      <span className="text-[9px] text-white/30 group-hover:text-white/40 mt-1">Folder</span>
                    ) : (
                      <span className="text-[9px] text-white/30 group-hover:text-white/40 mt-1">{formatBytes(entry.size)}</span>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            /* List View Mode */
            <div className="space-y-1">
              <div className="flex items-center px-3 py-1.5 text-[10px] uppercase font-bold tracking-wider text-white/30 border-b border-white/5 mb-1 select-none">
                <span className="flex-1">Name</span>
                <span className="w-24 text-right">Size</span>
                <span className="w-40 text-right">Last Modified</span>
              </div>
              {processedEntries.map(entry => {
                const IconComponent = getFileIcon(entry)
                const isSelected = selectedItem?.path === entry.path
                return (
                  <div
                    key={entry.path}
                    onClick={() => setSelectedItem(entry)}
                    onDoubleClick={() => entry.isDir && navigateToPath(entry.path)}
                    className={`flex items-center gap-3 px-3 py-2 rounded-xl border transition-all duration-150 cursor-pointer select-none group text-xs ${
                      isSelected
                        ? 'bg-sky-500/10 border-sky-500/30 text-sky-400 shadow-md'
                        : 'bg-transparent border-transparent text-white/80 hover:bg-white/[0.03] hover:text-white'
                    }`}
                  >
                    <IconComponent className={`w-4 h-4 shrink-0 ${entry.isDir ? 'text-amber-500' : 'text-sky-400'}`} />
                    <span className="flex-1 font-medium truncate">{entry.name}</span>
                    <span className="w-24 text-right text-white/40 group-hover:text-white/60">
                      {entry.isDir ? '—' : formatBytes(entry.size)}
                    </span>
                    <span className="w-40 text-right text-white/40 group-hover:text-white/60 truncate">
                      {new Date(entry.modTime).toLocaleDateString()} {new Date(entry.modTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* 3. Bottom Status Bar */}
        <div className="h-8 border-t border-white/5 bg-[#0a0c13]/90 px-4 flex items-center justify-between text-[11px] text-white/45 shrink-0 select-none">
          <div className="flex items-center gap-2">
            <span>{data?.entries ? `${data.entries.length} items` : '0 items'}</span>
            {searchQuery && (
              <span className="text-white/20">| Matching search: {processedEntries.length} items</span>
            )}
          </div>
          <div>
            {selectedItem ? (
              <span className="text-sky-400 font-medium truncate max-w-[320px] inline-block">
                Selected: {selectedItem.name} ({selectedItem.isDir ? 'Directory' : formatBytes(selectedItem.size)})
              </span>
            ) : (
              <span>No selection</span>
            )}
          </div>
        </div>
      </div>

      {/* 4. Collapsible Details Sidebar Panel (Right) */}
      {showDetails && selectedItem && (
        <div className="w-64 shrink-0 border-l border-white/5 bg-[#0f111a]/85 backdrop-blur-xl p-4 flex flex-col justify-between select-none">
          <div className="space-y-6">
            <div className="flex items-center justify-between pb-2 border-b border-white/5">
              <span className="text-xs font-semibold text-white/40 uppercase tracking-wider">Details</span>
              <button
                onClick={() => setSelectedItem(null)}
                className="text-[10px] text-white/30 hover:text-white/70 transition-colors cursor-pointer"
              >
                Clear
              </button>
            </div>

            {/* Giant Preview Icon */}
            <div className="flex flex-col items-center text-center py-6 bg-white/[0.01] border border-white/5 rounded-2xl">
              <div className={`w-20 h-20 rounded-2xl flex items-center justify-center mb-4 shadow-xl ${
                selectedItem.isDir
                  ? 'bg-amber-500/10 text-amber-500 shadow-amber-950/20 border border-amber-500/10'
                  : 'bg-sky-500/10 text-sky-400 shadow-sky-950/20 border border-sky-500/10'
              }`}>
                {(() => {
                  const Icon = getFileIcon(selectedItem)
                  return <Icon className="w-10 h-10" />
                })()}
              </div>
              <h4 className="text-sm font-semibold px-4 break-all leading-snug text-white/95">
                {selectedItem.name}
              </h4>
              <p className="text-[11px] text-white/40 mt-1.5 uppercase tracking-wide font-medium">
                {selectedItem.isDir ? 'Directory' : `${selectedItem.name.split('.').pop()?.toUpperCase() || 'FILE'} File`}
              </p>
            </div>

            {/* Meta Properties */}
            <div className="space-y-3.5">
              <div>
                <p className="text-[10px] text-white/30 uppercase tracking-widest font-bold">Full Path</p>
                <p className="text-xs text-white/80 font-mono break-all mt-0.5 select-all p-1.5 rounded-lg bg-black/20 border border-white/5">
                  {selectedItem.path}
                </p>
              </div>

              {!selectedItem.isDir && (
                <div>
                  <p className="text-[10px] text-white/30 uppercase tracking-widest font-bold">Size</p>
                  <p className="text-xs text-white/80 font-mono mt-0.5">
                    {formatBytes(selectedItem.size)}
                  </p>
                </div>
              )}

              <div>
                <p className="text-[10px] text-white/30 uppercase tracking-widest font-bold">Permissions Mode</p>
                <p className="text-xs text-white/85 font-mono mt-0.5 bg-white/5 border border-white/5 rounded-md px-2 py-0.5 w-max">
                  {selectedItem.mode}
                </p>
              </div>

              <div>
                <p className="text-[10px] text-white/30 uppercase tracking-widest font-bold">Last Modified</p>
                <p className="text-xs text-white/80 font-medium mt-0.5 flex items-center gap-1.5 text-white/70">
                  <Clock className="w-3.5 h-3.5 text-white/30" />
                  <span>
                    {new Date(selectedItem.modTime).toLocaleDateString()} {new Date(selectedItem.modTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </p>
              </div>
            </div>
          </div>

          {/* Download/Open action button if it's not a folder */}
          {!selectedItem.isDir ? (
            <div className="space-y-2 mt-6">
              <a
                href={`/api/files/download?path=${encodeURIComponent(selectedItem.path)}`}
                download
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-sky-600 hover:bg-sky-500 text-[#07090e] font-semibold text-xs rounded-xl shadow-lg shadow-sky-950/20 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer text-center"
              >
                Download File
              </a>
              <p className="text-[9px] text-white/30 text-center leading-normal">
                Served securely from KuraOS Daemon
              </p>
            </div>
          ) : (
            <button
              onClick={() => navigateToPath(selectedItem.path)}
              className="w-full py-2.5 px-4 bg-white/5 border border-white/10 hover:bg-white/10 text-white font-semibold text-xs rounded-xl transition-all cursor-pointer text-center"
            >
              Open Directory
            </button>
          )}
        </div>
      )}
    </div>
  )
}
