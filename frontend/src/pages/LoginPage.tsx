import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { authApi } from '@/api/client'
import {
  HardDrives,
  User,
  Lock,
  ShieldCheck,
  ArrowRight,
  CircleNotch,
} from '@phosphor-icons/react'

const orbs = [
  {
    size: 560,
    style: { top: '-12%', left: '-10%' },
    color: 'oklch(0.457 0.24 277.023 / 0.45)',
    duration: 18,
  },
  {
    size: 420,
    style: { bottom: '-8%', right: '-8%' },
    color: 'oklch(0.511 0.262 276.966 / 0.35)',
    duration: 22,
  },
  {
    size: 300,
    style: { top: '40%', right: '20%' },
    color: 'oklch(0.585 0.233 277.117 / 0.2)',
    duration: 15,
  },
]

const stagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.07 } },
}

const item = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] } },
}

const shake = {
  x: [0, -8, 8, -6, 6, -3, 3, 0],
  transition: { duration: 0.45, ease: 'easeInOut' },
}

export function LoginPage() {
  const nav = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [totpDigits, setTotpDigits] = useState(['', '', '', '', '', ''])
  const [needTotp, setNeedTotp] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [shaking, setShaking] = useState(false)
  const totpRefs = useRef<(HTMLInputElement | null)[]>([])

  const triggerShake = () => {
    setShaking(true)
    setTimeout(() => setShaking(false), 500)
  }

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
      triggerShake()
    } finally {
      setLoading(false)
    }
  }

  const handleTotp = async (e: React.FormEvent) => {
    e.preventDefault()
    const code = totpDigits.join('')
    if (code.length < 6) return
    setError('')
    setLoading(true)
    try {
      const { data } = await authApi.verifyTotp(username, code)
      localStorage.setItem('kura_token', data.token)
      nav('/dashboard')
    } catch {
      setError('Invalid code')
      setTotpDigits(['', '', '', '', '', ''])
      totpRefs.current[0]?.focus()
      triggerShake()
    } finally {
      setLoading(false)
    }
  }

  const handleDigitInput = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return
    const next = [...totpDigits]
    next[index] = value.slice(-1)
    setTotpDigits(next)
    if (value && index < 5) totpRefs.current[index + 1]?.focus()
  }

  const handleDigitKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !totpDigits[index] && index > 0) {
      totpRefs.current[index - 1]?.focus()
    }
  }

  const handleDigitPaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (!text) return
    e.preventDefault()
    const next = [...totpDigits]
    text.split('').forEach((ch, i) => { next[i] = ch })
    setTotpDigits(next)
    totpRefs.current[Math.min(text.length, 5)]?.focus()
  }

  return (
    <div className="min-h-screen flex items-center justify-center overflow-hidden relative bg-[oklch(0.09_0.005_285)]">

      {/* Floating gradient orbs */}
      {orbs.map((orb, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full pointer-events-none"
          style={{
            ...orb.style,
            width: orb.size,
            height: orb.size,
            background: `radial-gradient(circle, ${orb.color} 0%, transparent 70%)`,
            filter: 'blur(1px)',
          }}
          animate={{
            scale: [1, 1.12, 0.95, 1.06, 1],
            x: [0, 24, -16, 18, 0],
            y: [0, -20, 28, -12, 0],
          }}
          transition={{
            duration: orb.duration,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}


      {/* Card */}
      <motion.div
        animate={shaking ? shake : {}}
        initial={{ opacity: 0, y: 28, scale: 0.95 }}
        whileInView={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="relative w-full max-w-sm mx-4"
        style={{ animation: 'none' }}
      >
        {/* Glow behind card */}
        <div
          className="absolute -inset-px rounded-2xl pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse 80% 50% at 50% 0%, oklch(0.457 0.24 277.023 / 0.3), transparent)',
            filter: 'blur(12px)',
          }}
        />

        <div
          className="relative rounded-2xl overflow-hidden"
          style={{
            background: 'oklch(0.14 0.008 285 / 0.85)',
            backdropFilter: 'blur(24px) saturate(1.4)',
            border: '1px solid oklch(1 0 0 / 0.08)',
            boxShadow:
              '0 0 0 1px oklch(0 0 0 / 0.4) inset, 0 32px 64px oklch(0 0 0 / 0.5)',
          }}
        >
          <AnimatePresence mode="wait">
            {!needTotp ? (
              <motion.div
                key="login"
                variants={stagger}
                initial="hidden"
                animate="show"
                exit={{ opacity: 0, x: -20, transition: { duration: 0.2 } }}
                className="p-8 space-y-6"
              >
                {/* Logo */}
                <motion.div variants={item} className="flex flex-col items-center gap-3">
                  <div
                    className="size-14 rounded-xl flex items-center justify-center"
                    style={{
                      background:
                        'linear-gradient(135deg, oklch(0.457 0.24 277.023), oklch(0.511 0.262 276.966))',
                      boxShadow: '0 8px 24px oklch(0.457 0.24 277.023 / 0.4)',
                    }}
                  >
                    <HardDrives size={28} weight="duotone" className="text-white" />
                  </div>
                  <div className="text-center">
                    <h1 className="text-xl font-bold tracking-tight text-white">KuraOS</h1>
                    <p className="text-xs text-[oklch(0.7_0.015_286)] mt-0.5">
                      Sign in to your server
                    </p>
                  </div>
                </motion.div>

                {/* Form */}
                <form onSubmit={handleLogin} className="space-y-3">
                  <motion.div variants={item}>
                    <InputField
                      icon={<User size={15} weight="bold" />}
                      type="text"
                      placeholder="Username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      autoFocus
                      required
                    />
                  </motion.div>

                  <motion.div variants={item}>
                    <InputField
                      icon={<Lock size={15} weight="bold" />}
                      type="password"
                      placeholder="Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </motion.div>

                  <AnimatePresence>
                    {error && (
                      <motion.p
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="text-xs text-[oklch(0.704_0.191_22.216)] text-center"
                      >
                        {error}
                      </motion.p>
                    )}
                  </AnimatePresence>

                  <motion.div variants={item}>
                    <Button
                      type="submit"
                      disabled={loading}
                      className="w-full h-10 gap-2 mt-1"
                      style={{
                        background: loading
                          ? undefined
                          : 'linear-gradient(135deg, oklch(0.457 0.24 277.023), oklch(0.511 0.262 276.966))',
                        boxShadow: loading ? undefined : '0 4px 16px oklch(0.457 0.24 277.023 / 0.35)',
                      }}
                    >
                      {loading ? (
                        <CircleNotch size={16} className="animate-spin" />
                      ) : (
                        <>
                          Sign in
                          <ArrowRight size={15} weight="bold" />
                        </>
                      )}
                    </Button>
                  </motion.div>
                </form>
              </motion.div>
            ) : (
              <motion.div
                key="totp"
                variants={stagger}
                initial="hidden"
                animate="show"
                exit={{ opacity: 0, x: 20, transition: { duration: 0.2 } }}
                className="p-8 space-y-6"
              >
                {/* Header */}
                <motion.div variants={item} className="flex flex-col items-center gap-3">
                  <div
                    className="size-14 rounded-xl flex items-center justify-center"
                    style={{
                      background:
                        'linear-gradient(135deg, oklch(0.511 0.262 276.966), oklch(0.585 0.233 277.117))',
                      boxShadow: '0 8px 24px oklch(0.511 0.262 276.966 / 0.4)',
                    }}
                  >
                    <ShieldCheck size={28} weight="duotone" className="text-white" />
                  </div>
                  <div className="text-center">
                    <h2 className="text-lg font-bold text-white">Two-Factor Auth</h2>
                    <p className="text-xs text-[oklch(0.7_0.015_286)] mt-0.5">
                      Enter the 6-digit code from your authenticator
                    </p>
                  </div>
                </motion.div>

                {/* OTP boxes */}
                <form onSubmit={handleTotp} className="space-y-4">
                  <motion.div variants={item} className="flex gap-2 justify-center">
                    {totpDigits.map((digit, i) => (
                      <input
                        key={i}
                        ref={(el) => { totpRefs.current[i] = el }}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleDigitInput(i, e.target.value)}
                        onKeyDown={(e) => handleDigitKeyDown(i, e)}
                        onPaste={i === 0 ? handleDigitPaste : undefined}
                        autoFocus={i === 0}
                        className="w-11 h-13 text-center text-lg font-semibold rounded-lg transition-all outline-none caret-transparent"
                        style={{
                          background: digit
                            ? 'oklch(0.457 0.24 277.023 / 0.2)'
                            : 'oklch(1 0 0 / 0.05)',
                          border: digit
                            ? '1px solid oklch(0.457 0.24 277.023 / 0.6)'
                            : '1px solid oklch(1 0 0 / 0.1)',
                          color: 'oklch(0.985 0 0)',
                          boxShadow: digit
                            ? '0 0 12px oklch(0.457 0.24 277.023 / 0.2)'
                            : 'none',
                        }}
                      />
                    ))}
                  </motion.div>

                  <AnimatePresence>
                    {error && (
                      <motion.p
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="text-xs text-[oklch(0.704_0.191_22.216)] text-center"
                      >
                        {error}
                      </motion.p>
                    )}
                  </AnimatePresence>

                  <motion.div variants={item}>
                    <Button
                      type="submit"
                      disabled={loading || totpDigits.join('').length < 6}
                      className="w-full h-10 gap-2"
                      style={{
                        background:
                          !loading && totpDigits.join('').length === 6
                            ? 'linear-gradient(135deg, oklch(0.511 0.262 276.966), oklch(0.585 0.233 277.117))'
                            : undefined,
                        boxShadow:
                          !loading && totpDigits.join('').length === 6
                            ? '0 4px 16px oklch(0.511 0.262 276.966 / 0.35)'
                            : undefined,
                      }}
                    >
                      {loading ? (
                        <CircleNotch size={16} className="animate-spin" />
                      ) : (
                        <>
                          Verify
                          <ArrowRight size={15} weight="bold" />
                        </>
                      )}
                    </Button>
                  </motion.div>

                  <motion.div variants={item} className="text-center">
                    <button
                      type="button"
                      onClick={() => { setNeedTotp(false); setError('') }}
                      className="text-xs text-[oklch(0.6_0.015_286)] hover:text-[oklch(0.8_0.015_286)] transition-colors cursor-pointer"
                    >
                      ← Back to login
                    </button>
                  </motion.div>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Version tag */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[10px] text-[oklch(0.4_0.01_286)]">
        KuraOS v0.1.0
      </div>
    </div>
  )
}

function InputField({
  icon,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { icon: React.ReactNode }) {
  const [focused, setFocused] = useState(false)

  return (
    <div
      className="flex items-center gap-2.5 px-3 h-10 rounded-lg transition-all duration-200"
      style={{
        background: focused ? 'oklch(1 0 0 / 0.07)' : 'oklch(1 0 0 / 0.04)',
        border: focused
          ? '1px solid oklch(0.457 0.24 277.023 / 0.6)'
          : '1px solid oklch(1 0 0 / 0.08)',
        boxShadow: focused ? '0 0 0 3px oklch(0.457 0.24 277.023 / 0.12)' : 'none',
      }}
    >
      <span
        className="shrink-0 transition-colors duration-200"
        style={{ color: focused ? 'oklch(0.585 0.233 277.117)' : 'oklch(0.5 0.015 286)' }}
      >
        {icon}
      </span>
      <input
        {...props}
        onFocus={(e) => { setFocused(true); props.onFocus?.(e) }}
        onBlur={(e) => { setFocused(false); props.onBlur?.(e) }}
        className="flex-1 bg-transparent text-sm outline-none text-white placeholder:text-[oklch(0.45_0.01_286)]"
      />
    </div>
  )
}
