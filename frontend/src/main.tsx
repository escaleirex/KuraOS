import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

document.documentElement.classList.add('dark')

// Auto-hide scrollbars: show on scroll/hover, hide after 1.5s idle
let scrollTimer: ReturnType<typeof setTimeout> | null = null
document.addEventListener('scroll', () => {
  document.documentElement.classList.add('scrolling')
  if (scrollTimer) clearTimeout(scrollTimer)
  scrollTimer = setTimeout(() => {
    document.documentElement.classList.remove('scrolling')
  }, 1500)
}, { capture: true, passive: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
