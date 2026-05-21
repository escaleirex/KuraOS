import { useContext, useEffect, useState, useRef } from 'react'
import { WindowParamsContext } from '@/components/Desktop'
import { codeServerApi } from '@/api/client'
import { RotateCw, Download, AlertCircle } from 'lucide-react'

const CODE_SERVER_PORT = 8443

type SetupState = 'checking' | 'installing' | 'starting' | 'ready' | 'error'

export function CodePage() {
  const params = useContext(WindowParamsContext)
  const folder = params?.folder ?? '/'
  const host   = window.location.hostname
  const [setupState, setSetupState] = useState<SetupState>('checking')
  const [error, setError] = useState<string>('')
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    let cancelled = false
    async function setup() {
      try {
        const res = await codeServerApi.status()
        if (cancelled) return
        if (res.data.installed && res.data.status === 'running') {
          setSetupState('ready')
          return
        }
        if (res.data.installed && res.data.status !== 'running') {
          setSetupState('starting')
        } else {
          setSetupState('installing')
        }
        const setupRes = await codeServerApi.setup()
        if (cancelled) return
        if (setupRes.data.status === 'installed' || setupRes.data.status === 'ready') {
          setSetupState('ready')
        } else {
          setSetupState('error')
          setError('Unexpected response from server')
        }
      } catch (e: any) {
        if (cancelled) return
        setSetupState('error')
        setError(e?.response?.data?.error || e?.message || 'Failed to setup code-server')
      }
    }
    setup()
    return () => { cancelled = true }
  }, [])

  if (setupState === 'checking') {
    return <LoadingState text="Checking code-server..." />
  }
  if (setupState === 'installing') {
    return <LoadingState text="Installing code-server (this may take a minute)..." />
  }
  if (setupState === 'starting') {
    return <LoadingState text="Starting code-server..." />
  }
  if (setupState === 'error') {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-white">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h3 className="text-base font-semibold text-white/80">Failed to start Code Editor</h3>
        <p className="text-sm text-white/40 max-w-sm text-center">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="flex items-center gap-2 px-4 py-2 bg-white/[0.06] border border-white/10 text-sm rounded-lg hover:bg-white/10 transition-all cursor-pointer"
        >
          <RotateCw className="w-4 h-4" />
          Retry
        </button>
      </div>
    )
  }

  const src = `http://${host}:${CODE_SERVER_PORT}/?folder=${encodeURIComponent(folder)}`

  return (
    <iframe
      ref={iframeRef}
      src={src}
      className="w-full h-full border-0"
      allow="clipboard-read; clipboard-write"
      sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals allow-downloads"
      title="Code Editor"
    />
  )
}

function LoadingState({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3">
      <div className="w-8 h-8 border-2 border-[#3584e4]/20 border-t-[#3584e4] rounded-full animate-spin" />
      <p className="text-sm text-white/40">{text}</p>
    </div>
  )
}
