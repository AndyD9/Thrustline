import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { Layout } from "@/components/Layout";
import Auth from "@/pages/Auth";
import Onboarding from "@/pages/Onboarding";
import Dashboard from "@/pages/Dashboard";
import Flights from "@/pages/Flights";
import Fleet from "@/pages/Fleet";
import DispatchPage from "@/pages/Dispatch";
import Crew from "@/pages/Crew";
import Finances from "@/pages/Finances";
import Settings from "@/pages/Settings";

function LoadingScreen({ label }: { label: string }) {
  return (
    <div className="flex h-screen w-screen items-center justify-center text-sm text-slate-400">
      {label}
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
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
