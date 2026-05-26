import { useState, useRef, useCallback, useEffect, useContext } from 'react'
import {
  Play, Pause, SpeakerHigh, SpeakerSlash,
  ArrowsOut, ArrowsIn, FilmStrip, FolderOpen,
} from '@phosphor-icons/react'
import { WindowParamsContext } from '@/components/Desktop'
import { FilePicker } from '@/components/FilePicker'
import { api } from '@/api/client'

function formatTime(s: number): string {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

export function VideoPlayerPage() {
  const params = useContext(WindowParamsContext)
  const [src, setSrc]           = useState<string | null>(null)
  const [filename, setFilename] = useState('')
  const [playing, setPlaying]   = useState(false)
  const [muted, setMuted]       = useState(false)
  const [volume, setVolume]     = useState(1)
  const [current, setCurrent]   = useState(0)
  const [duration, setDuration] = useState(0)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [loading, setLoading]   = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [controlsVisible, setControlsVisible] = useState(true)
  const videoRef                = useRef<HTMLVideoElement>(null)
  const containerRef            = useRef<HTMLDivElement>(null)
  const hideTimerRef            = useRef<number | null>(null)

  const loadVideo = useCallback((path: string) => {
    setFilename(path.split('/').pop() ?? path)
    setLoading(true)
    setPlaying(false)
    setCurrent(0)
    setDuration(0)
    api.get(`/files/download?path=${encodeURIComponent(path)}&inline=1`, { responseType: 'blob' })
      .then(res => {
        const url = URL.createObjectURL(res.data)
        setSrc(prev => { if (prev) URL.revokeObjectURL(prev); return url })
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    const filePath = params?.filePath
    if (filePath) loadVideo(filePath)
  }, [params?.filePath, loadVideo])

  const handleFilePick = (path: string) => {
    setPickerOpen(false)
    loadVideo(path)
  }

  const togglePlay = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    if (v.paused) { v.play(); setPlaying(true) }
    else          { v.pause(); setPlaying(false) }
  }, [])

  const toggleMute = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    v.muted = !v.muted
    setMuted(v.muted)
  }, [])

  const onVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value)
    setVolume(val)
    if (videoRef.current) {
      videoRef.current.volume = val
      videoRef.current.muted  = val === 0
      setMuted(val === 0)
    }
  }, [])

  const onSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = videoRef.current
    if (!v) return
    v.currentTime = parseFloat(e.target.value)
    setCurrent(v.currentTime)
  }, [])

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return
    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      containerRef.current.requestFullscreen()
    }
  }, [])

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  }, [])

  const playingRef = useRef(false)
  playingRef.current = playing

  const resetHideTimer = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    if (playingRef.current && isFullscreen) {
      hideTimerRef.current = window.setTimeout(() => setControlsVisible(false), 3000)
    }
  }, [isFullscreen])

  const showControls = useCallback(() => {
    setControlsVisible(true)
    resetHideTimer()
  }, [resetHideTimer])

  useEffect(() => {
    if (playing && isFullscreen) {
      resetHideTimer()
    } else {
      setControlsVisible(true)
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    }
  }, [playing, isFullscreen, resetHideTimer])

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    const onTime  = () => setCurrent(v.currentTime)
    const onMeta  = () => setDuration(v.duration)
    const onEnded = () => setPlaying(false)
    v.addEventListener('timeupdate', onTime)
    v.addEventListener('loadedmetadata', onMeta)
    v.addEventListener('ended', onEnded)
    return () => {
      v.removeEventListener('timeupdate', onTime)
      v.removeEventListener('loadedmetadata', onMeta)
      v.removeEventListener('ended', onEnded)
    }
  }, [src])

  const progress = duration > 0 ? current / duration : 0

  const Controls = (
    <div
      className="px-3 pt-2 pb-2.5 flex flex-col gap-2"
      onClick={e => e.stopPropagation()}
      onMouseMove={showControls}
      style={{
        background: isFullscreen ? 'linear-gradient(transparent, rgba(0,0,0,0.95) 40%, rgba(0,0,0,0.95))' : 'var(--kura-menu-bg)',
        borderTop: isFullscreen ? 'none' : '1px solid var(--kura-alpha-06)',
        transition: 'opacity 0.2s',
        opacity: controlsVisible || !isFullscreen ? 1 : 0,
        pointerEvents: controlsVisible || !isFullscreen ? 'auto' : 'none',
      }}
    >
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-white/50 w-8 shrink-0 font-mono">{formatTime(current)}</span>
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={current}
          onChange={onSeek}
          className="flex-1 h-[6px] rounded-full cursor-pointer"
          style={{
            accentColor: '#a855f7',
            background: 'linear-gradient(to right, #a855f7 0%, #a855f7 ' + (progress * 100) + '%, var(--kura-alpha-10) ' + (progress * 100) + '%, var(--kura-alpha-10) 100%)',
          }}
        />
        <span className="text-[11px] text-white/50 w-8 shrink-0 text-right font-mono">{formatTime(duration)}</span>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={togglePlay}
          className="w-7 h-7 flex items-center justify-center rounded-full text-white/70
                     hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
        >
          {playing ? <Pause size={15} weight="fill" /> : <Play size={15} weight="fill" />}
        </button>

        <button
          onClick={toggleMute}
          className="w-7 h-7 flex items-center justify-center rounded-full text-white/70
                     hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
        >
          {muted ? <SpeakerSlash size={14} /> : <SpeakerHigh size={14} />}
        </button>

        <input
          type="range"
          min={0}
          max={1}
          step={0.02}
          value={muted ? 0 : volume}
          onChange={onVolumeChange}
          className="w-20 h-[6px] rounded-full cursor-pointer"
          style={{
            accentColor: '#a855f7',
            background: 'linear-gradient(to right, #a855f7 0%, #a855f7 ' + ((muted ? 0 : volume) * 100) + '%, var(--kura-alpha-10) ' + ((muted ? 0 : volume) * 100) + '%, var(--kura-alpha-10) 100%)',
          }}
        />

        <div className="flex-1" />

        <button
          onClick={toggleFullscreen}
          className="w-7 h-7 flex items-center justify-center rounded-full text-white/50
                     hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
        >
          {isFullscreen ? <ArrowsIn size={14} /> : <ArrowsOut size={14} />}
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex flex-col h-full" style={{ background: '#000' }}>
      {!isFullscreen && (
        <div
          className="flex items-center gap-1 px-3 py-1.5 shrink-0"
          style={{ borderBottom: '1px solid var(--kura-alpha-06)', background: 'var(--kura-menu-bg)' }}
        >
          <button
            onClick={() => setPickerOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-white/60
                       hover:text-white hover:bg-white/[0.07] transition-colors cursor-pointer"
          >
            <FolderOpen size={14} />
            Open
          </button>

          <div className="flex-1" />

          {loading && <span className="text-[11px] text-white/30">Loading…</span>}
          {src && !loading && (
            <span className="text-[11px] text-white/30 truncate max-w-[200px]">{filename}</span>
          )}
        </div>
      )}

      <div
        ref={containerRef}
        className="flex-1 relative overflow-hidden flex flex-col bg-black"
        onClick={src && !loading ? togglePlay : undefined}
        onMouseMove={isFullscreen ? showControls : undefined}
        style={{ cursor: src && !loading ? 'pointer' : 'default' }}
      >
        <div className="flex-1 relative overflow-hidden flex items-center justify-center">
          {loading ? (
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{ opacity: 0.3 }}
              onMouseMove={isFullscreen ? showControls : undefined}
            >
              <div className="w-8 h-8 border-2 border-white/10 border-t-white/40 rounded-full animate-spin" />
            </div>
          ) : src ? (
            <video
              ref={videoRef}
              src={src}
              className="w-full h-full"
              style={{ objectFit: 'contain', display: 'block' }}
              onMouseMove={isFullscreen ? showControls : undefined}
            />
          ) : (
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{ opacity: 0.25 }}
              onMouseMove={isFullscreen ? showControls : undefined}
            >
              <div className="flex flex-col items-center gap-3">
                <FilmStrip size={56} weight="thin" className="text-white" />
                <p className="text-sm text-white/60">Open a file to play</p>
              </div>
            </div>
          )}
        </div>

        {src && (
          isFullscreen ? (
            <div className="absolute bottom-0 left-0 right-0" style={{ zIndex: 10 }}>
              {Controls}
            </div>
          ) : (
            <div className="shrink-0">
              {Controls}
            </div>
          )
        )}
      </div>

      {pickerOpen && (
        <FilePicker
          title="Open Video"
          accept={['videos', 'all']}
          onOpen={handleFilePick}
          onCancel={() => setPickerOpen(false)}
        />
      )}
    </div>
  )
}
