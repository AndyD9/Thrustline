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

export interface AcarsUpdatePayload {
  phase: string;
  latitude: number;
  longitude: number;
  altitudeFt: number;
  groundSpeedKts: number;
  headingDeg: number;
  fuelGal: number;
  message: string;
  timestamp: string;
}

export interface AchievementPayload {
  key: string;
  title: string;
  description: string;
  icon: string;
}

export interface SimStreamState {
  /** sim-bridge service reachable via SignalR */
  connected: boolean;
  /** MSFS itself is running & sending data (vs just sim-bridge being up in mock mode) */
  simActive: boolean;
  latest: SimData | null;
  lastTakeoff: SimData | null;
  lastLanding: LandingEventPayload | null;
  /** ACARS position reports accumulated during flight */
  acarsLog: AcarsUpdatePayload[];
  /** Current flight phase from ACARS service */
  currentPhase: string | null;
  /** Latest unlocked achievement (for toast display) */
  latestAchievement: AchievementPayload | null;
}

const initialState: SimStreamState = {
  connected: false,
  simActive: false,
  latest: null,
  lastTakeoff: null,
  lastLanding: null,
  acarsLog: [],
  currentPhase: null,
  latestAchievement: null,
};

/**
 * Connecte au hub SignalR du sim-bridge et expose un état réactif.
 *
 * Gère :
 *   - connection + reconnection automatique
 *   - events : simData, takeoff, landing, connectionChanged
 *   - cleanup à l'unmount
 */
export function useSimStream(onLanding?: (evt: LandingEventPayload) => void): SimStreamState {
  const [state, setState] = useState<SimStreamState>(initialState);
  const connRef = useRef<HubConnection | null>(null);
  const onLandingRef = useRef(onLanding);
  onLandingRef.current = onLanding;

  useEffect(() => {
    const conn = new HubConnectionBuilder()
      .withUrl(SIM_HUB_URL)
      .withAutomaticReconnect([0, 2_000, 5_000, 10_000, 10_000])
      .configureLogging(LogLevel.Warning)
      .build();

    connRef.current = conn;

    conn.on("simData", (data: SimData) => {
      // Only mark sim as active when we receive meaningful data
      // (aircraft loaded in MSFS, not just SimConnect connected idle)
      const hasRealData = !!data.aircraftTitle && data.aircraftTitle.length > 0;
      setState((s) => ({ ...s, latest: data, simActive: hasRealData }));
    });

    conn.on("takeoff", (data: SimData) => {
      setState((s) => ({ ...s, lastTakeoff: data, lastLanding: null, acarsLog: [], currentPhase: "takeoff" }));
    });

    conn.on("landing", (evt: LandingEventPayload) => {
      setState((s) => ({ ...s, lastLanding: evt }));
      onLandingRef.current?.(evt);
    });

    conn.on("acarsUpdate", (report: AcarsUpdatePayload) => {
      setState((s) => ({ ...s, acarsLog: [...s.acarsLog.slice(-499), report] }));
    });

    conn.on("phaseChange", (phase: string) => {
      setState((s) => ({ ...s, currentPhase: phase }));
    });

    conn.on("achievementUnlocked", (achievement: AchievementPayload) => {
      setState((s) => ({ ...s, latestAchievement: achievement }));
    });

    conn.on("connectionChanged", (connected: boolean) => {
      // SimConnect connection status — if disconnected, sim is definitely not active
      if (!connected) {
        setState((s) => ({ ...s, simActive: false }));
      }
      // If connected, wait for actual simData with aircraft title before setting simActive
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
