import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AppearanceProvider } from '@/contexts/AppearanceContext'
import { LoginPage } from '@/pages/LoginPage'
import { Desktop } from '@/components/Desktop'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
})

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('kura_token')
  return token ? <>{children}</> : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppearanceProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/*"
              element={
                <PrivateRoute>
                  <Desktop />
                </PrivateRoute>
              }
            />
          </Routes>
        </BrowserRouter>
      </AppearanceProvider>
    </QueryClientProvider>
  )
}
