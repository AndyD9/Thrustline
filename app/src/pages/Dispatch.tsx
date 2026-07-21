import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useCompany } from "@/contexts/CompanyContext";
import { useSim } from "@/contexts/SimContext";
import { Select } from "@/components/Select";
import { Plane, Plus, X, Play, Ban, Trash2, Radio, Users, Mountain, AlertTriangle, ExternalLink, Download, Loader2, FileText, Megaphone, Tag, ClipboardCheck, UserRoundCheck, CircleCheck, Undo2 } from "lucide-react";
import type { Aircraft, Dispatch as DispatchT, DispatchStatus, MarketingCampaign } from "@/lib/database.types";
import AirportPicker from "@/components/AirportPicker";
import FlightMap from "@/components/FlightMap";
import { airportByIcao } from "@/data/airports";
import { aircraftTypeByIcao } from "@/data/aircraftTypes";
import { haversineNm } from "@/lib/geo";
import { fetchOFP, buildSimbriefUrl, type SimBriefOFP } from "@/lib/simbrief";
import { useUnits } from "@/contexts/UnitsContext";
import { computePaxDemand } from "@/lib/paxDemand";
import { open as shellOpen } from "@tauri-apps/plugin-shell";
import OFPSummary from "@/components/OFPSummary";
import ConfirmDialog from "@/components/ConfirmDialog";
import BoardingProgressPanel from "@/components/BoardingProgressPanel";
import { computeBoardingProgress } from "@/lib/boarding";
import { setActiveFlightContext } from "@/lib/simBridge";

const statusConfig: Record<DispatchStatus, { bg: string; text: string; dot: string }> = {
  pending:    { bg: "bg-slate-500/10 border-slate-500/20",   text: "text-slate-300",   dot: "bg-slate-400" },
  dispatched: { bg: "bg-blue-500/10 border-blue-500/20",     text: "text-blue-300",    dot: "bg-blue-400" },
  preflight:  { bg: "bg-cyan-500/10 border-cyan-500/20",     text: "text-cyan-300",    dot: "bg-cyan-400" },
  boarding:   { bg: "bg-violet-500/10 border-violet-500/20", text: "text-violet-300",  dot: "bg-violet-400" },
  ready:      { bg: "bg-amber-500/10 border-amber-500/20",   text: "text-amber-300",   dot: "bg-amber-400" },
  flying:     { bg: "bg-brand-500/10 border-brand-500/20",   text: "text-brand-300",   dot: "bg-brand-400" },
  completed:  { bg: "bg-emerald-500/10 border-emerald-500/20", text: "text-emerald-300", dot: "bg-emerald-400" },
  cancelled:  { bg: "bg-red-500/10 border-red-500/20",       text: "text-red-300",     dot: "bg-red-400" },
};

export default function DispatchPage() {
  const { company } = useCompany();
  const { latest, simActive } = useSim();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [dispatches, setDispatches] = useState<DispatchT[]>([]);
  const [aircraft, setAircraft] = useState<Aircraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingDispatch, setEditingDispatch] = useState<DispatchT | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [dispatchToDelete, setDispatchToDelete] = useState<DispatchT | null>(null);
  const [dispatchToReset, setDispatchToReset] = useState<DispatchT | null>(null);
  const [confirmingAction, setConfirmingAction] = useState(false);
  const [boardingNow, setBoardingNow] = useState(Date.now());
  const completingBoarding = useRef(new Set<string>());

  const fetchDispatches = async () => {
    if (!company) return;
    setLoading(true);
    const { data } = await supabase
      .from("dispatches")
      .select("*")
      .eq("company_id", company.id)
      .order("created_at", { ascending: false })
      .limit(50);
    setDispatches((data as DispatchT[]) ?? []);
    setLoading(false);
  };

  const fetchAircraft = async () => {
    if (!company) return;
    const { data } = await supabase
      .from("aircraft")
      .select("*")
      .eq("company_id", company.id)
      .is("disposed_at", null)
      .order("name");
    setAircraft((data as Aircraft[]) ?? []);
  };

  useEffect(() => {
    void fetchDispatches();
    void fetchAircraft();
  }, [company?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const editId = searchParams.get("edit");
    if (!editId || dispatches.length === 0) return;
    const dispatch = dispatches.find((item) => item.id === editId && item.status === "pending");
    if (dispatch) {
      setEditingDispatch(dispatch);
      setShowForm(true);
    }
  }, [dispatches, searchParams]);

  const updateStatus = async (id: string, status: DispatchStatus): Promise<boolean> => {
    setActionError(null);
    const dispatch = dispatches.find((item) => item.id === id);
    if (!dispatch) {
      setActionError("Dispatch not found.");
      return false;
    }
    if (status === "flying" && (
      dispatch.status !== "ready" ||
      dispatch.boarded_pax_eco !== dispatch.pax_eco ||
      dispatch.boarded_pax_biz !== dispatch.pax_biz
    )) {
      setActionError("Passenger boarding must be complete before starting the flight.");
      return false;
    }
    if (status === "flying" && (!simActive || !latest?.onGround)) {
      setActionError(
        !simActive
          ? "Start MSFS and load an aircraft before starting the flight."
          : "The aircraft must be detected on the ground before the flight can start.",
      );
      return false;
    }
    const now = new Date().toISOString();
    const statusUpdate: Partial<DispatchT> = { status };
    if (status === "boarding") {
      statusUpdate.boarded_pax_eco = 0;
      statusUpdate.boarded_pax_biz = 0;
      statusUpdate.boarding_started_at = now;
      statusUpdate.boarding_completed_at = null;
    } else if (status === "ready") {
      statusUpdate.boarded_pax_eco = dispatch.pax_eco;
      statusUpdate.boarded_pax_biz = dispatch.pax_biz;
      statusUpdate.boarding_completed_at = now;
    } else if (status === "preflight") {
      statusUpdate.boarded_pax_eco = 0;
      statusUpdate.boarded_pax_biz = 0;
      statusUpdate.boarding_started_at = null;
      statusUpdate.boarding_completed_at = null;
    }
    const { error: updateError } = await supabase.from("dispatches").update(statusUpdate).eq("id", id);
    if (updateError) {
      setActionError(updateError.message);
      return false;
    }
    if (status === "flying") {
      await setActiveFlightContext({
        dispatchId: dispatch.id,
        companyId: dispatch.company_id,
        economyPassengers: dispatch.boarded_pax_eco,
        businessPassengers: dispatch.boarded_pax_biz,
      });
      await supabase.from("schedule_legs").update({ status: "flying" }).eq("dispatch_id", id);
    } else if (status === "cancelled") {
      await supabase.from("schedule_legs").update({ status: "available", dispatch_id: null }).eq("dispatch_id", id);
    } else if (["dispatched", "preflight", "boarding", "ready"].includes(status)) {
      await supabase.from("schedule_legs").update({ status: "dispatched" }).eq("dispatch_id", id);
    }
    await fetchDispatches();
    return true;
  };

  useEffect(() => {
    if (!dispatches.some((dispatch) => dispatch.status === "boarding")) return;
    const timer = window.setInterval(() => setBoardingNow(Date.now()), 500);
    return () => window.clearInterval(timer);
  }, [dispatches]);

  useEffect(() => {
    for (const dispatch of dispatches) {
      if (dispatch.status !== "boarding" || completingBoarding.current.has(dispatch.id)) continue;
      if (!computeBoardingProgress(dispatch, boardingNow).complete) continue;
      completingBoarding.current.add(dispatch.id);
      void updateStatus(dispatch.id, "ready").finally(() => completingBoarding.current.delete(dispatch.id));
    }
  }, [boardingNow, dispatches]); // eslint-disable-line react-hooks/exhaustive-deps

  const deleteDispatch = async (dispatch: DispatchT) => {
    if (dispatch.status === "flying" || dispatch.status === "completed") return;
    setConfirmingAction(true);
    setActionError(null);

    // A scheduled leg must become available again before its dispatch is removed.
    const { data: linkedLegs, error: legReadError } = await supabase
      .from("schedule_legs")
      .select("id, status")
      .eq("dispatch_id", dispatch.id);
    if (legReadError) {
      setActionError(legReadError.message);
      setConfirmingAction(false);
      return;
    }

    if (linkedLegs.length > 0) {
      const { error: legUpdateError } = await supabase
        .from("schedule_legs")
        .update({ status: "available", dispatch_id: null })
        .eq("dispatch_id", dispatch.id);
      if (legUpdateError) {
        setActionError(legUpdateError.message);
        setConfirmingAction(false);
        return;
      }
    }

    const { error: deleteError } = await supabase
      .from("dispatches")
      .delete()
      .eq("id", dispatch.id);
    if (deleteError) {
      // Best-effort rollback so a scheduled leg is not silently detached.
      await Promise.all(linkedLegs.map((leg) => supabase
        .from("schedule_legs")
        .update({ status: leg.status, dispatch_id: dispatch.id })
        .eq("id", leg.id)));
      setActionError(deleteError.message);
      setConfirmingAction(false);
      return;
    }

    await fetchDispatches();
    setConfirmingAction(false);
    setDispatchToDelete(null);
  };

  if (!company) return null;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dispatch</h1>
          <p className="text-sm text-slate-400">{dispatches.length} dispatches</p>
        </div>
        <button
          onClick={() => {
            setEditingDispatch(null);
            setSearchParams({});
            setShowForm((s) => !s);
          }}
          className="flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-brand-400 hover:shadow-[0_0_20px_oklch(0.58_0.18_195_/_0.25)]"
        >
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? "Cancel" : "New dispatch"}
        </button>
      </div>

      {actionError && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-3 text-sm text-red-300">
          {actionError}
        </div>
      )}

      {showForm && (
        <NewDispatchForm
          companyId={company.id}
          userId={company.user_id}
          airlineCode={company.airline_code}
          hubIcao={company.hub_icao}
          aircraft={aircraft}
          simbriefUsername={company.simbrief_username ?? ""}
          initialDispatch={editingDispatch}
          onDone={() => {
            setShowForm(false);
            setEditingDispatch(null);
            setSearchParams({});
            void fetchDispatches();
          }}
        />
      )}

      {loading ? (
        <div className="text-slate-400">Loading...</div>
      ) : dispatches.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.02] py-16 text-center">
          <Plane className="mb-3 h-8 w-8 text-slate-600" />
          <div className="text-sm text-slate-400">No dispatches yet. Create one and set it to "flying" before takeoff.</div>
        </div>
      ) : (
        <div className="space-y-3">
          {dispatches.map((d) => {
            const cfg = statusConfig[d.status];
            const savedOfp = parseDispatchOFP(d.ofp_data);
            return (
              <div
                key={d.id}
                className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-4 transition-all hover:bg-white/[0.03]"
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    {/* Flight number + status */}
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-lg font-bold text-white">
                        {d.flight_number}
                      </span>
                      <span
                        className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${cfg.bg} ${cfg.text}`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot} ${d.status === "flying" ? "animate-pulse" : ""}`} />
                        {d.status}
                      </span>
                    </div>

                    {/* Route visualization */}
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2.5 font-mono text-sm">
                        <span className="font-semibold text-white">{d.origin_icao}</span>
                        <div className="flex items-center gap-1">
                          <div className="h-px w-8 bg-gradient-to-r from-brand-500/60 to-brand-500/20" />
                          <Plane className="h-3.5 w-3.5 text-brand-400 -rotate-45" />
                          <div className="h-px w-8 bg-gradient-to-l from-brand-500/60 to-brand-500/20" />
                        </div>
                        <span className="font-semibold text-white">{d.dest_icao}</span>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-slate-500">
                        <span className="font-mono">{d.icao_type}</span>
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {d.pax_eco}Y + {d.pax_biz}J
                        </span>
                        <span className="flex items-center gap-1">
                          <Mountain className="h-3 w-3" />
                          FL{(d.cruise_alt / 100).toFixed(0)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    {d.status === "pending" && (
                      <>
                        <ActionBtn label="Flight plan" icon={FileText} onClick={() => {
                          setEditingDispatch(d);
                          setShowForm(true);
                          setSearchParams({ edit: d.id });
                        }} />
                        <ActionBtn label="Dispatch" icon={Play} onClick={() => void updateStatus(d.id, "dispatched")} />
                        <ActionBtn label="Cancel" icon={Ban} variant="danger" onClick={() => void updateStatus(d.id, "cancelled")} />
                        <ActionBtn label="Delete" icon={Trash2} variant="danger" onClick={() => setDispatchToDelete(d)} />
                      </>
                    )}
                    {d.status === "dispatched" && (
                      <>
                        <ActionBtn label="Start pre-flight" icon={ClipboardCheck} variant="primary" onClick={() => void updateStatus(d.id, "preflight")} />
                        <ActionBtn label="Cancel" icon={Ban} variant="danger" onClick={() => void updateStatus(d.id, "cancelled")} />
                        <ActionBtn label="Delete" icon={Trash2} variant="danger" onClick={() => setDispatchToDelete(d)} />
                      </>
                    )}
                    {d.status === "preflight" && (
                      <>
                        <ActionBtn label="Start boarding" icon={Users} variant="primary" onClick={() => void updateStatus(d.id, "boarding")} />
                        <ActionBtn label="Cancel" icon={Ban} variant="danger" onClick={() => void updateStatus(d.id, "cancelled")} />
                        <ActionBtn label="Delete" icon={Trash2} variant="danger" onClick={() => setDispatchToDelete(d)} />
                      </>
                    )}
                    {d.status === "boarding" && (
                      <>
                        <ActionBtn label="Finish now" icon={UserRoundCheck} variant="primary" onClick={() => void updateStatus(d.id, "ready")} />
                        <ActionBtn label="Back to pre-flight" icon={Undo2} onClick={() => void updateStatus(d.id, "preflight")} />
                        <ActionBtn label="Cancel" icon={Ban} variant="danger" onClick={() => void updateStatus(d.id, "cancelled")} />
                        <ActionBtn label="Delete" icon={Trash2} variant="danger" onClick={() => setDispatchToDelete(d)} />
                      </>
                    )}
                    {d.status === "ready" && (
                      <>
                        <ActionBtn
                          label="Start flight"
                          icon={CircleCheck}
                          variant="primary"
                          disabled={!simActive || !latest?.onGround}
                          title={!simActive
                            ? "Waiting for MSFS and a loaded aircraft"
                            : !latest?.onGround
                              ? "The aircraft must be on the ground"
                              : "Start flight"}
                          onClick={async () => {
                            if (await updateStatus(d.id, "flying")) {
                              navigate(`/live-flight?dispatch=${d.id}`);
                            }
                          }}
                        />
                        <ActionBtn label="Back to boarding" icon={Undo2} onClick={() => void updateStatus(d.id, "boarding")} />
                        <ActionBtn label="Cancel" icon={Ban} variant="danger" onClick={() => void updateStatus(d.id, "cancelled")} />
                        <ActionBtn label="Delete" icon={Trash2} variant="danger" onClick={() => setDispatchToDelete(d)} />
                      </>
                    )}
                    {d.status === "cancelled" && (
                      <ActionBtn label="Delete" icon={Trash2} variant="danger" onClick={() => setDispatchToDelete(d)} />
                    )}
                    {d.status === "flying" && (
                      <>
                        <span className="flex items-center gap-2 text-xs text-brand-300">
                          <Radio className="h-3.5 w-3.5 animate-pulse" />
                          In flight
                        </span>
                        <ActionBtn label="Not departed" icon={Undo2} variant="danger" onClick={() => setDispatchToReset(d)} />
                      </>
                    )}
                  </div>
                </div>

                {d.status === "boarding" && (
                  <BoardingProgressPanel dispatch={d} nowMs={boardingNow} />
                )}

                {d.status === "ready" && (
                  <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.035] px-4 py-3 text-xs text-emerald-300">
                    <UserRoundCheck className="h-4 w-4" />
                    Boarding complete — {d.boarded_pax_eco + d.boarded_pax_biz} passengers on board
                  </div>
                )}

                {savedOfp && ["dispatched", "preflight", "boarding", "ready", "flying"].includes(d.status) && (
                  <OFPSummary
                    ofp={savedOfp}
                    defaultOpen={d.status === "preflight" || d.status === "flying"}
                    onRefresh={company.simbrief_username ? async () => {
                      setActionError(null);
                      const refreshed = await fetchOFP(company.simbrief_username ?? "");
                      if (!refreshed) {
                        setActionError("Could not refresh the latest SimBrief OFP.");
                        return;
                      }
                      if (refreshed.origin.icao !== d.origin_icao || refreshed.destination.icao !== d.dest_icao) {
                        setActionError(`Latest SimBrief OFP is ${refreshed.origin.icao} → ${refreshed.destination.icao}, expected ${d.origin_icao} → ${d.dest_icao}.`);
                        return;
                      }
                      const { error: refreshError } = await supabase
                        .from("dispatches")
                        .update({ ofp_data: JSON.stringify(refreshed) })
                        .eq("id", d.id);
                      if (refreshError) {
                        setActionError(refreshError.message);
                        return;
                      }
                      await fetchDispatches();
                    } : undefined}
                  />
                )}

                <div className="mt-2 text-[11px] text-slate-600">
                  Created {new Date(d.created_at).toLocaleString()}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={dispatchToDelete !== null}
        title="Delete dispatch?"
        description={dispatchToDelete && (
          <>
            Dispatch <strong className="font-mono text-white">{dispatchToDelete.flight_number}</strong> for {dispatchToDelete.origin_icao} → {dispatchToDelete.dest_icao} will be permanently deleted.
            A linked schedule leg will become available again.
          </>
        )}
        confirmLabel="Delete dispatch"
        destructive
        loading={confirmingAction}
        onCancel={() => setDispatchToDelete(null)}
        onConfirm={() => {
          if (dispatchToDelete) void deleteDispatch(dispatchToDelete);
        }}
      />

      <ConfirmDialog
        open={dispatchToReset !== null}
        title="Return to pre-flight?"
        description={dispatchToReset && (
          <>
            Only continue if <strong className="font-mono text-white">{dispatchToReset.flight_number}</strong> has not taken off. Its status will return to pre-flight.
          </>
        )}
        confirmLabel="Return to pre-flight"
        onCancel={() => setDispatchToReset(null)}
        onConfirm={() => {
          if (!dispatchToReset) return;
          void updateStatus(dispatchToReset.id, "preflight");
          setDispatchToReset(null);
        }}
      />
    </div>
  );
}

function parseDispatchOFP(value: DispatchT["ofp_data"]): SimBriefOFP | null {
  if (!value) return null;
  try {
    return (typeof value === "string" ? JSON.parse(value) : value) as SimBriefOFP;
  } catch {
    return null;
  }
}

/* ---------- Action button ---------- */

function ActionBtn({
  label,
  icon: Icon,
  onClick,
  variant = "default",
  disabled = false,
  title,
}: {
  label: string;
  icon: typeof Play;
  onClick: () => void;
  variant?: "default" | "primary" | "danger";
  disabled?: boolean;
  title?: string;
}) {
  const variants = {
    default: "border border-white/[0.08] text-slate-300 hover:border-white/[0.15] hover:text-white",
    primary: "bg-brand-500 text-white hover:bg-brand-400 hover:shadow-[0_0_16px_oklch(0.58_0.18_195_/_0.2)]",
    danger: "border border-red-500/20 text-red-400 hover:bg-red-500/[0.06]",
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all ${variants[variant]} disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:shadow-none`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

/* ---------- New Dispatch Form ---------- */

function formatEte(distNm: number, speedKts: number): string {
  if (!speedKts) return "";
  const min = Math.round((distNm / speedKts) * 60);
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `~${h}h ${m.toString().padStart(2, "0")}m`;
}

function NewDispatchForm({
  companyId,
  userId,
  airlineCode,
  hubIcao,
  aircraft,
  simbriefUsername,
  initialDispatch,
  onDone,
}: {
  companyId: string;
  userId: string;
  airlineCode: string;
  hubIcao: string;
  aircraft: Aircraft[];
  simbriefUsername: string;
  initialDispatch: DispatchT | null;
  onDone: () => void;
}) {
  const { fmt } = useUnits();

  const initialAircraft = aircraft.find((item) => item.id === initialDispatch?.aircraft_id) ?? aircraft[0];
  const [originIcao, setOriginIcao] = useState(initialDispatch?.origin_icao ?? initialAircraft?.current_airport_icao ?? hubIcao);
  const [destIcao, setDestIcao] = useState(initialDispatch?.dest_icao ?? "");
  const [repScore, setRepScore] = useState(50);
  const [aircraftId, setAircraftId] = useState(initialAircraft?.id ?? "");
  const [icaoType, setIcaoType] = useState(initialDispatch?.icao_type ?? initialAircraft?.icao_type ?? "");
  const [paxEco, setPaxEco] = useState(String(initialDispatch?.pax_eco ?? 160));
  const [paxBiz, setPaxBiz] = useState(String(initialDispatch?.pax_biz ?? 12));
  const [cargoKg, setCargoKg] = useState(String(initialDispatch?.cargo_kg ?? 0));
  const [cruiseAlt, setCruiseAlt] = useState(String(initialDispatch?.cruise_alt ?? 35000));
  const [estimFuelLbs, setEstimFuelLbs] = useState(String(initialDispatch?.estim_fuel_lbs ?? 0));
  const [flightNumber, setFlightNumber] = useState(initialDispatch?.flight_number ?? airlineCode + "001");
  const [callsign, setCallsign] = useState(initialDispatch?.flight_number ?? airlineCode + "001");
  const [departureRunway, setDepartureRunway] = useState("");
  const [arrivalRunway, setArrivalRunway] = useState("");
  const [blockHours, setBlockHours] = useState("0");
  const [blockMinutes, setBlockMinutes] = useState("0");
  const [blockTimeEdited, setBlockTimeEdited] = useState(false);
  const [manualZfwKg, setManualZfwKg] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // SimBrief OFP
  const [ofp, setOfp] = useState<SimBriefOFP | null>(() => {
    if (!initialDispatch?.ofp_data) return null;
    try {
      return (typeof initialDispatch.ofp_data === "string"
        ? JSON.parse(initialDispatch.ofp_data)
        : initialDispatch.ofp_data) as SimBriefOFP;
    } catch {
      return null;
    }
  });
  const [importingOFP, setImportingOFP] = useState(false);

  // Company management integration
  const [routePriceModifier, setRoutePriceModifier] = useState(1.0);
  const [activeCampaigns, setActiveCampaigns] = useState<MarketingCampaign[]>([]);
  const [campaignMultiplier, setCampaignMultiplier] = useState(1.0);

  // Derived
  const originApt = airportByIcao[originIcao];
  const destApt = airportByIcao[destIcao];
  const acType = aircraftTypeByIcao[icaoType];
  const routeDistanceNm =
    originApt && destApt
      ? Math.round(haversineNm(originApt.lat, originApt.lon, destApt.lat, destApt.lon))
      : null;
  const cruiseSpeed = acType?.cruiseSpeedKts ?? 450;
  const outOfRange = routeDistanceNm !== null && acType && routeDistanceNm > acType.rangeNm;

  useEffect(() => {
    if (blockTimeEdited || routeDistanceNm === null) return;
    const totalMinutes = Math.ceil((routeDistanceNm / cruiseSpeed) * 60) + 30;
    setBlockHours(String(Math.floor(totalMinutes / 60)));
    setBlockMinutes(String(totalMinutes % 60));
  }, [routeDistanceNm, cruiseSpeed, blockTimeEdited]);

  // Fetch reputation, route pricing, and active campaigns for this route
  useEffect(() => {
    if (!originIcao || !destIcao) {
      setRepScore(50);
      setRoutePriceModifier(1.0);
      setActiveCampaigns([]);
      setCampaignMultiplier(1.0);
      return;
    }

    // Reputation
    supabase
      .from("reputations")
      .select("score")
      .eq("company_id", companyId)
      .eq("origin_icao", originIcao)
      .eq("dest_icao", destIcao)
      .maybeSingle()
      .then(({ data }) => setRepScore(data?.score ?? 50));

    // Route price modifier
    supabase
      .from("routes")
      .select("price_modifier")
      .eq("company_id", companyId)
      .eq("origin_icao", originIcao)
      .eq("dest_icao", destIcao)
      .maybeSingle()
      .then(({ data }) => setRoutePriceModifier(data?.price_modifier ?? 1.0))
      .then(undefined, () => setRoutePriceModifier(1.0));

    // Active marketing campaigns affecting this route
    const routeKey = `${originIcao}-${destIcao}`;
    supabase
      .from("marketing_campaigns")
      .select("*")
      .eq("company_id", companyId)
      .gt("expires_at", new Date().toISOString())
      .then(({ data }) => {
        const campaigns = (data as MarketingCampaign[]) ?? [];
        const matching = campaigns.filter(
          (c) => c.scope === "global" || (c.scope === "route" && c.target_route === routeKey)
        );
        setActiveCampaigns(matching);
        const mult = matching.reduce((m, c) => m * c.demand_multiplier, 1.0);
        setCampaignMultiplier(mult);
      })
      .then(undefined, () => { setActiveCampaigns([]); setCampaignMultiplier(1.0); });
  }, [originIcao, destIcao, companyId]);

  // Dynamic pax demand (with pricing & campaign effects)
  const demand = originApt && destApt && acType && routeDistanceNm
    ? computePaxDemand({
        origin: originApt, dest: destApt, aircraftType: acType,
        distanceNm: routeDistanceNm, reputationScore: repScore,
        campaignMultiplier, priceModifier: routePriceModifier,
      })
    : null;

  // Auto-fill pax from dynamic demand (or fallback to max)
  const updatePaxFromDemand = (type: typeof acType, orig?: typeof originApt, dest?: typeof destApt) => {
    const o = orig ?? originApt;
    const d = dest ?? destApt;
    if (!type) return;
    if (!o || !d) {
      setPaxEco(String(type.maxPaxEco));
      setPaxBiz(String(type.maxPaxBiz));
      return;
    }
    const dist = Math.round(haversineNm(o.lat, o.lon, d.lat, d.lon));
    const demand = computePaxDemand({
      origin: o, dest: d, aircraftType: type, distanceNm: dist,
      campaignMultiplier, priceModifier: routePriceModifier,
    });
    setPaxEco(String(demand.eco));
    setPaxBiz(String(demand.biz));
  };

  const onAircraftChange = (id: string) => {
    setAircraftId(id);
    const ac = aircraft.find((a) => a.id === id);
    if (ac) {
      setIcaoType(ac.icao_type);
      setOriginIcao(ac.current_airport_icao ?? hubIcao);
      const type = aircraftTypeByIcao[ac.icao_type];
      if (type) updatePaxFromDemand(type);
    }
  };

  const applyOFP = (o: SimBriefOFP) => {
    if (o.general.cruiseAlt) setCruiseAlt(String(o.general.cruiseAlt));
    if (o.fuel.total) setEstimFuelLbs(String(o.fuel.total));
    if (o.weights.paxCount) setPaxEco(String(o.weights.paxCount));
  };

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const selectedAircraft = aircraft.find((item) => item.id === aircraftId);
      const currentAirport = selectedAircraft?.current_airport_icao ?? hubIcao;
      if (selectedAircraft && originIcao.trim().toUpperCase() !== currentAirport) {
        throw new Error(`${selectedAircraft.registration ?? selectedAircraft.name} is at ${currentAirport}. Reposition it before dispatching from ${originIcao}.`);
      }
      const values = {
        user_id: userId,
        company_id: companyId,
        aircraft_id: aircraftId || null,
        flight_number: flightNumber.trim().toUpperCase(),
        origin_icao: originIcao.trim().toUpperCase(),
        dest_icao: destIcao.trim().toUpperCase(),
        icao_type: icaoType.trim().toUpperCase(),
        pax_eco: Number(paxEco),
        pax_biz: Number(paxBiz),
        cargo_kg: Number(cargoKg),
        estim_fuel_lbs: Number(estimFuelLbs),
        cruise_alt: Number(cruiseAlt),
        status: "pending",
        ofp_data: ofp ? JSON.stringify(ofp) : null,
      } as const;
      const { error: saveError } = initialDispatch
        ? await supabase.from("dispatches").update(values).eq("id", initialDispatch.id)
        : await supabase.from("dispatches").insert(values);
      if (saveError) throw saveError;
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create dispatch");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="rounded-xl border border-brand-500/20 bg-brand-500/[0.03] p-5 space-y-5 animate-slide-up">
      <h2 className="text-[10px] uppercase tracking-[0.15em] text-slate-500">
        {initialDispatch ? `Flight preparation · ${initialDispatch.flight_number}` : "New dispatch"}
      </h2>

      {/* ── Step 1: Route ────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4">
        <AirportPicker label="Origin (ICAO)" value={originIcao} onChange={(v) => { setOriginIcao(v); if (acType) updatePaxFromDemand(acType, airportByIcao[v], destApt); }} placeholder="LFPG" required />
        <AirportPicker label="Destination (ICAO)" value={destIcao} onChange={(v) => { setDestIcao(v); if (acType) updatePaxFromDemand(acType, originApt, airportByIcao[v]); }} placeholder="KJFK" required />
      </div>

      {routeDistanceNm !== null && (
        <div className={`flex items-center gap-2 text-xs ${outOfRange ? "text-amber-400" : "text-slate-500"}`}>
          {outOfRange && <AlertTriangle className="h-3.5 w-3.5" />}
          <span className="font-mono font-semibold text-slate-300">{routeDistanceNm.toLocaleString()} nm</span>
          <span className="text-slate-600">·</span>
          <span>{formatEte(routeDistanceNm, cruiseSpeed)}</span>
          {acType && (
            <>
              <span className="text-slate-600">·</span>
              <span>Range: {acType.rangeNm.toLocaleString()} nm</span>
            </>
          )}
          {outOfRange && <span className="font-semibold"> — out of range!</span>}
        </div>
      )}

      {/* ── Step 2: Aircraft ─────────────────────────── */}
      <div>
        <label className="block">
          <span className="mb-1.5 block text-[10px] uppercase tracking-[0.15em] text-slate-400">Aircraft</span>
          <Select
            value={aircraftId}
            onChange={onAircraftChange}
            placeholder="Select aircraft..."
            options={aircraft.map((ac) => ({
              value: ac.id,
              label: `${ac.name} (${ac.icao_type})`,
            }))}
          />
        </label>

        {/* Aircraft specs pills */}
        {acType && (
          <div className="mt-2 flex flex-wrap gap-2">
            <Pill label="Type" value={icaoType} />
            <Pill label="Range" value={fmt.distance(acType.rangeNm)} />
            <Pill label="Max Pax" value={`${acType.maxPaxEco}Y + ${acType.maxPaxBiz}J`} />
            <Pill label="Fuel Cap" value={fmt.fuel(acType.fuelCapacityGal)} />
            <Pill label="Cruise" value={fmt.speed(acType.cruiseSpeedKts)} />
            <Pill label="Ceiling" value={fmt.altitude(acType.ceilingFt)} />
            <Pill label="Min Crew" value={`${acType.minPilots} pilots + ${acType.minCabin} cabin`} />
          </div>
        )}
      </div>

      {/* ── Step 3: Load ─────────────────────────────── */}

      {/* Active campaigns & pricing affecting this route */}
      {originIcao && destIcao && (activeCampaigns.length > 0 || routePriceModifier !== 1.0) && (
        <div className="space-y-1.5">
          {routePriceModifier !== 1.0 && (
            <div className={`flex items-center gap-2 text-xs ${routePriceModifier > 1 ? "text-amber-400" : "text-blue-400"}`}>
              <Tag className="h-3.5 w-3.5" />
              {routePriceModifier > 1 ? "Premium" : "Discount"} pricing active
              <span className="font-mono font-bold">
                {routePriceModifier > 1 ? "+" : ""}{Math.round((routePriceModifier - 1) * 100)}% price
              </span>
              <span className="text-slate-600">·</span>
              <span className="text-slate-500">
                {routePriceModifier > 1 ? "Higher revenue, fewer pax" : "Lower revenue, more pax"}
              </span>
            </div>
          )}
          {activeCampaigns.map((c) => {
            const remaining = Math.max(0, Math.ceil((new Date(c.expires_at).getTime() - Date.now()) / 86400000));
            return (
              <div key={c.id} className="flex items-center gap-2 text-xs text-brand-300">
                <Megaphone className="h-3.5 w-3.5" />
                {c.campaign_type.replace("_", " ")}
                <span className="font-mono font-bold">+{Math.round((c.demand_multiplier - 1) * 100)}% demand</span>
                <span className="text-slate-600">·</span>
                <span className="text-slate-500">{remaining}d remaining</span>
              </div>
            );
          })}
        </div>
      )}

      {demand && (
        <div className={`flex items-center gap-2 text-xs ${
          demand.loadFactor >= 0.80 ? "text-emerald-400" :
          demand.loadFactor >= 0.50 ? "text-amber-400" :
          "text-red-400"
        }`}>
          <Users className="h-3.5 w-3.5" />
          Demand: {Math.round(demand.loadFactor * 100)}% load factor
          <span className="text-slate-600">·</span>
          <span className="text-slate-400">{demand.eco}/{acType?.maxPaxEco} eco · {demand.biz}/{acType?.maxPaxBiz} biz</span>
          <span className="text-slate-600">·</span>
          <span className={repScore >= 70 ? "text-emerald-400" : repScore >= 40 ? "text-amber-400" : "text-red-400"}>
            Rep: {repScore}/100 ({(0.5 + repScore / 100).toFixed(1)}x)
          </span>
          {campaignMultiplier > 1 && (
            <>
              <span className="text-slate-600">·</span>
              <span className="text-brand-300">
                <Megaphone className="mr-1 inline h-3 w-3" />
                +{Math.round((campaignMultiplier - 1) * 100)}%
              </span>
            </>
          )}
        </div>
      )}
      <div className="grid grid-cols-3 gap-4">
        <FieldWithMax label="Pax economy" value={paxEco} onChange={setPaxEco} type="number" required max={acType?.maxPaxEco} />
        <FieldWithMax label="Pax business" value={paxBiz} onChange={setPaxBiz} type="number" required max={acType?.maxPaxBiz} />
        <Field label="Cargo (kg)" value={cargoKg} onChange={setCargoKg} type="number" />
      </div>

      {/* ── Step 4: Flight ID ────────────────────────── */}
      <div className="grid grid-cols-2 gap-4">
        <Field label="Flight number" value={flightNumber} onChange={(v) => setFlightNumber(v.toUpperCase())} placeholder={`${airlineCode}001`} required />
        <Field label="Callsign" value={callsign} onChange={(v) => setCallsign(v.toUpperCase())} placeholder={`${airlineCode}001`} />
      </div>

      <div className="space-y-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.15em] text-slate-400">SimBrief options</div>
          <div className="mt-1 text-[11px] text-slate-600">Pre-filled on SimBrief and still editable there. Leave runway and ZFW blank for AUTO.</div>
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-6">
          <Field label="Block hours" value={blockHours} onChange={(value) => { setBlockHours(value); setBlockTimeEdited(true); }} type="number" />
          <Field label="Block minutes" value={blockMinutes} onChange={(value) => { setBlockMinutes(value); setBlockTimeEdited(true); }} type="number" />
          <Field label="Departure runway" value={departureRunway} onChange={(value) => setDepartureRunway(value.toUpperCase())} placeholder="AUTO" />
          <Field label="Arrival runway" value={arrivalRunway} onChange={(value) => setArrivalRunway(value.toUpperCase())} placeholder="AUTO" />
          <Field label="Altitude (ft)" value={cruiseAlt} onChange={setCruiseAlt} type="number" placeholder="AUTO" />
          <Field label="Manual ZFW (kg)" value={manualZfwKg} onChange={setManualZfwKg} type="number" placeholder="AUTO" />
        </div>
        <div className="text-[10px] text-slate-600">
          Passengers: {Number(paxEco) + Number(paxBiz)} · Freight: {Number(cargoKg).toLocaleString()} kg
          {Number(manualZfwKg) > 0 && " · Manual ZFW overrides SimBrief's calculated payload/freight."}
        </div>
      </div>

      {/* ── Step 5: SimBrief ─────────────────────────── */}
      {simbriefUsername && (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              if (!originIcao || !destIcao || !icaoType) {
                setError("Fill origin, destination and aircraft first");
                return;
              }
              const selectedAc = aircraft.find((a) => a.id === aircraftId);
              void shellOpen(buildSimbriefUrl({
                origin: originIcao,
                dest: destIcao,
                icaoType,
                airline: airlineCode,
                flightNumber: flightNumber.replace(airlineCode, ""),
                callsign,
                pax: Number(paxEco) + Number(paxBiz),
                cargoKg: Number(cargoKg),
                manualZfwKg: Number(manualZfwKg) || undefined,
                scheduledBlockHours: Number(blockHours),
                scheduledBlockMinutes: Number(blockMinutes),
                departureRunway: departureRunway.trim() || undefined,
                arrivalRunway: arrivalRunway.trim() || undefined,
                altitudeFt: Number(cruiseAlt) || undefined,
                simbriefAircraftId: selectedAc?.simbrief_aircraft_id,
                registration: selectedAc?.registration,
              }));
            }}
            className="flex items-center gap-1.5 rounded-xl border border-white/[0.08] px-3 py-2 text-xs font-semibold text-slate-300 transition-all hover:border-white/[0.15] hover:text-white"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Generate on SimBrief
          </button>
          <button
            type="button"
            disabled={importingOFP}
            onClick={async () => {
              setImportingOFP(true);
              setError(null);
              let attempts = 0;
              const poll = async (): Promise<SimBriefOFP | null> => {
                const result = await fetchOFP(simbriefUsername);
                if (result) return result;
                if (++attempts >= 12) return null;
                await new Promise((r) => setTimeout(r, 5000));
                return poll();
              };
              const result = await poll();
              setImportingOFP(false);
              if (result) {
                setOfp(result);
                applyOFP(result);
              } else {
                setError("Could not fetch OFP. Generate a flight plan on SimBrief first.");
              }
            }}
            className="flex items-center gap-1.5 rounded-xl border border-brand-500/20 px-3 py-2 text-xs font-semibold text-brand-300 transition-all hover:bg-brand-500/[0.06]"
          >
            {importingOFP ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            {importingOFP ? "Fetching OFP..." : "Import OFP"}
          </button>
        </div>
      )}

      {/* ── Step 5: OFP Inline Resume ────────────────── */}
      {ofp && (
        <div className="space-y-3 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.03] p-4 animate-slide-up">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.15em] text-emerald-400">
            <FileText className="h-3.5 w-3.5" />
            OFP Imported
          </div>

          {/* Route */}
          <div className="font-mono text-xs text-slate-400 leading-relaxed break-all">
            {ofp.general.route || "Direct"}
          </div>

          {/* Key figures */}
          <div className="grid grid-cols-4 gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-600">Block Fuel</div>
              <div className="font-mono text-sm font-medium text-slate-200">{ofp.fuel.total.toLocaleString()} lbs</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-600">ZFW</div>
              <div className="font-mono text-sm font-medium text-slate-200">{ofp.weights.zfw.toLocaleString()} lbs</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-600">Cruise</div>
              <div className="font-mono text-sm font-medium text-slate-200">FL{(ofp.general.cruiseAlt / 100).toFixed(0)}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-600">Enroute</div>
              <div className="font-mono text-sm font-medium text-slate-200">{formatEte(0, 0).length ? "" : ""}{(() => { const s = ofp.times.estimEnroute; const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); return `${h}h ${m.toString().padStart(2, "0")}m`; })()}</div>
            </div>
          </div>

          {/* Map with waypoints */}
          <FlightMap
            origin={originApt}
            destination={destApt}
            waypoints={ofp.navlog.map((f) => [f.lat, f.lon] as [number, number])}
            height="180px"
            interactive={false}
          />
        </div>
      )}

      {/* Route map preview (only when no OFP — OFP section has its own map) */}
      {!ofp && routeDistanceNm !== null && (
        <FlightMap origin={originApt} destination={destApt} height="160px" interactive={false} />
      )}

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-2.5 text-xs text-red-300">{error}</div>
      )}

      {/* ── Submit ─────────────────────────────────── */}
      <button
        type="submit"
        disabled={submitting}
        className="rounded-xl bg-brand-500 px-6 py-2.5 text-sm font-semibold text-white transition-all hover:bg-brand-400 disabled:opacity-50"
      >
        {submitting ? "Saving..." : initialDispatch ? "Save flight plan" : "Create dispatch"}
      </button>
    </form>
  );
}

/* ---------- Spec pill ---------- */

function Pill({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-1 text-[11px]">
      <span className="text-slate-500">{label}</span>
      <span className="font-mono font-medium text-slate-200">{value}</span>
    </span>
  );
}

/* ---------- Field with max indicator ---------- */

function FieldWithMax({
  label,
  value,
  onChange,
  type = "text",
  required,
  max,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  max?: number;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline gap-1 text-[10px] uppercase tracking-[0.15em] text-slate-400">
        {label}
        {max !== undefined && <span className="text-slate-600 normal-case">/ {max}</span>}
      </span>
      <input
        type={type}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-sm text-slate-100 outline-none transition-all placeholder:text-slate-600 focus:border-brand-400/50"
      />
    </label>
  );
}

/* ---------- Reusable field ---------- */

function Field({
  label,
  value,
  onChange,
  placeholder,
  required,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] uppercase tracking-[0.15em] text-slate-400">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-sm text-slate-100 outline-none transition-all placeholder:text-slate-600 focus:border-brand-400/50"
      />
    </label>
  );
}
