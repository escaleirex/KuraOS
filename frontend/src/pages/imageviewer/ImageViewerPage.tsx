import { useState, useRef, useCallback, useEffect, useContext } from 'react'
import { MagnifyingGlassPlus, MagnifyingGlassMinus, ArrowCounterClockwise, Image, FolderOpen, ArrowsOut, ArrowsIn } from '@phosphor-icons/react'
import { WindowParamsContext } from '@/components/Desktop'
import { FilePicker } from '@/components/FilePicker'
import { api } from '@/api/client'

export function ImageViewerPage() {
  const params = useContext(WindowParamsContext)
  const [src, setSrc]           = useState<string | null>(null)
  const [filename, setFilename] = useState('')
  const [scale, setScale]       = useState(1)
  const [rotation, setRotation] = useState(0)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [loading, setLoading]   = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const viewerRef               = useRef<HTMLDivElement>(null)

  const loadImage = useCallback((path: string) => {
    setFilename(path.split('/').pop() ?? path)
    setLoading(true)
    api.get(`/files/download?path=${encodeURIComponent(path)}&inline=1`, { responseType: 'blob' })
      .then(res => {
        const url = URL.createObjectURL(res.data)
        setSrc(prev => { if (prev) URL.revokeObjectURL(prev); return url })
        setScale(1)
        setRotation(0)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    const filePath = params?.filePath
    if (filePath) loadImage(filePath)
  }, [params?.filePath, loadImage])

  const toggleFullscreen = useCallback(() => {
    if (!viewerRef.current) return
    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      viewerRef.current.requestFullscreen()
    }
  }, [])

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  }, [])

  const handleFilePick = (path: string) => {
    setPickerOpen(false)
    loadImage(path)
  }

  // zoom with scroll
  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    setScale(s => Math.min(8, Math.max(0.1, s - e.deltaY * 0.001)))
  }, [])

  useEffect(() => {
    const el = viewerRef.current
    if (!el) return
    el.addEventListener('wheel', (e) => e.preventDefault(), { passive: false })
  }, [])

  return (
    <div className="flex flex-col h-full" style={{ background: 'rgba(8,10,18,0.97)' }}>
      {/* toolbar */}
      <div
        className="flex items-center gap-1 px-3 py-1.5 shrink-0"
        style={{ borderBottom: '1px solid var(--kura-alpha-06)', background: 'var(--kura-alpha-02)' }}
      >
        <button
          onClick={() => setPickerOpen(true)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-white/60
                     hover:text-white hover:bg-white/[0.07] transition-colors cursor-pointer"
        >
          <FolderOpen size={14} />
          Open
        </button>

        <div className="w-px h-4 mx-1" style={{ background: 'var(--kura-alpha-08)' }} />

        <button
          onClick={() => setScale(s => Math.min(8, s + 0.25))}
          disabled={!src}
          title="Zoom in"
          className="w-7 h-7 flex items-center justify-center rounded-lg text-white/60
                     hover:text-white hover:bg-white/[0.07] transition-colors cursor-pointer
                     disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <MagnifyingGlassPlus size={15} />
        </button>

        <button
          onClick={() => setScale(s => Math.max(0.1, s - 0.25))}
          disabled={!src}
          title="Zoom out"
          className="w-7 h-7 flex items-center justify-center rounded-lg text-white/60
                     hover:text-white hover:bg-white/[0.07] transition-colors cursor-pointer
                     disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <MagnifyingGlassMinus size={15} />
        </button>

        <button
          onClick={() => { setScale(1); setRotation(0) }}
          disabled={!src}
          title="Reset"
          className="w-7 h-7 flex items-center justify-center rounded-lg text-white/60
                     hover:text-white hover:bg-white/[0.07] transition-colors cursor-pointer
                     disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ArrowCounterClockwise size={14} />
        </button>

        <button
          onClick={() => setRotation(r => (r + 90) % 360)}
          disabled={!src}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-white/60
                     hover:text-white hover:bg-white/[0.07] transition-colors cursor-pointer
                     disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Rotate
        </button>

        <button
          onClick={() => setScale(1)}
          disabled={!src}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-white/60
                     hover:text-white hover:bg-white/[0.07] transition-colors cursor-pointer
                     disabled:opacity-30 disabled:cursor-not-allowed"
        >
          1:1
        </button>

        <div className="flex-1" />

        {src && (
          <button
            onClick={toggleFullscreen}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-white/60
                       hover:text-white hover:bg-white/[0.07] transition-colors cursor-pointer"
            title="Fullscreen"
          >
            {isFullscreen ? <ArrowsIn size={15} /> : <ArrowsOut size={15} />}
          </button>
        )}

        {loading && <span className="text-[11px] text-white/30">Loading…</span>}
        {src && !loading && (
          <span className="text-[11px] text-white/30 truncate max-w-[180px]">
            {filename} — {Math.round(scale * 100)}%
          </span>
        )}
      </div>

      {/* viewer */}
      <div
        ref={viewerRef}
        className="flex-1 relative overflow-hidden flex items-center justify-center"
        onWheel={onWheel}
      >
        {loading ? (
          <div className="flex flex-col items-center gap-3 pointer-events-none" style={{ opacity: 0.3 }}>
            <div className="w-8 h-8 border-2 border-white/10 border-t-white/40 rounded-full animate-spin" />
          </div>
        ) : src ? (
          <img
            src={src}
            alt={filename}
            draggable={false}
            style={{
              transform:        `scale(${scale}) rotate(${rotation}deg)`,
              transformOrigin:  'center',
              transition:       'transform 0.15s ease',
              maxWidth:         '100%',
              maxHeight:        '100%',
              objectFit:        'contain',
              userSelect:       'none',
            }}
          />
        ) : (
          <div className="flex flex-col items-center gap-3 pointer-events-none" style={{ opacity: 0.25 }}>
            <Image size={56} weight="thin" className="text-white" />
            <p className="text-sm text-white/60">Open a file to view</p>
          </div>
        )}
      </div>

      {pickerOpen && (
        <FilePicker
          title="Open Image"
          accept={['images', 'all']}
          onOpen={handleFilePick}
          onCancel={() => setPickerOpen(false)}
        />
      )}
    </div>
  )
}
