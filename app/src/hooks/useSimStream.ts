import { useEffect, useRef, useState } from "react";
import {
  HubConnection,
  HubConnectionBuilder,
  HubConnectionState,
  LogLevel,
} from "@microsoft/signalr";
import { SIM_HUB_URL, waitForBridge } from "@/lib/simBridge";

export interface SimData {
  timestamp: string;
  isSimActive: boolean;
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
  aircraftAtcModel: string | null;
  aircraftAtcType: string | null;
  aircraftRegistration: string | null;
  aircraftCategory: string | null;
  accelerationBodyX: number;
  accelerationBodyY: number;
  accelerationBodyZ: number;
  gForce: number;
  pitchDeg: number;
  bankDeg: number;
  rotationVelocityBodyX: number;
  rotationVelocityBodyY: number;
  rotationVelocityBodyZ: number;
  seatbeltsOn: boolean;
}

export interface PassengerCohortPayload {
  cabinClass: string;
  passengerCount: number;
  satisfaction: number;
  comfort: number;
  stress: number;
  nausea: number;
  entertainment: number;
}

export interface PassengerExperiencePayload {
  timestamp: string;
  isActive: boolean;
  satisfaction: number;
  comfort: number;
  stress: number;
  nausea: number;
  entertainment: number;
  currentEvent: string;
  trend: "up" | "down" | "stable";
  affectedPassengers: number;
  abruptManeuvers: number;
  turbulenceSeconds: number;
  bestMoment: string;
  worstMoment: string;
  economy: PassengerCohortPayload;
  business: PassengerCohortPayload;
}

export interface LandingEventPayload {
  takeoff: SimData;
  touchdown: SimData;
  distanceNm: number;
  fuelUsedGal: number;
  durationMin: number;
  landingVsFpm: number;
  passengerExperience: PassengerExperiencePayload | null;
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
  /** MSFS itself is running & sending data */
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
  passengerExperience: PassengerExperiencePayload | null;
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
  passengerExperience: null,
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
    let cancelled = false;

    async function connect() {
      // Wait for sim-bridge to be reachable before attempting SignalR connection.
      // This avoids spamming ERR_CONNECTION_REFUSED in the console during dev without sim-bridge.
      const ready = await waitForBridge(3, 3_000);
      if (!ready || cancelled) return;

      const conn = new HubConnectionBuilder()
        .withUrl(SIM_HUB_URL)
        .withAutomaticReconnect([0, 2_000, 5_000, 10_000, 10_000])
        .configureLogging(LogLevel.Warning)
        .build();

      if (cancelled) return;
      connRef.current = conn;

      conn.on("simData", (data: SimData) => {
        const hasRealData = data.isSimActive && (
          (!!data.aircraftTitle && data.aircraftTitle.trim().length > 0) ||
          data.latitude !== 0 ||
          data.longitude !== 0 ||
          data.fuelTotalGal > 0
        );
        setState((s) => ({
          ...s,
          latest: hasRealData ? data : s.latest,
          simActive: hasRealData,
          ...(!data.isSimActive && {
            lastTakeoff: null,
            lastLanding: null,
            acarsLog: [],
            currentPhase: null,
            passengerExperience: null,
          }),
        }));
      });

      conn.on("takeoff", (data: SimData) => {
        setState((s) => ({ ...s, lastTakeoff: data, lastLanding: null, acarsLog: [], currentPhase: "takeoff" }));
      });

      conn.on("landing", (evt: LandingEventPayload) => {
        setState((s) => ({
          ...s,
          lastLanding: evt,
          passengerExperience: evt.passengerExperience ?? s.passengerExperience,
        }));
        onLandingRef.current?.(evt);
      });

      conn.on("acarsUpdate", (report: AcarsUpdatePayload) => {
        setState((s) => ({ ...s, acarsLog: [...s.acarsLog.slice(-499), report] }));
      });

      conn.on("phaseChange", (phase: string) => {
        setState((s) => ({ ...s, currentPhase: phase }));
      });

      conn.on("passengerExperience", (experience: PassengerExperiencePayload) => {
        setState((s) => ({ ...s, passengerExperience: experience }));
      });

      conn.on("achievementUnlocked", (achievement: AchievementPayload) => {
        setState((s) => ({ ...s, latestAchievement: achievement }));
      });

      conn.on("connectionChanged", (connected: boolean) => {
        if (!connected) {
          setState((s) => ({ ...s, simActive: false }));
        }
      });

      conn.onreconnecting(() => setState((s) => ({ ...s, connected: false })));
      conn.onreconnected(() => setState((s) => ({ ...s, connected: true })));
      conn.onclose(() => setState((s) => ({ ...s, connected: false, simActive: false })));

      conn
        .start()
        .then(() => setState((s) => ({ ...s, connected: true })))
        // eslint-disable-next-line no-console
        .catch((err) => console.warn("[useSimStream] initial connect failed:", err));
    }

    connect();

    return () => {
      cancelled = true;
      const conn = connRef.current;
      if (conn && conn.state !== HubConnectionState.Disconnected) {
        conn.stop().catch(() => {});
      }
      connRef.current = null;
    };
  }, []);

  return state;
}
