import { useEffect, useRef, useState } from "react";
import {
  HubConnection,
  HubConnectionBuilder,
  HubConnectionState,
  LogLevel,
} from "@microsoft/signalr";
import { SIM_HUB_URL } from "@/lib/simBridge";

export interface SimData {
  timestamp: string;
  latitude: number;
  longitude: number;
  altitudeFt: number;
  groundSpeedKts: number;
  indicatedAirspeedKts: number;
  headingDeg: number;
  verticalSpeedFpm: number;
  fuelTotalGal: number;
  onGround: boolean;
  aircraftTitle: string | null;
}

export interface LandingEventPayload {
  takeoff: SimData;
  touchdown: SimData;
  distanceNm: number;
  fuelUsedGal: number;
  durationMin: number;
  landingVsFpm: number;
}

export interface SimStreamState {
  /** sim-bridge service reachable via SignalR */
  connected: boolean;
  /** MSFS itself is running & sending data (vs just sim-bridge being up in mock mode) */
  simActive: boolean;
  latest: SimData | null;
  lastTakeoff: SimData | null;
  lastLanding: LandingEventPayload | null;
}

const initialState: SimStreamState = {
  connected: false,
  simActive: false,
  latest: null,
  lastTakeoff: null,
  lastLanding: null,
};

/**
 * Connecte au hub SignalR du sim-bridge et expose un état réactif.
 *
 * Gère :
 *   - connection + reconnection automatique
 *   - events : simData, takeoff, landing, connectionChanged
 *   - cleanup à l'unmount
 */
export function useSimStream(): SimStreamState {
  const [state, setState] = useState<SimStreamState>(initialState);
  const connRef = useRef<HubConnection | null>(null);

  useEffect(() => {
    const conn = new HubConnectionBuilder()
      .withUrl(SIM_HUB_URL)
      .withAutomaticReconnect([0, 2_000, 5_000, 10_000, 10_000])
      .configureLogging(LogLevel.Warning)
      .build();

    connRef.current = conn;

    conn.on("simData", (data: SimData) => {
      setState((s) => ({ ...s, latest: data, simActive: true }));
    });

    conn.on("takeoff", (data: SimData) => {
      setState((s) => ({ ...s, lastTakeoff: data, lastLanding: null }));
    });

    conn.on("landing", (evt: LandingEventPayload) => {
      setState((s) => ({ ...s, lastLanding: evt }));
    });

    conn.on("connectionChanged", (connected: boolean) => {
      setState((s) => ({ ...s, simActive: connected }));
    });

    conn.onreconnecting(() => setState((s) => ({ ...s, connected: false })));
    conn.onreconnected(() => setState((s) => ({ ...s, connected: true })));
    conn.onclose(() => setState((s) => ({ ...s, connected: false, simActive: false })));

    conn
      .start()
      .then(() => setState((s) => ({ ...s, connected: true })))
      // eslint-disable-next-line no-console
      .catch((err) => console.warn("[useSimStream] initial connect failed:", err));

    return () => {
      if (conn.state !== HubConnectionState.Disconnected) {
        conn.stop().catch(() => {});
      }
      connRef.current = null;
    };
  }, []);

  return state;
}
