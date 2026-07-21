import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarDays, Clock3, MapPin, Plane, Play, RefreshCw, Save, Trash2, TriangleAlert, Users, X } from "lucide-react";
import FlightMap, { type RouteArc } from "@/components/FlightMap";
import ConfirmDialog from "@/components/ConfirmDialog";
import { Select } from "@/components/Select";
import { useCompany } from "@/contexts/CompanyContext";
import { aircraftTypeByIcao } from "@/data/aircraftTypes";
import { airportByIcao } from "@/data/airports";
import type { Aircraft, CrewMember, FlightSchedule, ScheduleCabinCrew, ScheduleLeg, ScheduleRotation } from "@/lib/database.types";
import { advancePassiveOperations } from "@/lib/passiveOperations";
import { generateSchedule, type GeneratedSchedule } from "@/lib/scheduleGenerator";
import { supabase } from "@/lib/supabase";

const minutesLabel = (minutes: number) => `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}`;
const localDateTimeValue = (date: Date) => {
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return shifted.toISOString().slice(0, 16);
};
const dateTimeLabel = (value: string | null) => value
  ? new Date(value).toLocaleString([], { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
  : "--";
const errorMessage = (error: unknown, fallback: string) => {
  if (error && typeof error === "object") {
    const payload = error as { message?: string; details?: string; code?: string };
    const raw = payload.message ?? payload.details;
    if (payload.code === "23505" || raw?.includes("schedules_one_active_per_aircraft_idx"))
      return "This aircraft already has a planned or active schedule. Complete or cancel it before creating another one.";
    if (raw?.includes("already assigned to another active schedule"))
      return "A selected crew member is already assigned to another planned or active schedule.";
    if (raw) return raw;
  }
  return error instanceof Error ? error.message : fallback;
};

export default function SchedulePage() {
  const { company } = useCompany();
  const navigate = useNavigate();
  const [aircraft, setAircraft] = useState<Aircraft[]>([]);
  const [crew, setCrew] = useState<CrewMember[]>([]);
  const [schedules, setSchedules] = useState<FlightSchedule[]>([]);
  const [cabinAssignments, setCabinAssignments] = useState<ScheduleCabinCrew[]>([]);
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
  const [passiveEnabled, setPassiveEnabled] = useState(true);
  const [captainId, setCaptainId] = useState("");
  const [firstOfficerId, setFirstOfficerId] = useState("");
  const [cabinCrewIds, setCabinCrewIds] = useState<string[]>([]);
  const [groundMinutes, setGroundMinutes] = useState("45");
  const [timeScale, setTimeScale] = useState("12");
  const [startAt, setStartAt] = useState(() => localDateTimeValue(new Date(Date.now() + 60 * 60_000)));
  const [saving, setSaving] = useState(false);
  const [creatingDispatch, setCreatingDispatch] = useState(false);
  const [deleteConfirmationOpen, setDeleteConfirmationOpen] = useState(false);
  const [deletingSchedule, setDeletingSchedule] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);

  const selectedAircraft = aircraft.find((item) => item.id === aircraftId);
  const requiredCabinCrew = selectedAircraft ? aircraftTypeByIcao[selectedAircraft.icao_type]?.minCabin ?? 0 : 0;
  const activeSchedule = schedules.find((item) => item.id === selectedScheduleId);
  const plannedSchedules = schedules.filter((item) => item.status === "planned" || item.status === "active");
  const aircraftScheduleConflict = plannedSchedules.find((item) => item.aircraft_id === aircraftId);
  const captainScheduleConflict = plannedSchedules.find((item) => item.captain_id === captainId || item.first_officer_id === captainId);
  const firstOfficerScheduleConflict = plannedSchedules.find((item) => item.captain_id === firstOfficerId || item.first_officer_id === firstOfficerId);
  const cabinScheduleConflict = plannedSchedules.find((item) => cabinAssignments.some((assignment) => assignment.schedule_id === item.id && cabinCrewIds.includes(assignment.crew_member_id)));

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
    const { data: cabinData, error: cabinError } = rows.length > 0
      ? await supabase.from("schedule_cabin_crew").select("*").in("schedule_id", rows.map((row) => row.id))
      : { data: [], error: null };
    if (cabinError) {
      setError(cabinError.message);
      return;
    }
    setCabinAssignments((cabinData as ScheduleCabinCrew[]) ?? []);
    setSelectedScheduleId(preferredId ?? rows[0]?.id ?? "");
  };

  useEffect(() => {
    if (!company) return;
    Promise.all([
      supabase.from("aircraft").select("*").eq("company_id", company.id).is("disposed_at", null).order("name"),
      supabase.from("crew_members").select("*").eq("company_id", company.id).order("last_name"),
    ]).then(([aircraftResult, crewResult]) => {
      if (aircraftResult.error || crewResult.error) setError(aircraftResult.error?.message ?? crewResult.error?.message ?? null);
      const rows = (aircraftResult.data as Aircraft[]) ?? [];
      const crewRows = (crewResult.data as CrewMember[]) ?? [];
      setAircraft(rows);
      setCrew(crewRows);
      setAircraftId(company.active_aircraft_id ?? rows[0]?.id ?? "");
      setCaptainId(crewRows.find((member) => member.rank === "captain" && member.status === "available")?.id ?? "");
      setFirstOfficerId(crewRows.find((member) => member.rank === "first_officer" && member.status === "available")?.id ?? "");
    });
    void loadSchedules();
    void advancePassiveOperations().then(() => { void loadSchedules(); setRefreshNonce((value) => value + 1); }).catch((err) => setError(errorMessage(err, "Passive operations could not be updated.")));
    const timer = window.setInterval(() => {
      void advancePassiveOperations().then(() => { void loadSchedules(); setRefreshNonce((value) => value + 1); }).catch((err) => setError(errorMessage(err, "Passive operations could not be updated.")));
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [company?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const activeScheduleIds = new Set(schedules.filter((schedule) => schedule.status === "planned" || schedule.status === "active").map((schedule) => schedule.id));
    const reservedIds = new Set(cabinAssignments.filter((assignment) => activeScheduleIds.has(assignment.schedule_id)).map((assignment) => assignment.crew_member_id));
    const available = crew.filter((member) => member.rank === "cabin_crew" && member.status === "available" && !reservedIds.has(member.id));
    setCabinCrewIds((current) => {
      const valid = current.filter((id) => available.some((member) => member.id === id)).slice(0, requiredCabinCrew);
      const additions = available.filter((member) => !valid.includes(member.id)).slice(0, requiredCabinCrew - valid.length).map((member) => member.id);
      return [...valid, ...additions];
    });
  }, [aircraftId, crew, requiredCabinCrew, schedules, cabinAssignments]);

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
  }, [selectedScheduleId, refreshNonce]);

  const buildPreview = () => {
    setError(null);
    if (!company || !selectedAircraft) {
      setError("Select an aircraft first.");
      return;
    }
    if (passiveEnabled && (!captainId || !firstOfficerId)) {
      setError("Select a captain and a first officer for passive operations.");
      return;
    }
    if (passiveEnabled && cabinCrewIds.length !== requiredCabinCrew) {
      setError(`${selectedAircraft.name} requires ${requiredCabinCrew} cabin crew member${requiredCabinCrew === 1 ? "" : "s"}; ${cabinCrewIds.length} selected.`);
      return;
    }
    if (aircraftScheduleConflict) {
      setError(`This aircraft is already assigned to “${aircraftScheduleConflict.name}”. Complete or cancel that schedule first.`);
      return;
    }
    if (passiveEnabled && (captainScheduleConflict || firstOfficerScheduleConflict || cabinScheduleConflict)) {
      const conflict = captainScheduleConflict ?? firstOfficerScheduleConflict ?? cabinScheduleConflict;
      setError(`A selected crew member is already assigned to “${conflict?.name}”. Choose someone else or cancel that schedule first.`);
      return;
    }
    if (!startAt || Number.isNaN(new Date(startAt).getTime())) {
      setError("Choose a valid first departure time.");
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
        startAt: new Date(startAt),
        groundMinutes: Number(groundMinutes),
        timeScale: passiveEnabled ? Number(timeScale) : 1,
      }));
    } catch (err) {
      setError(errorMessage(err, "Could not generate a schedule."));
    }
  };

  async function savePreview() {
    if (!company || !selectedAircraft || !preview || preview.rotations.length === 0) return;
    setSaving(true);
    setError(null);
    let createdScheduleId: string | null = null;
    try {
      if (aircraftScheduleConflict) throw new Error(`This aircraft is already assigned to “${aircraftScheduleConflict.name}”. Complete or cancel that schedule first.`);
      if (passiveEnabled && cabinCrewIds.length !== requiredCabinCrew) throw new Error(`${selectedAircraft.name} requires ${requiredCabinCrew} cabin crew members.`);
      if (passiveEnabled && (captainScheduleConflict || firstOfficerScheduleConflict || cabinScheduleConflict)) {
        const conflict = captainScheduleConflict ?? firstOfficerScheduleConflict ?? cabinScheduleConflict;
        throw new Error(`A selected crew member is already assigned to “${conflict?.name}”. Choose someone else or cancel that schedule first.`);
      }
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
        captain_id: passiveEnabled ? captainId : null,
        first_officer_id: passiveEnabled ? firstOfficerId : null,
        cabin_crew_required: passiveEnabled ? requiredCabinCrew : 0,
        passive_enabled: passiveEnabled,
        ground_time_minutes: Number(groundMinutes),
        time_scale: passiveEnabled ? Number(timeScale) : 1,
        generation_settings: {
          max_leg_minutes: Math.round(Number(maxLegHours) * 60),
          cruise_speed_kts: aircraftTypeByIcao[selectedAircraft.icao_type]?.cruiseSpeedKts ?? 450,
        },
      }).select().single();
      if (scheduleError || !scheduleData) throw scheduleError ?? new Error("Schedule was not created.");
      createdScheduleId = scheduleData.id;

      if (passiveEnabled && cabinCrewIds.length > 0) {
        const { error: cabinError } = await supabase.from("schedule_cabin_crew").insert(cabinCrewIds.map((crewMemberId) => ({
          schedule_id: scheduleData.id,
          crew_member_id: crewMemberId,
        })));
        if (cabinError) throw cabinError;
      }

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
          operation_mode: passiveEnabled ? "passive" as const : "player" as const,
          scheduled_departure_at: leg.scheduledDeparture,
          scheduled_arrival_at: leg.scheduledArrival,
          status: leg.sequence === 1 ? "available" as const : "planned" as const,
        })));
        if (legsError) throw legsError;
      }
      setPreview(null);
      if (passiveEnabled) await advancePassiveOperations();
      await loadSchedules(scheduleData.id);
    } catch (err) {
      if (createdScheduleId) await supabase.from("schedules").delete().eq("id", createdScheduleId);
      setError(errorMessage(err, "Failed to save schedule."));
    } finally {
      setSaving(false);
    }
  }

  const nextLeg = legs.find((leg) => leg.status === "available");

  async function createDispatch() {
    if (!company || !activeSchedule || !nextLeg) return;
    if (activeSchedule.passive_enabled || nextLeg.operation_mode === "passive") {
      setError("Passive flights are operated automatically and cannot be prepared manually.");
      return;
    }
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
      setError(errorMessage(err, "Failed to create dispatch."));
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

  async function deleteSchedule() {
    if (!activeSchedule) return;
    if (legs.some((leg) => leg.status === "dispatched" || leg.status === "flying")) {
      setDeleteConfirmationOpen(false);
      setError("This schedule has a dispatched or flying leg. Cancel or complete that flight before deleting the schedule.");
      return;
    }
    setDeletingSchedule(true);
    setError(null);
    const { error: deleteError } = await supabase.from("schedules").delete().eq("id", activeSchedule.id);
    if (deleteError) setError(errorMessage(deleteError, "Failed to delete schedule."));
    else {
      setDeleteConfirmationOpen(false);
      setSelectedScheduleId("");
      setRotations([]);
      setLegs([]);
      await loadSchedules();
    }
    setDeletingSchedule(false);
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
  const passiveWaitMessage = useMemo(() => {
    if (!activeSchedule?.passive_enabled) return null;
    const waitingLeg = legs.find((leg) => leg.status === "available" && leg.operation_mode === "passive");
    if (!waitingLeg) return null;
    const departureAt = waitingLeg.scheduled_departure_at ? new Date(waitingLeg.scheduled_departure_at) : null;
    if (departureAt && departureAt.getTime() > Date.now()) {
      return `Automatic departure scheduled for ${dateTimeLabel(waitingLeg.scheduled_departure_at)}.`;
    }
    const scheduleAircraft = aircraft.find((item) => item.id === activeSchedule.aircraft_id);
    if (scheduleAircraft?.current_airport_icao && scheduleAircraft.current_airport_icao.toUpperCase() !== waitingLeg.origin_icao.toUpperCase()) {
      return `Blocked: aircraft is at ${scheduleAircraft.current_airport_icao}, but this flight departs from ${waitingLeg.origin_icao}.`;
    }
    const assignedCrewIds = [
      activeSchedule.captain_id,
      activeSchedule.first_officer_id,
      ...cabinAssignments.filter((item) => item.schedule_id === activeSchedule.id).map((item) => item.crew_member_id),
    ];
    const unavailableCrew = crew.find((member) => assignedCrewIds.includes(member.id)
      && (member.status !== "available" || member.duty_hours >= member.max_duty_h));
    if (unavailableCrew) {
      return `Blocked: ${unavailableCrew.first_name} ${unavailableCrew.last_name} is ${unavailableCrew.status} or has reached the duty limit.`;
    }
    const assignedCabinCrew = cabinAssignments.filter((item) => item.schedule_id === activeSchedule.id).length;
    if (assignedCabinCrew !== activeSchedule.cabin_crew_required) {
      return `Blocked: ${activeSchedule.cabin_crew_required} cabin crew required, ${assignedCabinCrew} assigned.`;
    }
    return "Departure time has passed. Automatic launch is pending; any database error will now be displayed above.";
  }, [activeSchedule, legs, aircraft, crew, cabinAssignments, refreshNonce]);
  const passiveAircraftPosition = useMemo(() => {
    const flyingLeg = legs.find((leg) => leg.status === "flying" && leg.operation_mode === "passive");
    if (!flyingLeg?.scheduled_departure_at || !flyingLeg.scheduled_arrival_at) return undefined;
    const origin = airportByIcao[flyingLeg.origin_icao];
    const destination = airportByIcao[flyingLeg.dest_icao];
    if (!origin || !destination) return undefined;
    const departure = new Date(flyingLeg.scheduled_departure_at).getTime();
    const arrival = new Date(flyingLeg.scheduled_arrival_at).getTime();
    const progress = Math.max(0, Math.min(1, (Date.now() - departure) / Math.max(1, arrival - departure)));
    const dLon = (destination.lon - origin.lon) * Math.PI / 180;
    const lat1 = origin.lat * Math.PI / 180;
    const lat2 = destination.lat * Math.PI / 180;
    const y = Math.sin(dLon) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
    return {
      lat: origin.lat + (destination.lat - origin.lat) * progress,
      lon: origin.lon + (destination.lon - origin.lon) * progress,
      heading: (Math.atan2(y, x) * 180 / Math.PI + 360) % 360,
    };
  }, [legs, refreshNonce]);

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
          <label><FieldLabel>First departure</FieldLabel><input type="datetime-local" required value={startAt} onChange={(event) => { setStartAt(event.target.value); setPreview(null); }} className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-sm text-white outline-none focus:border-brand-500/50" /></label>
          <NumberField label="Ground time (min)" value={groundMinutes} onChange={setGroundMinutes} min={15} max={720} />
          <label className="flex items-end gap-3 pb-2 text-sm text-slate-300">
            <input type="checkbox" checked={passiveEnabled} onChange={(event) => { setPassiveEnabled(event.target.checked); setPreview(null); }} className="h-4 w-4 accent-cyan-500" />
            Passive operations
          </label>
          {passiveEnabled && <>
            <label><FieldLabel>Simulation speed</FieldLabel><Select value={timeScale} onChange={(value) => { setTimeScale(value); setPreview(null); }} options={[{ value: "6", label: "6× · 2h flight in 20 min" }, { value: "12", label: "12× · 2h flight in 10 min" }, { value: "24", label: "24× · 2h flight in 5 min" }, { value: "1", label: "1× · Real time" }]} /></label>
            <label><FieldLabel>Captain</FieldLabel><Select value={captainId} onChange={setCaptainId} placeholder="Select captain" options={crew.filter((member) => member.rank === "captain").map((member) => ({ value: member.id, label: `${member.first_name} ${member.last_name} · ${member.status}` }))} /></label>
            <label><FieldLabel>First officer</FieldLabel><Select value={firstOfficerId} onChange={setFirstOfficerId} placeholder="Select first officer" options={crew.filter((member) => member.rank === "first_officer").map((member) => ({ value: member.id, label: `${member.first_name} ${member.last_name} · ${member.status}` }))} /></label>
            {requiredCabinCrew > 0 && <div className="xl:col-span-2"><FieldLabel>Cabin crew · {cabinCrewIds.length}/{requiredCabinCrew}</FieldLabel><div className="grid gap-2 sm:grid-cols-2">{crew.filter((member) => member.rank === "cabin_crew").map((member) => {
              const selected = cabinCrewIds.includes(member.id);
              return <button key={member.id} type="button" onClick={() => setCabinCrewIds((current) => selected ? current.filter((id) => id !== member.id) : current.length < requiredCabinCrew ? [...current, member.id] : current)} className={`rounded-lg border px-3 py-2 text-left text-xs transition-colors ${selected ? "border-brand-400/40 bg-brand-500/10 text-brand-200" : "border-white/[0.08] bg-white/[0.02] text-slate-400 hover:bg-white/[0.05]"}`}><span className="font-semibold">{member.first_name} {member.last_name}</span><span className="float-right uppercase">{member.status}</span></button>;
            })}</div>{crew.filter((member) => member.rank === "cabin_crew").length < requiredCabinCrew && <p className="mt-2 text-xs text-amber-300">Hire at least {requiredCabinCrew} cabin crew members for this aircraft.</p>}</div>}
          </>}
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
        {aircraftScheduleConflict && <div className="flex items-center gap-2 text-xs text-amber-300"><TriangleAlert className="h-3.5 w-3.5" />This aircraft is already assigned to {aircraftScheduleConflict.name}. Cancel or complete it before saving another schedule.</div>}
      </form>

      {!preview && schedules.length > 0 && <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">{schedules.map((schedule) => {
        const assignedAircraft = aircraft.find((plane) => plane.id === schedule.aircraft_id);
        return <button key={schedule.id} type="button" onClick={() => setSelectedScheduleId(schedule.id)} className={`rounded-xl border p-3 text-left transition-all ${selectedScheduleId === schedule.id ? "border-brand-500/30 bg-brand-500/[0.07]" : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]"}`}><div className="flex items-center justify-between"><span className="truncate text-sm font-semibold text-white">{schedule.name}</span><span className="ml-2 text-[10px] uppercase text-slate-500">{schedule.status}</span></div><div className="mt-2 flex items-center gap-2 text-xs text-slate-400"><Plane className="h-3.5 w-3.5 text-brand-300" /><span className="font-mono font-semibold text-brand-200">{assignedAircraft?.registration ?? assignedAircraft?.name ?? "Unknown aircraft"}</span><span className="ml-auto">{assignedAircraft?.icao_type}</span></div></button>;
      })}</div>}

      {!preview && schedules.length > 0 && <div className="flex items-center justify-between">
        <div className="w-full max-w-md"><Select value={selectedScheduleId} onChange={setSelectedScheduleId} options={schedules.map((item) => ({ value: item.id, label: `${item.name} · ${item.status}` }))} /></div>
        <div className="ml-3 flex items-center gap-2">
          {nextLeg && !activeSchedule?.passive_enabled && nextLeg.operation_mode !== "passive" && <button disabled={creatingDispatch} onClick={() => void createDispatch()} className="flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-400 disabled:opacity-50">
            <Play className="h-4 w-4" /> {creatingDispatch ? "Creating..." : `Prepare ${nextLeg.flight_number}`}
          </button>}
          {activeSchedule?.status === "active" && <button onClick={() => void cancelSchedule()} className="flex items-center gap-2 rounded-xl border border-red-500/20 px-3 py-2.5 text-sm text-red-300 hover:bg-red-500/[0.06]" title="Cancel schedule">
            <X className="h-4 w-4" /> Cancel
          </button>}
          {activeSchedule && <button onClick={() => setDeleteConfirmationOpen(true)} className="flex items-center gap-2 rounded-xl border border-red-500/20 px-3 py-2.5 text-sm text-red-300 hover:bg-red-500/[0.06]" title="Delete schedule"><Trash2 className="h-4 w-4" /> Delete</button>}
        </div>
      </div>}

      {displayedLegs.length > 0 && <>
        <div className="grid gap-4 md:grid-cols-4">
          <Stat label="Flights" value={String(displayedLegs.length)} icon={Plane} />
          <Stat label="Rotations" value={String(preview?.rotations.length ?? rotations.length)} icon={CalendarDays} />
          <Stat label="Flight time" value={minutesLabel(preview?.totalMinutes ?? legs.reduce((sum, leg) => sum + leg.estimated_minutes, 0))} icon={Clock3} />
          <Stat label="Final position" value={preview?.finalAirportIcao ?? displayedFinalAirport} icon={MapPin} />
        </div>
        {activeSchedule?.passive_enabled && <div className="rounded-xl border border-brand-500/15 bg-brand-500/[0.04] px-4 py-3 text-xs text-brand-200"><div className="flex items-center gap-2"><Users className="h-4 w-4" />Passive crew: {crew.find((member) => member.id === activeSchedule.captain_id)?.last_name ?? "Captain"} / {crew.find((member) => member.id === activeSchedule.first_officer_id)?.last_name ?? "First officer"} / {cabinAssignments.filter((assignment) => assignment.schedule_id === activeSchedule.id).length} cabin crew<span className="ml-auto rounded-full bg-brand-500/10 px-2 py-1 font-mono font-bold">{activeSchedule.time_scale}× speed</span></div>{passiveWaitMessage && <div className="mt-2 border-t border-brand-500/10 pt-2 text-slate-300">{passiveWaitMessage}</div>}</div>}
        <FlightMap routes={routeArcs} aircraft={passiveAircraftPosition} origin={airportByIcao[activeSchedule?.start_airport_icao ?? selectedAircraft?.current_airport_icao ?? company.hub_icao]} height="320px" interactive />
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
              <div className="flex items-center gap-4 text-xs text-slate-500"><span className="hidden xl:inline">{dateTimeLabel(generated ? leg.scheduledDeparture : leg.scheduled_departure_at)}</span><span>{generated ? leg.distanceNm : leg.distance_nm} nm</span><span>{minutesLabel(generated ? leg.estimatedMinutes : leg.estimated_minutes)}</span><span className="w-20 text-right uppercase text-slate-400">{status}</span></div>
            </div>;
          })}</div>
        </div>)}
      </div>

      {!preview && schedules.length === 0 && <div className="rounded-xl border border-dashed border-white/[0.08] py-16 text-center text-sm text-slate-500">Generate your first continuous aircraft schedule above.</div>}
      <ConfirmDialog open={deleteConfirmationOpen} title="Delete this schedule?" description={activeSchedule ? <>The schedule <strong className="text-white">{activeSchedule.name}</strong> assigned to <strong className="text-white">{aircraft.find((plane) => plane.id === activeSchedule.aircraft_id)?.registration ?? aircraft.find((plane) => plane.id === activeSchedule.aircraft_id)?.name ?? "this aircraft"}</strong> and all remaining rotations will be removed. Completed flight history is preserved.</> : null} confirmLabel="Delete schedule" destructive loading={deletingSchedule} onCancel={() => { if (!deletingSchedule) setDeleteConfirmationOpen(false); }} onConfirm={() => void deleteSchedule()} />
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
