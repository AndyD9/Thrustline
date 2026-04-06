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
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

interface CompanyContextValue {
  company: Company | null;
  loading: boolean;
  /** Force a refetch — call this after creating/updating the company. */
  refetch: () => Promise<void>;
}

const CompanyContext = createContext<CompanyContextValue | null>(null);

/**
 * Charge la compagnie de l'utilisateur connecté (1 par user) et expose un
 * état partagé à toute l'app via un contexte unique.
 *
 * Utilise Supabase Realtime pour mettre à jour le capital (et tout autre
 * champ) en temps réel quand le sim-bridge écrit dans Supabase, sans
 * avoir besoin d'un refetch complet.
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

  // Supabase Realtime: subscribe to changes on the user's company row.
  // Updates capital, active_aircraft_id, etc. in real time without refetch.
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`company:${user.id}`)
      .on(
        "postgres_changes" as "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "companies",
          filter: `user_id=eq.${user.id}`,
        },
        (payload: RealtimePostgresChangesPayload<Company>) => {
          if (payload.new) {
            setCompany(payload.new as Company);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

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
