import { createContext, useCallback, useContext, type ReactNode } from "react";
import { useSimStream, type SimStreamState } from "@/hooks/useSimStream";
import { useCompany } from "@/contexts/CompanyContext";

const SimContext = createContext<SimStreamState | null>(null);

/**
 * Expose le flux SimConnect temps réel (via SignalR) à toute l'app.
 * Un seul hub ouvert par session utilisateur.
 *
 * Quand un landing est détecté, refetch automatiquement les données
 * compagnie pour que le capital affiché soit à jour.
 */
export function SimProvider({ children }: { children: ReactNode }) {
  const { refetch } = useCompany();

  const handleLanding = useCallback(() => {
    // Petit délai pour laisser le sim-bridge finir les writes Supabase
    setTimeout(() => void refetch(), 2_000);
  }, [refetch]);

  const stream = useSimStream(handleLanding);
  return <SimContext.Provider value={stream}>{children}</SimContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSim() {
  const ctx = useContext(SimContext);
  if (!ctx) throw new Error("useSim must be used inside <SimProvider>");
  return ctx;
}
