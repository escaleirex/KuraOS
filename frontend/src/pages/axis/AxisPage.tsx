import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Send, Bot, User } from 'lucide-react'
import { axisApi } from '@/api/client'

type Message = { role: 'user' | 'assistant'; content: string }

export function AxisPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: "Hi! I'm Axis, your KuraOS AI assistant. I can help you manage your NAS, check disk health, configure shares, and more. What would you like to do?",
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async () => {
    const content = input.trim()
    if (!content || loading) return

    const userMsg: Message = { role: 'user', content }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const { data } = await axisApi.chat([...messages, userMsg])
      setMessages(prev => [...prev, { role: 'assistant', content: data.content }])
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please check the Axis engine is running.',
      }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-4">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Bot className="w-6 h-6 text-primary" /> Axis AI
        </h2>
        <p className="text-muted-foreground text-sm mt-1">Your intelligent NAS assistant</p>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center
              ${msg.role === 'assistant' ? 'bg-primary/10' : 'bg-secondary'}`}>
              {msg.role === 'assistant'
                ? <Bot className="w-4 h-4 text-primary" />
                : <User className="w-4 h-4" />}
            </div>
            <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm
              ${msg.role === 'assistant'
                ? 'bg-card border rounded-tl-sm'
                : 'bg-primary text-primary-foreground rounded-tr-sm'}`}>
              <p className="whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Bot className="w-4 h-4 text-primary" />
            </div>
            <div className="bg-card border rounded-2xl rounded-tl-sm px-4 py-3">
              <span className="text-muted-foreground text-sm">Thinking…</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t px-6 py-4">
        <div className="flex gap-3">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
            placeholder="Ask Axis anything about your NAS…"
            className="flex-1 px-4 py-2 border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-ring"
            disabled={loading}
          />
          <Button onClick={send} disabled={loading || !input.trim()} size="icon" className="rounded-xl">
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
