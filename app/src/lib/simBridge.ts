/**
 * Client HTTP minimaliste pour dialoguer avec le sim-bridge .NET local.
 *
 * Le sim-bridge écoute toujours sur 127.0.0.1:5055 en dev et en prod (sidecar
 * lancé par Tauri). L'URL est override-able via VITE_SIM_BRIDGE_URL pour les
 * scénarios de test ou d'exécution découplée.
 */

const BASE_URL = import.meta.env.VITE_SIM_BRIDGE_URL ?? "http://127.0.0.1:5055";

export interface HealthResponse {
  status: "ok";
  version: string;
  simConnect: "mock" | "native";
  supabaseConfigured: boolean;
  hasSession: boolean;
  time: string;
}

export async function getHealth(signal?: AbortSignal): Promise<HealthResponse> {
  const res = await fetch(`${BASE_URL}/health`, { signal });
  if (!res.ok) throw new Error(`sim-bridge /health → ${res.status}`);
  return res.json();
}

export async function setSession(userId: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });
  if (!res.ok) throw new Error(`sim-bridge /session POST → ${res.status}`);
}

export async function clearSession(): Promise<void> {
  const res = await fetch(`${BASE_URL}/session`, { method: "DELETE" });
  if (!res.ok && res.status !== 204) {
    throw new Error(`sim-bridge /session DELETE → ${res.status}`);
  }
}

/** Base URL du SignalR hub /hubs/sim — utilisé par useSimStream. */
export const SIM_HUB_URL = `${BASE_URL}/hubs/sim`;
