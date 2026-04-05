import { createContext, useContext, type ReactNode } from "react";
import { useSimStream, type SimStreamState } from "@/hooks/useSimStream";

const SimContext = createContext<SimStreamState | null>(null);

/**
 * Expose le flux SimConnect temps réel (via SignalR) à toute l'app.
 * Un seul hub ouvert par session utilisateur.
 */
export function SimProvider({ children }: { children: ReactNode }) {
  const stream = useSimStream();
  return <SimContext.Provider value={stream}>{children}</SimContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSim() {
  const ctx = useContext(SimContext);
  if (!ctx) throw new Error("useSim must be used inside <SimProvider>");
  return ctx;
}
