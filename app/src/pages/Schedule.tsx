import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarDays, Clock3, MapPin, Plane, Play, RefreshCw, Save, TriangleAlert, X } from "lucide-react";
import FlightMap, { type RouteArc } from "@/components/FlightMap";
import { Select } from "@/components/Select";
import { useCompany } from "@/contexts/CompanyContext";
import { aircraftTypeByIcao } from "@/data/aircraftTypes";
import { airportByIcao } from "@/data/airports";
import type { Aircraft, FlightSchedule, ScheduleLeg, ScheduleRotation } from "@/lib/database.types";
import { generateSchedule, type GeneratedSchedule } from "@/lib/scheduleGenerator";
import { supabase } from "@/lib/supabase";

const minutesLabel = (minutes: number) => `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}`;

export default function SchedulePage() {
  const { company } = useCompany();
  const navigate = useNavigate();
  const [aircraft, setAircraft] = useState<Aircraft[]>([]);
  const [schedules, setSchedules] = useState<FlightSchedule[]>([]);
  const [selectedScheduleId, setSelectedScheduleId] = useState("");
  const [rotations, setRotations] = useState<ScheduleRotation[]>([]);
  const [legs, setLegs] = useState<ScheduleLeg[]>([]);
  const [preview, setPreview] = useState<GeneratedSchedule | null>(null);
  const [aircraftId, setAircraftId] = useState("");
  const [targetFlights, setTargetFlights] = useState("12");
  const [targetRotations, setTargetRotations] = useState("4");
  const [maxHours, setMaxHours] = useState("20");
  const [maxLegHours, setMaxLegHours] = useState("2.5");
  const [returnToHub, setReturnToHub] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creatingDispatch, setCreatingDispatch] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedAircraft = aircraft.find((item) => item.id === aircraftId);
  const activeSchedule = schedules.find((item) => item.id === selectedScheduleId);

  const loadSchedules = async (preferredId?: string) => {
    if (!company) return;
    const { data, error: fetchError } = await supabase
      .from("schedules")
      .select("*")
      .eq("company_id", company.id)
      .neq("status", "cancelled")
      .order("created_at", { ascending: false });
    if (fetchError) {
      setError(fetchError.message);
      return;
    }
    const rows = (data as FlightSchedule[]) ?? [];
    setSchedules(rows);
    setSelectedScheduleId(preferredId ?? rows[0]?.id ?? "");
  };

  useEffect(() => {
    if (!company) return;
    supabase.from("aircraft").select("*").eq("company_id", company.id).order("name").then(({ data, error: fetchError }) => {
      if (fetchError) setError(fetchError.message);
      const rows = (data as Aircraft[]) ?? [];
      setAircraft(rows);
      setAircraftId(company.active_aircraft_id ?? rows[0]?.id ?? "");
    });
    void loadSchedules();
  }, [company?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedScheduleId) {
      setRotations([]);
      setLegs([]);
      return;
    }
    Promise.all([
      supabase.from("schedule_rotations").select("*").eq("schedule_id", selectedScheduleId).order("sequence"),
      supabase.from("schedule_legs").select("*").eq("schedule_id", selectedScheduleId).order("sequence"),
    ]).then(([rotationResult, legResult]) => {
      if (rotationResult.error || legResult.error) {
        setError(rotationResult.error?.message ?? legResult.error?.message ?? "Failed to load schedule");
        return;
      }
      setRotations((rotationResult.data as ScheduleRotation[]) ?? []);
      setLegs((legResult.data as ScheduleLeg[]) ?? []);
    });
  }, [selectedScheduleId]);

  const buildPreview = () => {
    setError(null);
    if (!company || !selectedAircraft) {
      setError("Select an aircraft first.");
      return;
    }
    const type = aircraftTypeByIcao[selectedAircraft.icao_type];
    if (!type) {
      setError(`No performance data is available for ${selectedAircraft.icao_type}.`);
      return;
    }
    try {
      setPreview(generateSchedule({
        startIcao: selectedAircraft.current_airport_icao ?? company.hub_icao,
        hubIcao: company.hub_icao,
        cruiseSpeedKts: type.cruiseSpeedKts,
        rangeNm: type.rangeNm,
        targetFlights: Number(targetFlights),
        targetRotations: Number(targetRotations),
        maxTotalMinutes: Math.round(Number(maxHours) * 60),
        maxLegMinutes: Math.round(Number(maxLegHours) * 60),
        returnToHub,
        airlineCode: company.airline_code,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate a schedule.");
    }
  };

  async function savePreview() {
    if (!company || !selectedAircraft || !preview || preview.rotations.length === 0) return;
    setSaving(true);
    setError(null);
    let createdScheduleId: string | null = null;
    try {
      const { data: scheduleData, error: scheduleError } = await supabase.from("schedules").insert({
        user_id: company.user_id,
        company_id: company.id,
        aircraft_id: selectedAircraft.id,
        name: `${selectedAircraft.registration ?? selectedAircraft.name} · ${new Date().toLocaleDateString()}`,
        status: "active",
        start_airport_icao: selectedAircraft.current_airport_icao ?? company.hub_icao,
        hub_icao: company.hub_icao,
        max_flight_minutes: Math.round(Number(maxHours) * 60),
        target_flights: Number(targetFlights),
        target_rotations: Number(targetRotations),
        return_to_hub: returnToHub,
        generation_settings: {
          max_leg_minutes: Math.round(Number(maxLegHours) * 60),
          cruise_speed_kts: aircraftTypeByIcao[selectedAircraft.icao_type]?.cruiseSpeedKts ?? 450,
        },
      }).select().single();
      if (scheduleError || !scheduleData) throw scheduleError ?? new Error("Schedule was not created.");
      createdScheduleId = scheduleData.id;

      for (const rotation of preview.rotations) {
        const { data: rotationData, error: rotationError } = await supabase.from("schedule_rotations").insert({
          schedule_id: scheduleData.id,
          sequence: rotation.sequence,
          start_airport_icao: rotation.startAirportIcao,
          end_airport_icao: rotation.endAirportIcao,
          estimated_minutes: rotation.estimatedMinutes,
          status: rotation.sequence === 1 ? "active" : "planned",
        }).select().single();
        if (rotationError || !rotationData) throw rotationError ?? new Error("Rotation was not created.");

        const { error: legsError } = await supabase.from("schedule_legs").insert(rotation.legs.map((leg) => ({
          schedule_id: scheduleData.id,
          rotation_id: rotationData.id,
          sequence: leg.sequence,
          origin_icao: leg.originIcao,
          dest_icao: leg.destIcao,
          distance_nm: leg.distanceNm,
          estimated_minutes: leg.estimatedMinutes,
          flight_number: leg.flightNumber,
          status: leg.sequence === 1 ? "available" as const : "planned" as const,
        })));
        if (legsError) throw legsError;
      }
      setPreview(null);
      await loadSchedules(scheduleData.id);
    } catch (err) {
      if (createdScheduleId) await supabase.from("schedules").delete().eq("id", createdScheduleId);
      setError(err instanceof Error ? err.message : "Failed to save schedule.");
    } finally {
      setSaving(false);
    }
  }

  const nextLeg = legs.find((leg) => leg.status === "available");

  async function createDispatch() {
    if (!company || !activeSchedule || !nextLeg) return;
    const scheduleAircraft = aircraft.find((item) => item.id === activeSchedule.aircraft_id);
    if (!scheduleAircraft) return;
    setCreatingDispatch(true);
    setError(null);
    let createdDispatchId: string | null = null;
    try {
      const aircraftType = aircraftTypeByIcao[scheduleAircraft.icao_type];
      const { data, error: dispatchError } = await supabase.from("dispatches").insert({
        user_id: company.user_id,
        company_id: company.id,
        aircraft_id: scheduleAircraft.id,
        flight_number: nextLeg.flight_number,
        origin_icao: nextLeg.origin_icao,
        dest_icao: nextLeg.dest_icao,
        icao_type: scheduleAircraft.icao_type,
        pax_eco: aircraftType?.maxPaxEco ?? 0,
        pax_biz: aircraftType?.maxPaxBiz ?? 0,
        cargo_kg: 0,
        estim_fuel_lbs: 0,
        cruise_alt: Math.min(35000, aircraftType?.ceilingFt ?? 35000),
        status: "pending",
      }).select().single();
      if (dispatchError || !data) throw dispatchError ?? new Error("Dispatch was not created.");
      createdDispatchId = data.id;
      const { error: legError } = await supabase.from("schedule_legs")
        .update({ dispatch_id: data.id, status: "dispatched" })
        .eq("id", nextLeg.id);
      if (legError) throw legError;
      navigate(`/dispatch?edit=${data.id}`);
    } catch (err) {
      if (createdDispatchId) await supabase.from("dispatches").delete().eq("id", createdDispatchId);
      setError(err instanceof Error ? err.message : "Failed to create dispatch.");
    } finally {
      setCreatingDispatch(false);
    }
  }

  async function cancelSchedule() {
    if (!activeSchedule) return;
    if (legs.some((leg) => leg.status === "dispatched" || leg.status === "flying")) {
      setError("Cancel the linked dispatch before cancelling this schedule.");
      return;
    }
    setError(null);
    const { error: scheduleError } = await supabase.from("schedules").update({ status: "cancelled" }).eq("id", activeSchedule.id);
    if (scheduleError) {
      setError(scheduleError.message);
      return;
    }
    await Promise.all([
      supabase.from("schedule_legs").update({ status: "cancelled" }).eq("schedule_id", activeSchedule.id).in("status", ["planned", "available"]),
      supabase.from("schedule_rotations").update({ status: "cancelled" }).eq("schedule_id", activeSchedule.id).in("status", ["planned", "active"]),
    ]);
    await loadSchedules();
  }

  const displayedLegs = preview ? preview.rotations.flatMap((rotation) => rotation.legs) : legs;
  const displayedFinalLeg = displayedLegs.at(-1);
  const displayedFinalAirport = displayedFinalLeg
    ? ("destIcao" in displayedFinalLeg ? displayedFinalLeg.destIcao : displayedFinalLeg.dest_icao)
    : "--";
  const routeArcs = useMemo<RouteArc[]>(() => displayedLegs.flatMap((leg) => {
    const origin = airportByIcao["originIcao" in leg ? leg.originIcao : leg.origin_icao];
    const destination = airportByIcao["destIcao" in leg ? leg.destIcao : leg.dest_icao];
    if (!origin || !destination) return [];
    return [{
      from: [origin.lat, origin.lon],
      to: [destination.lat, destination.lon],
      fromIcao: origin.icao,
      toIcao: destination.icao,
    }];
  }), [displayedLegs]);

  if (!company) return null;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white">Flight Schedule</h1>
        <p className="text-sm text-slate-400">Build continuous aircraft rotations with no teleporting</p>
      </div>

      {error && <div className="rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-3 text-sm text-red-300">{error}</div>}

      <form onSubmit={(event: FormEvent) => { event.preventDefault(); buildPreview(); }} className="space-y-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <label className="xl:col-span-2">
            <FieldLabel>Aircraft</FieldLabel>
            <Select value={aircraftId} onChange={(value) => { setAircraftId(value); setPreview(null); }} options={aircraft.map((item) => ({
              value: item.id,
              label: `${item.registration ?? item.name} · ${item.icao_type} · ${item.current_airport_icao ?? company.hub_icao}`,
            }))} />
          </label>
          <NumberField label="Flights" value={targetFlights} onChange={setTargetFlights} min={1} max={60} />
          <NumberField label="Rotations" value={targetRotations} onChange={setTargetRotations} min={1} max={30} />
          <NumberField label="Max flight hours" value={maxHours} onChange={setMaxHours} min={1} max={200} step="0.5" />
          <NumberField label="Max hours per leg" value={maxLegHours} onChange={setMaxLegHours} min={0.5} max={20} step="0.25" />
          <label className="flex items-end gap-3 pb-2 text-sm text-slate-300">
            <input type="checkbox" checked={returnToHub} onChange={(event) => setReturnToHub(event.target.checked)} className="h-4 w-4 accent-cyan-500" />
            Return to {company.hub_icao}
          </label>
          <div className="flex items-end gap-2 xl:col-span-2">
            <button type="submit" className="flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-400">
              <RefreshCw className="h-4 w-4" /> Generate
            </button>
            {preview && <button type="button" disabled={saving} onClick={() => void savePreview()} className="flex items-center gap-2 rounded-xl border border-brand-500/30 px-4 py-2.5 text-sm font-semibold text-brand-300 hover:bg-brand-500/[0.08] disabled:opacity-50">
              <Save className="h-4 w-4" /> {saving ? "Saving..." : "Save schedule"}
            </button>}
          </div>
        </div>
        {selectedAircraft && <div className="flex items-center gap-2 text-xs text-slate-500"><MapPin className="h-3.5 w-3.5" /> Starts at <strong className="text-slate-300">{selectedAircraft.current_airport_icao ?? company.hub_icao}</strong></div>}
      </form>

      {!preview && schedules.length > 0 && <div className="flex items-center justify-between">
        <div className="w-full max-w-md"><Select value={selectedScheduleId} onChange={setSelectedScheduleId} options={schedules.map((item) => ({ value: item.id, label: `${item.name} · ${item.status}` }))} /></div>
        <div className="ml-3 flex items-center gap-2">
          {nextLeg && <button disabled={creatingDispatch} onClick={() => void createDispatch()} className="flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-400 disabled:opacity-50">
            <Play className="h-4 w-4" /> {creatingDispatch ? "Creating..." : `Prepare ${nextLeg.flight_number}`}
          </button>}
          {activeSchedule?.status === "active" && <button onClick={() => void cancelSchedule()} className="flex items-center gap-2 rounded-xl border border-red-500/20 px-3 py-2.5 text-sm text-red-300 hover:bg-red-500/[0.06]" title="Cancel schedule">
            <X className="h-4 w-4" /> Cancel
          </button>}
        </div>
      </div>}

      {displayedLegs.length > 0 && <>
        <div className="grid gap-4 md:grid-cols-4">
          <Stat label="Flights" value={String(displayedLegs.length)} icon={Plane} />
          <Stat label="Rotations" value={String(preview?.rotations.length ?? rotations.length)} icon={CalendarDays} />
          <Stat label="Flight time" value={minutesLabel(preview?.totalMinutes ?? legs.reduce((sum, leg) => sum + leg.estimated_minutes, 0))} icon={Clock3} />
          <Stat label="Final position" value={preview?.finalAirportIcao ?? displayedFinalAirport} icon={MapPin} />
        </div>
        <FlightMap routes={routeArcs} origin={airportByIcao[activeSchedule?.start_airport_icao ?? selectedAircraft?.current_airport_icao ?? company.hub_icao]} height="320px" interactive />
      </>}

      {preview?.warnings.map((warning) => <div key={warning} className="flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/[0.05] px-4 py-3 text-sm text-amber-300"><TriangleAlert className="h-4 w-4" />{warning}</div>)}

      <div className="space-y-4">
        {(preview?.rotations ?? rotations.map((rotation) => ({
          sequence: rotation.sequence,
          startAirportIcao: rotation.start_airport_icao,
          endAirportIcao: rotation.end_airport_icao,
          estimatedMinutes: rotation.estimated_minutes,
          legs: legs.filter((leg) => leg.rotation_id === rotation.id),
        }))).map((rotation) => <div key={rotation.sequence} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
          <div className="mb-4 flex items-center justify-between">
            <div><span className="font-semibold text-white">Rotation {rotation.sequence}</span><span className="ml-3 text-xs text-slate-500">{rotation.startAirportIcao} → {rotation.endAirportIcao}</span></div>
            <span className="font-mono text-xs text-slate-400">{minutesLabel(rotation.estimatedMinutes)}</span>
          </div>
          <div className="space-y-2">{rotation.legs.map((leg) => {
            const generated = "originIcao" in leg;
            const status = generated ? "preview" : leg.status;
            return <div key={generated ? leg.sequence : leg.id} className="flex items-center justify-between rounded-lg bg-white/[0.025] px-4 py-3">
              <div className="flex items-center gap-4"><span className="w-16 font-mono text-xs text-brand-300">{generated ? leg.flightNumber : leg.flight_number}</span><span className="font-mono text-sm font-semibold text-white">{generated ? leg.originIcao : leg.origin_icao} → {generated ? leg.destIcao : leg.dest_icao}</span></div>
              <div className="flex items-center gap-4 text-xs text-slate-500"><span>{generated ? leg.distanceNm : leg.distance_nm} nm</span><span>{minutesLabel(generated ? leg.estimatedMinutes : leg.estimated_minutes)}</span><span className="w-20 text-right uppercase text-slate-400">{status}</span></div>
            </div>;
          })}</div>
        </div>)}
      </div>

      {!preview && schedules.length === 0 && <div className="rounded-xl border border-dashed border-white/[0.08] py-16 text-center text-sm text-slate-500">Generate your first continuous aircraft schedule above.</div>}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="mb-1.5 block text-[10px] uppercase tracking-[0.15em] text-slate-400">{children}</span>;
}

function NumberField({ label, value, onChange, min, max, step = "1" }: { label: string; value: string; onChange: (value: string) => void; min: number; max: number; step?: string }) {
  return <label><FieldLabel>{label}</FieldLabel><input type="number" required value={value} min={min} max={max} step={step} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-sm text-white outline-none focus:border-brand-500/50" /></label>;
}

function Stat({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Plane }) {
  return <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"><div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.15em] text-slate-500"><Icon className="h-3.5 w-3.5" />{label}</div><div className="font-mono text-lg font-semibold text-white">{value}</div></div>;
}
