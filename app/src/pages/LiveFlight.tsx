import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useSim } from "@/contexts/SimContext";
import { useUnits } from "@/contexts/UnitsContext";
import { airportByIcao } from "@/data/airports";
import FlightMap from "@/components/FlightMap";
import type { Dispatch } from "@/lib/database.types";
import type { Airport } from "@/data/airports";
import {
  ArrowLeft,
  Plane,
  Gauge,
  Navigation,
  Compass,
  Fuel,
  ArrowUpDown,
  MapPin,
  Clock,
  Route as RouteIcon,
  CheckCircle2,
} from "lucide-react";

export default function LiveFlight() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const dispatchId = params.get("dispatch");

  const { latest, simActive, lastLanding } = useSim();
  const { fmt } = useUnits();

  const [dispatch, setDispatch] = useState<Dispatch | null>(null);
  const [origin, setOrigin] = useState<Airport | undefined>();
  const [destination, setDestination] = useState<Airport | undefined>();
  const [waypoints, setWaypoints] = useState<[number, number][]>([]);
  const [landed, setLanded] = useState(false);

  // Track aircraft trail
  const trailRef = useRef<[number, number][]>([]);
  const [trail, setTrail] = useState<[number, number][]>([]);

  // Load dispatch
  useEffect(() => {
    if (!dispatchId) return;
    supabase
      .from("dispatches")
      .select("*")
      .eq("id", dispatchId)
      .single()
      .then(({ data }) => {
        if (!data) return;
        const d = data as Dispatch;
        setDispatch(d);
        setOrigin(airportByIcao[d.origin_icao]);
        setDestination(airportByIcao[d.dest_icao]);
        // Parse OFP waypoints if available
        if (d.ofp_data) {
          try {
            const ofp = typeof d.ofp_data === "string" ? JSON.parse(d.ofp_data) : d.ofp_data;
            if (ofp?.navlog && Array.isArray(ofp.navlog)) {
              setWaypoints(ofp.navlog.map((f: { lat: number; lon: number }) => [f.lat, f.lon]));
            }
          } catch { /* ignore parse errors */ }
        }
      });
  }, [dispatchId]);

  // Accumulate aircraft trail
  useEffect(() => {
    if (!latest || latest.onGround) return;
    const last = trailRef.current[trailRef.current.length - 1];
    const pos: [number, number] = [latest.latitude, latest.longitude];
    // Only add if moved significantly (>0.005 deg ~ 500m)
    if (!last || Math.abs(last[0] - pos[0]) > 0.005 || Math.abs(last[1] - pos[1]) > 0.005) {
      trailRef.current.push(pos);
      setTrail([...trailRef.current]);
    }
  }, [latest]);

  // Detect landing
  useEffect(() => {
    if (lastLanding) setLanded(true);
  }, [lastLanding]);

  const goBack = useCallback(() => navigate("/dispatch"), [navigate]);

  const aircraft = latest && simActive
    ? { lat: latest.latitude, lon: latest.longitude, heading: latest.headingDeg }
    : undefined;

  return (
    <div className="relative h-full w-full animate-fade-in">
      {/* Full-screen map */}
      <FlightMap
        origin={origin}
        destination={destination}
        waypoints={waypoints.length > 0 ? waypoints : trail}
        aircraft={aircraft}
        height="100%"
        interactive
      />

      {/* Back button */}
      <div className="absolute left-4 top-4 z-10">
        <button
          onClick={goBack}
          className="flex items-center gap-2 rounded-xl border border-white/[0.1] bg-[#0a0f18]/90 px-3 py-2 text-sm text-slate-300 backdrop-blur-md transition-all hover:bg-[#0a0f18] hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Dispatch
        </button>
      </div>

      {/* Flight info overlay — left */}
      {dispatch && (
        <div className="absolute left-4 top-16 z-10 w-64 space-y-3">
          {/* Flight header */}
          <div className="rounded-xl border border-white/[0.08] bg-[#0a0f18]/90 p-4 backdrop-blur-md">
            <div className="mb-2 flex items-center gap-2">
              <Plane className="h-4 w-4 text-brand-300 animate-pulse" />
              <span className="font-mono text-lg font-bold text-white">{dispatch.flight_number}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="font-mono font-semibold text-white">{dispatch.origin_icao}</span>
              <div className="h-px flex-1 bg-gradient-to-r from-brand-500/60 to-brand-500/20" />
              <Plane className="h-3 w-3 text-brand-400 -rotate-45" />
              <div className="h-px flex-1 bg-gradient-to-l from-brand-500/60 to-brand-500/20" />
              <span className="font-mono font-semibold text-white">{dispatch.dest_icao}</span>
            </div>
            {origin && destination && (
              <div className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-500">
                <MapPin className="h-3 w-3" />
                {origin.city || origin.name} → {destination.city || destination.name}
              </div>
            )}
            <div className="mt-2 text-[11px] text-slate-600">
              {dispatch.icao_type} · {dispatch.pax_eco}Y + {dispatch.pax_biz}J
            </div>
          </div>

          {/* Progress info */}
          {latest && !latest.onGround && origin && destination && (
            <div className="rounded-xl border border-white/[0.08] bg-[#0a0f18]/90 p-4 backdrop-blur-md">
              <div className="space-y-2 text-xs">
                <InfoRow icon={RouteIcon} label="Distance" value={fmt.distance(
                  Math.round(haversine(origin.lat, origin.lon, destination.lat, destination.lon))
                )} />
                <InfoRow icon={Clock} label="Elapsed" value={formatElapsed(latest.timestamp, dispatch.updated_at)} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Instruments overlay — right */}
      {latest && simActive && (
        <div className="absolute right-4 top-16 z-10 w-48">
          <div className="rounded-xl border border-white/[0.08] bg-[#0a0f18]/90 p-4 backdrop-blur-md">
            <div className="mb-3 text-[10px] uppercase tracking-[0.15em] text-slate-500">Instruments</div>
            <div className="space-y-2.5">
              <InstrumentRow icon={ArrowUpDown} label="ALT" value={fmt.altitude(latest.altitudeFt)} />
              <InstrumentRow icon={Gauge} label="GS" value={fmt.speed(latest.groundSpeedKts)} />
              <InstrumentRow icon={Navigation} label="IAS" value={fmt.speed(latest.indicatedAirspeedKts)} />
              <InstrumentRow icon={Compass} label="HDG" value={`${Math.round(latest.headingDeg)}\u00B0`} />
              <InstrumentRow icon={ArrowUpDown} label="V/S" value={fmt.vs(latest.verticalSpeedFpm)} />
              <InstrumentRow icon={Fuel} label="FUEL" value={fmt.fuel(latest.fuelTotalGal)} />
            </div>
          </div>
        </div>
      )}

      {/* Landing overlay */}
      {landed && lastLanding && (
        <div className="absolute inset-x-0 bottom-8 z-10 flex justify-center">
          <div className="rounded-2xl border border-emerald-500/20 bg-[#0a0f18]/95 px-8 py-5 backdrop-blur-md glow-brand-sm animate-slide-up">
            <div className="mb-3 flex items-center gap-2 text-emerald-400">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-semibold">Flight Complete</span>
            </div>
            <div className="grid grid-cols-3 gap-6 text-center">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-500">Distance</div>
                <div className="font-mono text-lg font-bold text-white">{fmt.distance(lastLanding.distanceNm)}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-500">Landing VS</div>
                <div className="font-mono text-lg font-bold text-white">{fmt.vs(Math.abs(lastLanding.landingVsFpm))}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-500">Duration</div>
                <div className="font-mono text-lg font-bold text-white">{lastLanding.durationMin} min</div>
              </div>
            </div>
            <button
              onClick={goBack}
              className="mt-4 w-full rounded-xl bg-brand-500 py-2.5 text-sm font-semibold text-white transition-all hover:bg-brand-400"
            >
              Back to Dispatch
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Helpers ────────────────────────────────────────── */

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3440.065;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function formatElapsed(now: string, start: string): string {
  const diff = Math.max(0, (new Date(now).getTime() - new Date(start).getTime()) / 1000);
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}

function InfoRow({ icon: Icon, label, value }: { icon: typeof Plane; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-1.5 text-slate-500">
        <Icon className="h-3 w-3" />
        {label}
      </span>
      <span className="font-mono text-sm text-slate-200">{value}</span>
    </div>
  );
}

function InstrumentRow({ icon: Icon, label, value }: { icon: typeof Plane; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-3.5 w-3.5 text-slate-500" />
      <span className="w-8 text-[10px] uppercase tracking-wider text-slate-500">{label}</span>
      <span className="ml-auto font-mono text-sm font-medium text-slate-100">{value}</span>
    </div>
  );
}
