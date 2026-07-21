/**
 * Client HTTP minimaliste pour dialoguer avec le sim-bridge .NET local.
 *
 * Le sim-bridge écoute toujours sur 127.0.0.1:5055 en dev et en prod (sidecar
 * lancé par Tauri). L'URL est override-able via VITE_SIM_BRIDGE_URL pour les
 * scénarios de test ou d'exécution découplée.
 */

import { invoke } from "@tauri-apps/api/core";

const BASE_URL = import.meta.env.VITE_SIM_BRIDGE_URL ?? "http://127.0.0.1:5055";
let instanceTokenPromise: Promise<string> | null = null;

export function getBridgeInstanceToken(): Promise<string> {
  instanceTokenPromise ??= invoke<string>("get_bridge_instance_token")
    .catch(() => import.meta.env.DEV ? "dev-only-bridge-token" : "");
  return instanceTokenPromise;
}

export async function bridgeFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const token = await getBridgeInstanceToken();
  const headers = new Headers(init.headers);
  headers.set("X-Thrustline-Bridge-Token", token);
  return fetch(input, { ...init, headers });
}

/** Tracks whether the sim-bridge is reachable to avoid spamming failed requests. */
let bridgeReachable = false;
let probeInFlight = false;

async function probeBridge(): Promise<boolean> {
  if (probeInFlight) return bridgeReachable;
  probeInFlight = true;
  try {
    const res = await bridgeFetch(`${BASE_URL}/health`, { signal: AbortSignal.timeout(2000) });
    bridgeReachable = res.ok;
  } catch {
    bridgeReachable = false;
  } finally {
    probeInFlight = false;
  }
  return bridgeReachable;
}

export interface HealthResponse {
  status: "ok";
  version: string;
  simConnect: "idle" | "native";
  supabaseConfigured: boolean;
  hasSession: boolean;
  time: string;
}

export async function getHealth(signal?: AbortSignal): Promise<HealthResponse> {
  const res = await bridgeFetch(`${BASE_URL}/health`, { signal });
  if (!res.ok) throw new Error(`sim-bridge /health → ${res.status}`);
  bridgeReachable = true;
  return res.json();
}

export async function setSession(accessToken: string, supabaseUrl: string, anonKey: string): Promise<void> {
  if (!bridgeReachable && !(await probeBridge())) return;
  const res = await bridgeFetch(`${BASE_URL}/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accessToken, supabaseUrl, anonKey }),
  });
  if (!res.ok) throw new Error(`sim-bridge /session POST → ${res.status}`);
}

export async function clearSession(): Promise<void> {
  if (!bridgeReachable && !(await probeBridge())) return;
  const res = await bridgeFetch(`${BASE_URL}/session`, { method: "DELETE" });
  if (!res.ok && res.status !== 204) {
    throw new Error(`sim-bridge /session DELETE → ${res.status}`);
  }
}

export async function setActiveFlightContext(context: {
  dispatchId: string;
  companyId: string;
  economyPassengers: number;
  businessPassengers: number;
}): Promise<void> {
  const res = await bridgeFetch(`${BASE_URL}/flight/context`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(context),
  });
  if (!res.ok && res.status !== 204) throw new Error(`sim-bridge /flight/context → ${res.status}`);
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
