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

/** Trigger a mock flight with dispatch parameters. No-op if sim-bridge is in native mode. */
export async function startMockFlight(params: {
  originIcao: string;
  destIcao: string;
  icaoType: string;
  originLat: number;
  originLon: number;
  originElevFt: number;
  destLat: number;
  destLon: number;
  destElevFt: number;
  cruiseAltFt: number;
  cruiseSpeedKts: number;
  fuelGal: number;
  heading: number;
  durationSeconds: number;
}): Promise<void> {
  try {
    await fetch(`${BASE_URL}/mock/start-flight`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
  } catch {
    // Silently ignore — endpoint doesn't exist in native mode
  }
}

/** Base URL du SignalR hub /hubs/sim — utilisé par useSimStream. */
export const SIM_HUB_URL = `${BASE_URL}/hubs/sim`;

/**
 * Attends que le sim-bridge réponde à /health (retry avec backoff).
 * Utile au démarrage quand le sidecar met quelques secondes à se lancer.
 * Retourne true si le bridge est accessible, false si timeout.
 */
export async function waitForBridge(
  maxAttempts = 15,
  intervalMs = 2000,
  signal?: AbortSignal,
): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      await getHealth(signal);
      return true;
    } catch {
      if (signal?.aborted) return false;
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  }
  return false;
}
