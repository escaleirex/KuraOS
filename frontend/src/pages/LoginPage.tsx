import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { authApi } from '@/api/client'

export function LoginPage() {
  const nav = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [totp, setTotp] = useState('')
  const [needTotp, setNeedTotp] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await authApi.login(username, password)
      if (data.totp_required) {
        setNeedTotp(true)
      } else {
        localStorage.setItem('kura_token', data.token)
        nav('/dashboard')
      }
    } catch {
      setError('Invalid credentials')
    } finally {
      setLoading(false)
    }
  }

  const handleTotp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await authApi.verifyTotp(username, totp)
      localStorage.setItem('kura_token', data.token)
      nav('/dashboard')
    } catch {
      setError('Invalid TOTP code')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-primary">KuraOS</h1>
          <p className="text-muted-foreground mt-1">Sign in to your NAS</p>
        </div>

        <div className="bg-card border rounded-xl p-8 shadow-sm">
          {!needTotp ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md text-sm bg-input focus:outline-none focus:ring-2 focus:ring-ring"
                  autoFocus
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md text-sm bg-input focus:outline-none focus:ring-2 focus:ring-ring"
                  required
                />
              </div>
              {error && <p className="text-destructive text-sm">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Signing in…' : 'Sign in'}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleTotp} className="space-y-4">
              <div className="text-center text-sm text-muted-foreground">
                Enter your 6-digit authenticator code
              </div>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={totp}
                onChange={(e) => setTotp(e.target.value)}
                className="w-full px-3 py-2 border rounded-md text-sm text-center tracking-widest bg-input focus:outline-none focus:ring-2 focus:ring-ring"
                autoFocus
                required
              />
              {error && <p className="text-destructive text-sm text-center">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Verifying…' : 'Verify'}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
