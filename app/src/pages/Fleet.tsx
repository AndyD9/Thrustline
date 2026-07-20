import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Clock, Hash, Loader2, MapPin, Plane, ShoppingCart, Wrench, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useCompany } from "@/contexts/CompanyContext";
import { AircraftMarket } from "@/components/UsedAircraftMarket";
import type { Aircraft, AircraftLease } from "@/lib/database.types";

const currency = (value: number) => value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export default function Fleet() {
  const { company, refetch: refetchCompany } = useCompany();
  const [aircraft, setAircraft] = useState<Aircraft[]>([]);
  const [leases, setLeases] = useState<AircraftLease[]>([]);
  const [loading, setLoading] = useState(true);
  const [showMarket, setShowMarket] = useState(false);
  const [buyingOutId, setBuyingOutId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchFleet = async () => {
    if (!company) return;
    setLoading(true);
    const [aircraftResult, leasesResult] = await Promise.all([
      supabase.from("aircraft").select("*").eq("company_id", company.id).order("created_at", { ascending: false }),
      supabase.from("aircraft_leases").select("*").eq("company_id", company.id),
    ]);
    setAircraft((aircraftResult.data as Aircraft[]) ?? []);
    setLeases((leasesResult.data as AircraftLease[]) ?? []);
    setError(aircraftResult.error?.message ?? leasesResult.error?.message ?? null);
    setLoading(false);
  };

  useEffect(() => { void fetchFleet(); }, [company?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const leaseByAircraft = useMemo(() => new Map(leases.map((lease) => [lease.aircraft_id, lease])), [leases]);

  const setActive = async (id: string) => {
    if (!company) return;
    const { error: updateError } = await supabase.from("companies").update({ active_aircraft_id: id }).eq("id", company.id);
    if (updateError) setError(updateError.message); else await refetchCompany();
  };

  const buyout = async (lease: AircraftLease, aircraftName: string) => {
    if (!company || !window.confirm(`Pay ${currency(lease.remaining_amount)} now to own ${aircraftName}?`)) return;
    setBuyingOutId(lease.id); setError(null);
    const { error: buyoutError } = await supabase.rpc("buyout_aircraft_lease", { p_lease_id: lease.id, p_company_id: company.id });
    if (buyoutError) setError(buyoutError.message);
    else await Promise.all([fetchFleet(), refetchCompany()]);
    setBuyingOutId(null);
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
          const healthColor = item.health_pct > 70 ? "from-emerald-500 to-emerald-400" : item.health_pct > 40 ? "from-yellow-500 to-yellow-400" : "from-red-500 to-red-400";
          return <article key={item.id} className={`rounded-xl border bg-white/[0.02] p-5 transition-all hover:bg-white/[0.04] ${overdue ? "border-red-500/30" : active ? "border-brand-500/30 glow-brand-sm" : "border-white/[0.06]"}`}>
            <div className="mb-4 flex items-start justify-between"><div className="flex items-center gap-3"><div className={`flex h-10 w-10 items-center justify-center rounded-xl ${active ? "bg-brand-500/15" : "bg-white/[0.04]"}`}><Plane className={`h-5 w-5 ${active ? "text-brand-300" : "text-slate-400"}`} /></div><div><div className="font-semibold text-white">{item.name}</div><div className="font-mono text-xs text-slate-500">{item.icao_type}{item.registration ? ` · ${item.registration}` : ""}</div></div></div>{active ? <span className="rounded-full bg-brand-500/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-brand-300">Active</span> : <button onClick={() => void setActive(item.id)} className="flex items-center gap-1 rounded-full border border-white/[0.08] px-2.5 py-1 text-[10px] uppercase tracking-wider text-slate-400 hover:border-brand-400/40 hover:text-brand-300">Set active <ChevronRight className="h-3 w-3" /></button>}</div>
            <div className="mb-4"><div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-[0.15em]"><span className="flex items-center gap-1.5 text-slate-500"><Wrench className="h-3 w-3" />Health</span><span className="text-slate-300">{item.health_pct.toFixed(1)}%</span></div><div className="h-2 overflow-hidden rounded-full bg-white/[0.04]"><div className={`h-full rounded-full bg-gradient-to-r ${healthColor}`} style={{ width: `${item.health_pct}%` }} /></div></div>
            <div className="grid grid-cols-3 gap-3"><FleetStat icon={Hash} label="Cycles" value={item.cycles.toLocaleString()} /><FleetStat icon={Clock} label="Hours" value={item.total_hours.toFixed(1)} /><FleetStat label={lease && lease.status !== "paid_off" ? "Payment/mo" : "Value"} value={currency(lease && lease.status !== "paid_off" ? lease.monthly_payment : item.purchase_price)} /></div>
            {lease && lease.status !== "paid_off" ? <LeasePanel lease={lease} capital={company.capital} loading={buyingOutId === lease.id} onBuyout={() => void buyout(lease, item.name)} /> : <div className="mt-3 flex items-center justify-between rounded-lg bg-emerald-500/[0.04] px-3 py-2 text-xs"><span className="font-semibold text-emerald-300">Owned</span><span className="text-slate-500">No finance outstanding</span></div>}
            <div className="mt-3 flex items-center gap-2 rounded-lg bg-white/[0.03] px-3 py-2 text-xs text-slate-500"><MapPin className="h-3.5 w-3.5 text-brand-400" />Current position<span className="ml-auto font-mono font-semibold text-slate-200">{item.current_airport_icao ?? company.hub_icao}</span></div>
          </article>;
        })}</div>
      )}
    </div>
  );
}

function LeasePanel({ lease, capital, loading, onBuyout }: { lease: AircraftLease; capital: number; loading: boolean; onBuyout: () => void }) {
  const progress = lease.total_months > 0 ? lease.paid_months / lease.total_months * 100 : 0;
  return <div className={`mt-3 rounded-lg border p-3 ${lease.status === "overdue" ? "border-red-500/20 bg-red-500/[0.04]" : "border-brand-500/10 bg-brand-500/[0.03]"}`}><div className="flex items-center justify-between text-xs"><span className={lease.status === "overdue" ? "font-semibold text-red-300" : "font-semibold text-brand-300"}>{lease.status === "overdue" ? "Payment overdue · dispatch blocked" : "Lease to own"}</span><span className="font-mono text-slate-300">{lease.paid_months}/{lease.total_months} payments</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.05]"><div className={`h-full rounded-full ${lease.status === "overdue" ? "bg-red-400" : "bg-brand-400"}`} style={{ width: `${progress}%` }} /></div><div className="mt-2 flex items-center justify-between text-[10px] text-slate-500"><span>Remaining: <b className="font-mono text-slate-300">{currency(lease.remaining_amount)}</b></span><button onClick={onBuyout} disabled={loading || capital < lease.remaining_amount} className="flex items-center gap-1 rounded-md border border-white/[0.08] px-2 py-1 font-semibold text-slate-300 hover:border-brand-400/30 hover:text-brand-300 disabled:opacity-40">{loading && <Loader2 className="h-3 w-3 animate-spin" />}Buy out lease</button></div></div>;
}

function FleetStat({ icon: Icon, label, value }: { icon?: typeof Clock; label: string; value: string }) { return <div className="rounded-lg bg-white/[0.03] px-3 py-2 text-center"><div className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-wider text-slate-500">{Icon && <Icon className="h-3 w-3" />}{label}</div><div className="mt-0.5 truncate font-mono text-sm font-semibold text-white">{value}</div></div>; }
