import { useEffect, useState, useCallback } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { SimProvider } from './contexts/SimContext'
import { SyncProvider } from './contexts/SyncContext'
import { Layout } from './components/Layout'
import { Dashboard } from './pages/Dashboard'
import { Flights } from './pages/Flights'
import { Finances } from './pages/Finances'
import { Fleet } from './pages/Fleet'
import { Routes as RoutesPage } from './pages/Routes'
import { Settings } from './pages/Settings'
import { DispatchPage } from './pages/Dispatch'
import { CrewPage } from './pages/Crew'
import { OnboardingPage } from './pages/Onboarding'
import Auth from './pages/Auth'
import { api } from './lib/api'

function AppRoutes() {
  const { user, loading: authLoading } = useAuth()
  const [onboarded, setOnboarded] = useState<boolean | null>(null) // null = loading

  useEffect(() => {
    if (!user) { setOnboarded(null); return }
    api.get<{ onboarded?: boolean }>('/company')
      .then((c) => setOnboarded(c?.onboarded === true))
      .catch(() => setOnboarded(false))
  }, [user])

  const handleOnboardingComplete = useCallback(() => {
    setOnboarded(true)
  }, [])

  // Auth loading
  if (authLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <p className="text-zinc-500 text-sm">Loading...</p>
      </div>
    )
  }

  // Not authenticated → auth page
  if (!user) {
    return (
      <Routes>
        <Route path="*" element={<Auth />} />
      </Routes>
    )
  }

  // Authenticated but checking onboarding
  if (onboarded === null) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <p className="text-zinc-500 text-sm">Loading...</p>
      </div>
    )
  }

  return (
    <Routes>
      {/* Onboarding — outside Layout (no sidebar) */}
      <Route path="/onboarding" element={
        onboarded ? <Navigate to="/" replace /> : <OnboardingPage onComplete={handleOnboardingComplete} />
      } />

      {/* Main app — guarded behind onboarding */}
      {onboarded ? (
        <Route element={<Layout />}>
          <Route path="/"         element={<Dashboard />} />
          <Route path="/flights"  element={<Flights />}   />
          <Route path="/finances" element={<Finances />}  />
          <Route path="/fleet"    element={<Fleet />}     />
          <Route path="/crew"     element={<CrewPage />}  />
          <Route path="/routes"   element={<RoutesPage />}   />
          <Route path="/dispatch" element={<DispatchPage />} />
          <Route path="/settings" element={<Settings />}     />
          <Route path="*"         element={<Navigate to="/" replace />} />
        </Route>
      ) : (
        <Route path="*" element={<Navigate to="/onboarding" replace />} />
      )}
    </Routes>
  )
}

export function App() {
  return (
    <AuthProvider>
      <SimProvider>
        <SyncProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </SyncProvider>
      </SimProvider>
    </AuthProvider>
  )
}
