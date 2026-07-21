import { useEffect, useMemo, useState } from "react";
import { CalendarClock, ChevronRight, Clock, DollarSign, Hash, Loader2, MapPin, Plane, RotateCcw, ShoppingCart, Users, Wrench, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useCompany } from "@/contexts/CompanyContext";
import { AircraftMarket } from "@/components/UsedAircraftMarket";
import type { Aircraft, AircraftLease, CrewMember, FlightSchedule, ScheduleLeg } from "@/lib/database.types";
import { advancePassiveOperations } from "@/lib/passiveOperations";
import ConfirmDialog from "@/components/ConfirmDialog";

const currency = (value: number) => value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
type DisposalQuote = { kind: "sale" | "lease_return"; gross_value?: number; commission?: number; net_value?: number; termination_fee?: number; condition_fee?: number; remaining_cancelled?: number; paid_amount_lost?: number };
type DisposalRequest = { aircraft: Aircraft; lease?: AircraftLease; quote: DisposalQuote };
type MaintenanceQuote = { aircraft_id: string; current_health: number; restored_health: number; health_restored: number; cost: number };
type MaintenanceRequest = { aircraft: Aircraft; quote: MaintenanceQuote };
type BuyoutRequest = { lease: AircraftLease; aircraftName: string };

export default function Fleet() {
  const { company, refetch: refetchCompany } = useCompany();
  const [aircraft, setAircraft] = useState<Aircraft[]>([]);
  const [leases, setLeases] = useState<AircraftLease[]>([]);
  const [schedules, setSchedules] = useState<FlightSchedule[]>([]);
  const [scheduleLegs, setScheduleLegs] = useState<ScheduleLeg[]>([]);
  const [crew, setCrew] = useState<CrewMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showMarket, setShowMarket] = useState(false);
  const [buyingOutId, setBuyingOutId] = useState<string | null>(null);
  const [buyoutRequest, setBuyoutRequest] = useState<BuyoutRequest | null>(null);
  const [quotingId, setQuotingId] = useState<string | null>(null);
  const [disposal, setDisposal] = useState<DisposalRequest | null>(null);
  const [disposing, setDisposing] = useState(false);
  const [maintenance, setMaintenance] = useState<MaintenanceRequest | null>(null);
  const [maintaining, setMaintaining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFleet = async () => {
    if (!company) return;
    setLoading(true);
    const [aircraftResult, leasesResult, schedulesResult, crewResult] = await Promise.all([
      supabase.from("aircraft").select("*").eq("company_id", company.id).is("disposed_at", null).order("created_at", { ascending: false }),
      supabase.from("aircraft_leases").select("*").eq("company_id", company.id),
      supabase.from("schedules").select("*").eq("company_id", company.id).in("status", ["planned", "active"]),
      supabase.from("crew_members").select("*").eq("company_id", company.id),
    ]);
    setAircraft((aircraftResult.data as Aircraft[]) ?? []);
    setLeases((leasesResult.data as AircraftLease[]) ?? []);
    const scheduleRows = (schedulesResult.data as FlightSchedule[]) ?? [];
    setSchedules(scheduleRows);
    setCrew((crewResult.data as CrewMember[]) ?? []);
    if (scheduleRows.length > 0) {
      const legsResult = await supabase.from("schedule_legs").select("*").in("schedule_id", scheduleRows.map((schedule) => schedule.id)).in("status", ["available", "flying"]);
      setScheduleLegs((legsResult.data as ScheduleLeg[]) ?? []);
      setError(aircraftResult.error?.message ?? leasesResult.error?.message ?? schedulesResult.error?.message ?? crewResult.error?.message ?? legsResult.error?.message ?? null);
    } else {
      setScheduleLegs([]);
      setError(aircraftResult.error?.message ?? leasesResult.error?.message ?? schedulesResult.error?.message ?? crewResult.error?.message ?? null);
    }
    setLoading(false);
  };

  useEffect(() => {
    void advancePassiveOperations().catch(() => undefined).finally(() => void fetchFleet());
    const timer = window.setInterval(() => void advancePassiveOperations().catch(() => undefined).finally(() => void fetchFleet()), 30_000);
    return () => window.clearInterval(timer);
  }, [company?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const leaseByAircraft = useMemo(() => new Map(leases.map((lease) => [lease.aircraft_id, lease])), [leases]);

  const setActive = async (id: string) => {
    if (!company) return;
    const { error: updateError } = await supabase.from("companies").update({ active_aircraft_id: id }).eq("id", company.id);
    if (updateError) setError(updateError.message); else await refetchCompany();
  };

  const buyout = async () => {
    if (!company || !buyoutRequest) return;
    const { lease } = buyoutRequest;
    setBuyingOutId(lease.id); setError(null);
    const { error: buyoutError } = await supabase.rpc("buyout_aircraft_lease", { p_lease_id: lease.id, p_company_id: company.id });
    if (buyoutError) setError(buyoutError.message);
    else { setBuyoutRequest(null); await Promise.all([fetchFleet(), refetchCompany()]); }
    setBuyingOutId(null);
  };

  const requestDisposal = async (plane: Aircraft, lease?: AircraftLease) => {
    if (!company) return;
    setQuotingId(plane.id); setError(null);
    const { data, error: quoteError } = await supabase.rpc("aircraft_disposal_quote", { p_aircraft_id: plane.id, p_company_id: company.id });
    if (quoteError) setError(quoteError.message);
    else setDisposal({ aircraft: plane, lease, quote: data as unknown as DisposalQuote });
    setQuotingId(null);
  };

  const confirmDisposal = async () => {
    if (!company || !disposal) return;
    setDisposing(true); setError(null);
    const result = disposal.lease
      ? await supabase.rpc("terminate_aircraft_lease", { p_lease_id: disposal.lease.id, p_company_id: company.id })
      : await supabase.rpc("sell_owned_aircraft", { p_aircraft_id: disposal.aircraft.id, p_company_id: company.id });
    if (result.error) setError(result.error.message);
    else { setDisposal(null); await Promise.all([fetchFleet(), refetchCompany()]); }
    setDisposing(false);
  };

  const requestMaintenance = async (plane: Aircraft) => {
    if (!company) return;
    setQuotingId(plane.id); setError(null);
    const { data, error: quoteError } = await supabase.rpc("aircraft_maintenance_quote", { p_aircraft_id: plane.id, p_company_id: company.id });
    if (quoteError) setError(quoteError.message);
    else setMaintenance({ aircraft: plane, quote: data as unknown as MaintenanceQuote });
    setQuotingId(null);
  };

  const confirmMaintenance = async () => {
    if (!company || !maintenance) return;
    setMaintaining(true); setError(null);
    const { error: maintenanceError } = await supabase.rpc("perform_aircraft_maintenance", { p_aircraft_id: maintenance.aircraft.id, p_company_id: company.id });
    if (maintenanceError) setError(maintenanceError.message);
    else { setMaintenance(null); await Promise.all([fetchFleet(), refetchCompany()]); }
    setMaintaining(false);
  };

  if (!company) return null;
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-white">Fleet</h1><p className="text-sm text-slate-400">{aircraft.length} aircraft in fleet</p></div>
        <button onClick={() => setShowMarket((value) => !value)} className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all ${showMarket ? "border-brand-400/30 bg-brand-500/15 text-brand-200" : "border-brand-500/30 bg-brand-500 text-white hover:bg-brand-400"}`}>
          {showMarket ? <X className="h-4 w-4" /> : <ShoppingCart className="h-4 w-4" />}{showMarket ? "Close market" : "Aircraft market"}
        </button>
      </div>

      {showMarket && <AircraftMarket company={company} onChanged={async () => { await Promise.all([fetchFleet(), refetchCompany()]); }} />}
      {error && <div className="rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-3 text-xs text-red-300">{error}</div>}

      {loading ? <div className="text-slate-400">Loading...</div> : aircraft.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.02] py-16 text-center"><Plane className="mb-3 h-8 w-8 text-slate-600" /><div className="text-sm text-slate-400">Your fleet is empty. Visit the aircraft market to get started.</div></div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">{aircraft.map((item) => {
          const active = company.active_aircraft_id === item.id;
          const lease = leaseByAircraft.get(item.id);
          const overdue = lease?.status === "overdue";
          const condition = aircraftCondition(item.health_pct);
          const healthColor = item.health_pct >= 80 ? "from-emerald-500 to-emerald-400" : item.health_pct >= 60 ? "from-yellow-500 to-yellow-400" : "from-red-500 to-red-400";
          const operation = schedules.find((schedule) => schedule.aircraft_id === item.id);
          const currentLeg = scheduleLegs.find((leg) => leg.schedule_id === operation?.id && leg.status === "flying")
            ?? scheduleLegs.find((leg) => leg.schedule_id === operation?.id && leg.status === "available");
          const captain = crew.find((member) => member.id === operation?.captain_id);
          const firstOfficer = crew.find((member) => member.id === operation?.first_officer_id);
          return <article key={item.id} className={`rounded-xl border bg-white/[0.02] p-5 transition-all hover:bg-white/[0.04] ${overdue ? "border-red-500/30" : active ? "border-brand-500/30 glow-brand-sm" : "border-white/[0.06]"}`}>
            <div className="mb-4 flex items-start justify-between"><div className="flex items-center gap-3"><div className={`flex h-10 w-10 items-center justify-center rounded-xl ${active ? "bg-brand-500/15" : "bg-white/[0.04]"}`}><Plane className={`h-5 w-5 ${active ? "text-brand-300" : "text-slate-400"}`} /></div><div><div className="font-semibold text-white">{item.name}</div><div className="font-mono text-xs text-slate-500">{item.icao_type}{item.registration ? ` · ${item.registration}` : ""}</div></div></div>{active ? <span className="rounded-full bg-brand-500/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-brand-300">Active</span> : <button onClick={() => void setActive(item.id)} className="flex items-center gap-1 rounded-full border border-white/[0.08] px-2.5 py-1 text-[10px] uppercase tracking-wider text-slate-400 hover:border-brand-400/40 hover:text-brand-300">Set active <ChevronRight className="h-3 w-3" /></button>}</div>
            <div className="mb-4"><div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-[0.15em]"><span className="flex items-center gap-1.5 text-slate-500"><Wrench className="h-3 w-3" />Condition · {condition.label}</span><span className={condition.textClass}>{item.health_pct.toFixed(1)}%</span></div><div className="h-2 overflow-hidden rounded-full bg-white/[0.04]"><div className={`h-full rounded-full bg-gradient-to-r ${healthColor}`} style={{ width: `${item.health_pct}%` }} /></div></div>
            {item.health_pct < 60 && <div className={`mb-4 rounded-lg border px-3 py-2 text-xs ${condition.panelClass}`}>{condition.message}</div>}
            <div className="grid grid-cols-3 gap-3"><FleetStat icon={Hash} label="Cycles" value={item.cycles.toLocaleString()} /><FleetStat icon={Clock} label="Hours" value={item.total_hours.toFixed(1)} /><FleetStat label={lease && lease.status !== "paid_off" ? "Payment/mo" : "Value"} value={currency(lease && lease.status !== "paid_off" ? lease.monthly_payment : item.purchase_price)} /></div>
            <button type="button" onClick={() => void requestMaintenance(item)} disabled={item.health_pct >= 100 || quotingId !== null} className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2 text-xs font-semibold text-amber-200 transition-colors hover:bg-amber-500/[0.12] disabled:cursor-not-allowed disabled:opacity-40">
              {quotingId === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wrench className="h-3.5 w-3.5" />}{item.health_pct >= 100 ? "No maintenance needed" : "Perform maintenance"}
            </button>
            {lease && lease.status !== "paid_off" ? <LeasePanel lease={lease} capital={company.capital} loading={buyingOutId === lease.id} disposing={quotingId === item.id} onBuyout={() => setBuyoutRequest({ lease, aircraftName: item.name })} onReturn={() => void requestDisposal(item, lease)} /> : <div className="mt-3 flex items-center justify-between rounded-lg bg-emerald-500/[0.04] px-3 py-2 text-xs"><span className="font-semibold text-emerald-300">Owned</span><button onClick={() => void requestDisposal(item)} disabled={quotingId !== null} className="flex items-center gap-1 rounded-md border border-white/[0.08] px-2 py-1 font-semibold text-slate-300 hover:border-emerald-400/30 hover:text-emerald-300 disabled:opacity-40">{quotingId === item.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <DollarSign className="h-3 w-3" />}Sell aircraft</button></div>}
            <div className="mt-3 flex items-center gap-2 rounded-lg bg-white/[0.03] px-3 py-2 text-xs text-slate-500"><MapPin className="h-3.5 w-3.5 text-brand-400" />Current position<span className="ml-auto font-mono font-semibold text-slate-200">{item.current_airport_icao ?? company.hub_icao}</span></div>
            {operation && <div className="mt-3 space-y-2 rounded-lg border border-brand-500/10 bg-brand-500/[0.035] p-3 text-xs">
              <div className="flex items-center justify-between border-b border-white/[0.05] pb-2"><span className="text-slate-500">Assigned schedule</span><span className="max-w-[60%] truncate font-semibold text-slate-200">{operation.name}</span></div>
              <div className="flex items-center gap-2"><CalendarClock className="h-3.5 w-3.5 text-brand-300" /><span className="font-semibold text-brand-200">{currentLeg?.status === "flying" ? "Flying" : "Next operation"}</span><span className="ml-auto font-mono text-slate-300">{currentLeg ? `${currentLeg.origin_icao} → ${currentLeg.dest_icao}` : operation.status}</span></div>
              {currentLeg?.scheduled_departure_at && <div className="text-slate-500">Departure <span className="float-right text-slate-300">{new Date(currentLeg.scheduled_departure_at).toLocaleString([], { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span></div>}
              {operation.passive_enabled && <div className="flex items-center gap-2 text-slate-500"><Users className="h-3.5 w-3.5" />{captain?.last_name ?? "Captain"} / {firstOfficer?.last_name ?? "First officer"}<span className="ml-auto uppercase text-brand-300">Passive</span></div>}
            </div>}
          </article>;
        })}</div>
      )}
      <ConfirmDialog open={disposal !== null} title={disposal?.lease ? "Return leased aircraft?" : "Sell aircraft?"} description={disposal ? <DisposalSummary request={disposal} capital={company.capital} /> : null} confirmLabel={disposal?.lease ? "Return aircraft" : "Sell aircraft"} destructive loading={disposing} onCancel={() => { if (!disposing) setDisposal(null); }} onConfirm={() => void confirmDisposal()} />
      <ConfirmDialog open={maintenance !== null} title="Confirm aircraft maintenance" description={maintenance ? <MaintenanceSummary request={maintenance} capital={company.capital} /> : null} confirmLabel="Perform maintenance" loading={maintaining} onCancel={() => { if (!maintaining) setMaintenance(null); }} onConfirm={() => void confirmMaintenance()} />
      <ConfirmDialog open={buyoutRequest !== null} title="Buy out aircraft lease?" description={buyoutRequest ? <div className="space-y-3"><p>Pay the remaining balance to take full ownership of {buyoutRequest.aircraftName}.</p><div className="flex justify-between gap-4 rounded-xl bg-white/[0.03] p-3 font-mono text-xs"><span className="text-slate-400">Payment due now</span><span className="font-bold text-white">{currency(buyoutRequest.lease.remaining_amount)}</span></div></div> : null} confirmLabel="Buy out lease" loading={buyoutRequest !== null && buyingOutId === buyoutRequest.lease.id} onCancel={() => { if (buyingOutId === null) setBuyoutRequest(null); }} onConfirm={() => void buyout()} />
    </div>
  );
}

function LeasePanel({ lease, capital, loading, disposing, onBuyout, onReturn }: { lease: AircraftLease; capital: number; loading: boolean; disposing: boolean; onBuyout: () => void; onReturn: () => void }) {
  const progress = lease.total_months > 0 ? lease.paid_months / lease.total_months * 100 : 0;
  return <div className={`mt-3 rounded-lg border p-3 ${lease.status === "overdue" ? "border-red-500/20 bg-red-500/[0.04]" : "border-brand-500/10 bg-brand-500/[0.03]"}`}>
    <div className="flex items-center justify-between text-xs"><span className={lease.status === "overdue" ? "font-semibold text-red-300" : "font-semibold text-brand-300"}>{lease.status === "overdue" ? "Payment overdue · dispatch blocked" : "Lease to own"}</span><span className="font-mono text-slate-300">{lease.paid_months}/{lease.total_months} payments</span></div>
    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.05]"><div className={`h-full rounded-full ${lease.status === "overdue" ? "bg-red-400" : "bg-brand-400"}`} style={{ width: `${progress}%` }} /></div>
    <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500"><span>Remaining: <b className="font-mono text-slate-300">{currency(lease.remaining_amount)}</b></span><div className="flex gap-1"><button onClick={onReturn} disabled={disposing} className="flex items-center gap-1 rounded-md border border-red-500/15 px-2 py-1 font-semibold text-red-300 hover:bg-red-500/[0.06] disabled:opacity-40">{disposing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}Return</button><button onClick={onBuyout} disabled={loading || capital < lease.remaining_amount} className="flex items-center gap-1 rounded-md border border-white/[0.08] px-2 py-1 font-semibold text-slate-300 hover:border-brand-400/30 hover:text-brand-300 disabled:opacity-40">{loading && <Loader2 className="h-3 w-3 animate-spin" />}Buy out</button></div></div>
  </div>;
}

function DisposalSummary({ request, capital }: { request: DisposalRequest; capital: number }) {
  const { aircraft, lease, quote } = request;
  if (lease) {
    const fee = Number(quote.termination_fee ?? 0);
    return <div className="space-y-3"><p>{aircraft.name}{aircraft.registration ? ` (${aircraft.registration})` : ""} will leave your fleet. Paid instalments and the down payment are not refunded.</p><div className="space-y-1 rounded-xl bg-white/[0.03] p-3 font-mono text-xs"><QuoteRow label="Remaining debt cancelled" value={currency(Number(quote.remaining_cancelled ?? 0))} /><QuoteRow label="Condition penalty" value={currency(Number(quote.condition_fee ?? 0))} /><QuoteRow label="Early return fee" value={currency(fee)} strong /><QuoteRow label="Capital after return" value={currency(capital - fee)} /></div><p className="text-xs text-red-300">Active dispatches or schedules must be cancelled first.</p></div>;
  }
  return <div className="space-y-3"><p>{aircraft.name}{aircraft.registration ? ` (${aircraft.registration})` : ""} will permanently leave your operational fleet.</p><div className="space-y-1 rounded-xl bg-white/[0.03] p-3 font-mono text-xs"><QuoteRow label="Broker valuation" value={currency(Number(quote.gross_value ?? 0))} /><QuoteRow label="Broker commission" value={`-${currency(Number(quote.commission ?? 0))}`} /><QuoteRow label="Net proceeds" value={currency(Number(quote.net_value ?? 0))} strong /></div><p className="text-xs text-red-300">Active dispatches or schedules must be cancelled first.</p></div>;
}

function MaintenanceSummary({ request, capital }: { request: MaintenanceRequest; capital: number }) {
  const { aircraft, quote } = request;
  return <div className="space-y-3"><p>Restore {aircraft.name}{aircraft.registration ? ` (${aircraft.registration})` : ""} to full operating condition.</p><div className="space-y-1 rounded-xl bg-white/[0.03] p-3 font-mono text-xs"><QuoteRow label="Current condition" value={`${Number(quote.current_health).toFixed(1)}%`} /><QuoteRow label="Condition after service" value="100.0%" /><QuoteRow label="Maintenance cost" value={currency(Number(quote.cost))} strong /><QuoteRow label="Capital after service" value={currency(capital - Number(quote.cost))} /></div>{capital < Number(quote.cost) && <p className="text-xs text-red-300">Insufficient capital for this maintenance.</p>}<p className="text-xs text-slate-500">Maintenance is unavailable while the aircraft is dispatched or flying.</p></div>;
}

function QuoteRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return <div className={`flex justify-between gap-4 ${strong ? "border-t border-white/[0.06] pt-2 text-white" : "text-slate-400"}`}><span>{label}</span><span className={strong ? "font-bold text-white" : "text-slate-200"}>{value}</span></div>;
}

function FleetStat({ icon: Icon, label, value }: { icon?: typeof Clock; label: string; value: string }) { return <div className="rounded-lg bg-white/[0.03] px-3 py-2 text-center"><div className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-wider text-slate-500">{Icon && <Icon className="h-3 w-3" />}{label}</div><div className="mt-0.5 truncate font-mono text-sm font-semibold text-white">{value}</div></div>; }

function aircraftCondition(health: number) {
  if (health >= 80) return { label: "Good", textClass: "text-emerald-300", panelClass: "", message: "" };
  if (health >= 60) return { label: "Worn", textClass: "text-yellow-300", panelClass: "", message: "" };
  if (health >= 40) return { label: "Maintenance required", textClass: "text-orange-300", panelClass: "border-orange-500/20 bg-orange-500/[0.05] text-orange-200", message: "Maintenance should be scheduled before the next operation." };
  if (health >= 15) return { label: "Grounded", textClass: "text-red-300", panelClass: "border-red-500/20 bg-red-500/[0.05] text-red-200", message: "Aircraft grounded: maintenance is mandatory." };
  return { label: "Critical", textClass: "text-red-300", panelClass: "border-red-500/30 bg-red-500/[0.08] text-red-200", message: "Critical condition: a heavy inspection is required." };
}
