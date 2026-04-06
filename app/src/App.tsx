import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { Layout } from "@/components/Layout";
import { Plane } from "lucide-react";
import Auth from "@/pages/Auth";
import Onboarding from "@/pages/Onboarding";
import Dashboard from "@/pages/Dashboard";
import Flights from "@/pages/Flights";
import Fleet from "@/pages/Fleet";
import DispatchPage from "@/pages/Dispatch";
import Crew from "@/pages/Crew";
import Finances from "@/pages/Finances";
import Settings from "@/pages/Settings";
import LiveFlight from "@/pages/LiveFlight";
import CompanyPage from "@/pages/Company";
import RoutesPage from "@/pages/Routes";
import Achievements from "@/pages/Achievements";
import EFB from "@/pages/EFB";

function LoadingScreen({ label }: { label: string }) {
  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center gap-4">
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
export default function App() {
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
      <Routes>
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="*" element={<Navigate to="/onboarding" replace />} />
      </Routes>
    );
  }

  return (
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
        <Route path="/achievements" element={<Achievements />} />
        <Route path="/efb" element={<EFB />} />
        <Route path="/live-flight" element={<LiveFlight />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
