import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { Layout } from "@/components/Layout";
import { Plane } from "lucide-react";
import Auth from "@/pages/Auth";
import { TitleBar } from "@/components/TitleBar";

const Onboarding = lazy(() => import("@/pages/Onboarding"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Flights = lazy(() => import("@/pages/Flights"));
const Fleet = lazy(() => import("@/pages/Fleet"));
const DispatchPage = lazy(() => import("@/pages/Dispatch"));
const Crew = lazy(() => import("@/pages/Crew"));
const Finances = lazy(() => import("@/pages/Finances"));
const Settings = lazy(() => import("@/pages/Settings"));
const LiveFlight = lazy(() => import("@/pages/LiveFlight"));
const CompanyPage = lazy(() => import("@/pages/Company"));
const RoutesPage = lazy(() => import("@/pages/Routes"));
const Achievements = lazy(() => import("@/pages/Achievements"));
const EFB = lazy(() => import("@/pages/EFB"));
const SchedulePage = lazy(() => import("@/pages/Schedule"));

function LoadingScreen({ label }: { label: string }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-500/15 glow-brand-sm">
        <Plane className="h-6 w-6 text-brand-300 animate-pulse" />
      </div>
      <span className="text-sm text-slate-400">{label}</span>
    </div>
  );
}

/**
 * Top-level gate flow:
 *   1. auth loading        → loading screen
 *   2. no user             → /auth
 *   3. company loading     → loading screen
 *   4. no company          → /onboarding (no sidebar)
 *   5. company exists      → /dashboard, /flights, …  (Layout with sidebar)
 */
function AppContent() {
  const { user, loading: authLoading } = useAuth();
  const { company, loading: companyLoading } = useCompany();

  if (authLoading) return <LoadingScreen label="Loading session…" />;

  if (!user) {
    return (
      <Routes>
        <Route path="/auth" element={<Auth />} />
        <Route path="*" element={<Navigate to="/auth" replace />} />
      </Routes>
    );
  }

  if (companyLoading) return <LoadingScreen label="Loading airline…" />;

  if (!company) {
    return (
      <Suspense fallback={<LoadingScreen label="Loading onboarding..." />}>
        <Routes>
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="*" element={<Navigate to="/onboarding" replace />} />
        </Routes>
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<LoadingScreen label="Loading page..." />}>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/flights" element={<Flights />} />
          <Route path="/dispatch" element={<DispatchPage />} />
          <Route path="/fleet" element={<Fleet />} />
          <Route path="/crew" element={<Crew />} />
          <Route path="/finances" element={<Finances />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/company" element={<CompanyPage />} />
          <Route path="/routes" element={<RoutesPage />} />
          <Route path="/schedule" element={<SchedulePage />} />
          <Route path="/achievements" element={<Achievements />} />
          <Route path="/efb" element={<EFB />} />
          <Route path="/live-flight" element={<LiveFlight />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-surface-0">
      <TitleBar />
      <div className="min-h-0 flex-1">
        <AppContent />
      </div>
    </div>
  );
}
