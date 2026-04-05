import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import type { Company } from "@/lib/database.types";

interface CompanyContextValue {
  company: Company | null;
  loading: boolean;
  /** Force a refetch — call this after creating/updating the company. */
  refetch: () => Promise<void>;
}

const CompanyContext = createContext<CompanyContextValue | null>(null);

/**
 * Charge la compagnie de l'utilisateur connecté (1 par user) et expose un
 * état partagé à toute l'app via un contexte unique. Indispensable pour que
 * Onboarding puisse déclencher un refetch qui mettra à jour App.tsx (qui
 * décide s'il faut afficher /onboarding ou le Layout complet).
 */
export function CompanyProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchCompany = useCallback(async () => {
    if (!user) {
      setCompany(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("companies")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) {
      // eslint-disable-next-line no-console
      console.error("[CompanyContext] fetch failed:", error);
      setCompany(null);
    } else {
      setCompany(data as Company | null);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void fetchCompany();
  }, [fetchCompany]);

  return (
    <CompanyContext.Provider value={{ company, loading, refetch: fetchCompany }}>
      {children}
    </CompanyContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCompany() {
  const ctx = useContext(CompanyContext);
  if (!ctx) throw new Error("useCompany must be used inside <CompanyProvider>");
  return ctx;
}
