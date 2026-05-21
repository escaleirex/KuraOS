import { useState, useRef, useCallback, useContext, useEffect } from 'react'
import { DownloadSimple, FilePlus, TextT, FolderOpen } from '@phosphor-icons/react'
import { WindowParamsContext } from '@/components/Desktop'
import { FilePicker } from '@/components/FilePicker'
import { api } from '@/api/client'

export function NotePadPage() {
  const params = useContext(WindowParamsContext)
  const [text, setText]         = useState('')
  const [filename, setFilename] = useState('untitled.txt')
  const [loading, setLoading]   = useState(false)
  const [fontSize, setFontSize] = useState(14)
  const [pickerOpen, setPickerOpen] = useState(false)

  const loadFile = useCallback((path: string) => {
    setFilename(path.split('/').pop() ?? path)
    setLoading(true)
    api.get(`/files/download?path=${encodeURIComponent(path)}`, { responseType: 'text' })
      .then(res => { setText(res.data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    const filePath = params?.filePath
    if (filePath) loadFile(filePath)
  }, [params?.filePath, loadFile])

  const handleFilePick = (path: string) => {
    setPickerOpen(false)
    loadFile(path)
  }

  const wordCount = text.trim() === '' ? 0 : text.trim().split(/\s+/).length
  const lineCount = text === '' ? 1 : text.split('\n').length

  const saveFile = useCallback(() => {
    const blob = new Blob([text], { type: 'text/plain' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }, [text, filename])

  const newFile = useCallback(() => {
    setText('')
    setFilename('untitled.txt')
  }, [])

  return (
    <div className="flex flex-col h-full" style={{ background: 'rgba(10,12,20,0.95)' }}>
      {/* toolbar */}
      <div
        className="flex items-center gap-1 px-3 py-1.5 shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}
      >
        <button
          onClick={newFile}
          title="New"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-white/60
                     hover:text-white hover:bg-white/[0.07] transition-colors cursor-pointer"
        >
          <FilePlus size={14} />
          New
        </button>

        <button
          onClick={() => setPickerOpen(true)}
          title="Open file"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-white/60
                     hover:text-white hover:bg-white/[0.07] transition-colors cursor-pointer"
        >
          <FolderOpen size={14} />
          Open
        </button>

        <button
          onClick={saveFile}
          title="Save"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-white/60
                     hover:text-white hover:bg-white/[0.07] transition-colors cursor-pointer"
        >
          <DownloadSimple size={14} />
          Save
        </button>

        <div className="w-px h-4 mx-1" style={{ background: 'rgba(255,255,255,0.08)' }} />

        <div className="flex items-center gap-1.5">
          <TextT size={13} className="text-white/40" />
          <select
            value={fontSize}
            onChange={e => setFontSize(Number(e.target.value))}
            className="bg-transparent text-xs text-white/60 cursor-pointer outline-none"
            style={{ appearance: 'none' }}
          >
            {[11, 12, 13, 14, 16, 18, 20, 24].map(s => (
              <option key={s} value={s} style={{ background: '#0e1020' }}>{s}px</option>
            ))}
          </select>
        </div>

        <div className="flex-1" />

        <span className="text-[11px] text-white/25 truncate max-w-[140px]">{filename}</span>
      </div>

      {/* editor */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <span className="text-white/30 text-sm">Loading…</span>
        </div>
      ) : (
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          spellCheck={false}
          className="flex-1 w-full resize-none outline-none bg-transparent text-white/85 p-4
                     font-mono placeholder:text-white/20"
          style={{ fontSize: `${fontSize}px`, lineHeight: 1.6 }}
          placeholder="Start typing…"
        />
      )}

      {/* status bar */}
      <div
        className="flex items-center gap-4 px-4 py-1 shrink-0"
        style={{ borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.01)' }}
      >
        <span className="text-[11px] text-white/25">Lines: {lineCount}</span>
        <span className="text-[11px] text-white/25">Words: {wordCount}</span>
        <span className="text-[11px] text-white/25">Chars: {text.length}</span>
      </div>

      {pickerOpen && (
        <FilePicker
          title="Open File"
          accept={['text', 'all']}
          onOpen={handleFilePick}
          onCancel={() => setPickerOpen(false)}
        />
      )}
    </div>
  )
}
