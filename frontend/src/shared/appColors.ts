import type { AppID } from '@/stores/windowStore'

export interface AppColors {
  bg: string
  gradient: string
  glow: string
}

export const APP_COLORS: Record<AppID, AppColors> = {
  storage:   { bg: '#6366f1', gradient: 'linear-gradient(135deg,#6366f1,#4f46e5)', glow: '#6366f1' },
  axis:      { bg: '#22c55e', gradient: 'linear-gradient(135deg,#22c55e,#16a34a)', glow: '#22c55e' },
  docker:    { bg: '#0ea5e9', gradient: 'linear-gradient(135deg,#0ea5e9,#0284c7)', glow: '#0ea5e9' },
  network:   { bg: '#f97316', gradient: 'linear-gradient(135deg,#f97316,#ea580c)', glow: '#f97316' },
  hardware:  { bg: '#ef4444', gradient: 'linear-gradient(135deg,#ef4444,#dc2626)', glow: '#ef4444' },
  settings:  { bg: '#71717a', gradient: 'linear-gradient(135deg,#71717a,#52525b)', glow: '#71717a' },
  files:     { bg: '#3b82f6', gradient: 'linear-gradient(135deg,#3b82f6,#2563eb)', glow: '#3b82f6' },
  appstore:  { bg: '#ca8a04', gradient: 'linear-gradient(135deg,#ca8a04,#a16207)', glow: '#ca8a04' },
  code:      { bg: '#3584e4', gradient: 'linear-gradient(135deg,#3584e4,#1c71d8)', glow: '#3584e4' },
  notepad:   { bg: '#a78bfa', gradient: 'linear-gradient(135deg,#a78bfa,#7c3aed)', glow: '#a78bfa' },
  imageviewer: { bg: '#f472b6', gradient: 'linear-gradient(135deg,#f472b6,#db2777)', glow: '#f472b6' },
  videoplayer: { bg: '#34d399', gradient: 'linear-gradient(135deg,#34d399,#059669)', glow: '#34d399' },
}
