import { useEffect, useMemo, useState } from "react";
import { Building2, CheckCircle2, Clock, Gauge, Loader2, MapPin, Plane, Search, ShoppingCart, Sparkles, Wrench } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { aircraftTypeByIcao } from "@/data/aircraftTypes";
import { loadImportedAirframes, syncImportedAirframe } from "@/lib/simbriefAirframes";
import ConfirmDialog from "@/components/ConfirmDialog";
import type { Company, NewAircraftCatalogItem, UsedAircraftListing } from "@/lib/database.types";

const currency = (value: number) => value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
type MarketTab = "new" | "used";
type Term = 12 | 24 | 36 | 48;
type PurchaseRequest =
  | { kind: "new"; item: NewAircraftCatalogItem }
  | { kind: "used"; item: UsedAircraftListing }
  | { kind: "lease"; item: UsedAircraftListing; term: Term; quote: ReturnType<typeof leaseQuote> };

export function AircraftMarket({ company, onChanged }: { company: Company; onChanged: () => Promise<void> | void }) {
  const [tab, setTab] = useState<MarketTab>("new");
  const [newAircraft, setNewAircraft] = useState<NewAircraftCatalogItem[]>([]);
  const [usedAircraft, setUsedAircraft] = useState<UsedAircraftListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"price_asc" | "price_desc" | "health">("price_asc");
  const [term, setTerm] = useState<Term>(36);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [purchaseRequest, setPurchaseRequest] = useState<PurchaseRequest | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        await Promise.all(loadImportedAirframes().map((profile) => syncImportedAirframe(company.id, profile)));
      } catch (syncError) {
        setError(syncError instanceof Error ? syncError.message : "Could not sync custom aircraft profiles.");
      }
      const [newResult, usedResult] = await Promise.all([
        supabase.from("new_aircraft_catalog").select("*").order("price"),
        supabase.from("used_aircraft_listings").select("*").eq("status", "available").order("price"),
      ]);
      const loadError = newResult.error ?? usedResult.error;
      if (loadError) setError(loadError.message);
      const catalog = (newResult.data as NewAircraftCatalogItem[]) ?? [];
      const customTypes = new Set(catalog.filter((item) => item.owner_user_id).map((item) => item.icao_type));
      setNewAircraft(catalog.filter((item) => item.owner_user_id || !customTypes.has(item.icao_type)));
      setUsedAircraft((usedResult.data as UsedAircraftListing[]) ?? []);
      setLoading(false);
    };
    void load();
  }, [company.id]);

  const filteredNew = useMemo(() => filterAndSort(newAircraft, query, sort), [newAircraft, query, sort]);
  const filteredUsed = useMemo(() => filterAndSort(usedAircraft, query, sort), [usedAircraft, query, sort]);

  const runPurchase = async (id: string, label: string, action: () => ReturnType<typeof supabase.rpc>) => {
    setProcessingId(id); setError(null); setSuccess(null);
    const { error: actionError } = await action();
    if (actionError) setError(actionError.message);
    else { setSuccess(`${label} has joined your fleet.`); await onChanged(); }
    setProcessingId(null);
    return !actionError;
  };

  const confirmPurchase = async () => {
    if (!purchaseRequest) return;
    const succeeded = purchaseRequest.kind === "new"
      ? await runPurchase(purchaseRequest.item.id, purchaseRequest.item.model_name, () => supabase.rpc("buy_new_aircraft", { p_catalog_id: purchaseRequest.item.id, p_company_id: company.id }))
      : purchaseRequest.kind === "used"
        ? await runPurchase(purchaseRequest.item.id, `${purchaseRequest.item.model_name} ${purchaseRequest.item.registration}`, () => supabase.rpc("buy_used_aircraft_listing", { p_listing_id: purchaseRequest.item.id, p_company_id: company.id }))
        : await runPurchase(purchaseRequest.item.id, `${purchaseRequest.item.model_name} ${purchaseRequest.item.registration}`, () => supabase.rpc("lease_used_aircraft_listing", { p_listing_id: purchaseRequest.item.id, p_company_id: company.id, p_term_months: purchaseRequest.term }));
    if (!succeeded) return;
    if (purchaseRequest.kind !== "new") setUsedAircraft((current) => current.filter((entry) => entry.id !== purchaseRequest.item.id));
    setPurchaseRequest(null);
  };

  const visibleCount = tab === "new" ? filteredNew.length : filteredUsed.length;
  return (
    <section className="space-y-4 rounded-xl border border-brand-500/20 bg-brand-500/[0.025] p-5 animate-slide-up">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div className="flex items-center gap-2"><ShoppingCart className="h-5 w-5 text-brand-300" /><h2 className="font-semibold text-white">Aircraft market</h2></div>
          <p className="mt-1 text-xs text-slate-400">Buy factory-new aircraft or acquire a pre-owned aircraft outright or through lease-to-own.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3"><Search className="h-4 w-4 text-slate-500" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Model, ICAO, manufacturer..." className="w-56 bg-transparent py-2.5 text-sm text-white outline-none placeholder:text-slate-600" /></label>
          <select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)} className="rounded-xl border border-white/[0.08] bg-slate-900 px-3 py-2.5 text-sm text-slate-300 outline-none"><option value="price_asc">Lowest price</option><option value="price_desc">Highest price</option>{tab === "used" && <option value="health">Best condition</option>}</select>
        </div>
      </div>

      <div className="flex items-center justify-between border-b border-white/[0.06]">
        <div className="flex gap-5">
          <TabButton active={tab === "new"} onClick={() => setTab("new")} icon={Sparkles} label="New aircraft" />
          <TabButton active={tab === "used"} onClick={() => setTab("used")} icon={Wrench} label="Pre-owned" />
        </div>
        {tab === "used" && <label className="mb-2 flex items-center gap-2 text-xs text-slate-500">Lease term<select value={term} onChange={(event) => setTerm(Number(event.target.value) as Term)} className="rounded-lg border border-white/[0.08] bg-slate-900 px-2 py-1.5 text-slate-300"><option value={12}>12 months</option><option value={24}>24 months</option><option value={36}>36 months</option><option value={48}>48 months</option></select></label>}
      </div>

      {error && <div className="rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-3 text-xs text-red-300">{error}</div>}
      {success && <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] px-4 py-3 text-xs text-emerald-300"><CheckCircle2 className="h-4 w-4" />{success}</div>}
      {loading ? <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" />Loading market...</div> : visibleCount === 0 ? <div className="py-12 text-center text-sm text-slate-500">No available aircraft matches these filters.</div> : tab === "new" ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">{filteredNew.map((item) => {
          const importedSpecs = loadImportedAirframes().find((profile) => profile.icaoType === item.icao_type);
          const staticSpecs = aircraftTypeByIcao[item.icao_type];
          const databaseSpecs = item.specs && typeof item.specs === "object" && !Array.isArray(item.specs) ? item.specs : {};
          const rangeNm = importedSpecs?.rangeNm || Number(databaseSpecs.rangeNm ?? staticSpecs?.rangeNm ?? 0);
          const passengers = importedSpecs ? importedSpecs.maxPaxEco + importedSpecs.maxPaxBiz : Number(databaseSpecs.maxPaxEco ?? 0) + Number(databaseSpecs.maxPaxBiz ?? 0) || (staticSpecs?.maxPaxEco ?? 0) + (staticSpecs?.maxPaxBiz ?? 0);
          const affordable = company.capital >= item.price;
          return <article key={item.id} className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-4 hover:bg-white/[0.045]">
            <AircraftHeader name={item.model_name} subtitle={`${item.manufacturer} · ${item.icao_type}`} price={item.price} badge="Factory new" />
            <div className="mt-4 grid grid-cols-3 gap-2"><MarketStat icon={Gauge} label="Range" value={rangeNm ? `${rangeNm.toLocaleString()} nm` : "—"} /><MarketStat icon={Plane} label="Passengers" value={String(passengers)} /><MarketStat icon={MapPin} label="Delivery" value={company.hub_icao} /></div>
            <div className="mt-3 flex items-center justify-between text-xs text-slate-500"><span>100% condition · 0 hours · 0 cycles</span><ActionButton loading={processingId === item.id} disabled={!affordable || processingId !== null} onClick={() => setPurchaseRequest({ kind: "new", item })} label={affordable ? "Buy new" : "Insufficient capital"} /></div>
          </article>;
        })}</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">{filteredUsed.map((item) => {
          const quote = leaseQuote(item, term); const affordable = company.capital >= item.price; const canLease = company.capital >= quote.down;
          return <article key={item.id} className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-4 hover:bg-white/[0.045]">
            <AircraftHeader name={item.model_name} subtitle={`${item.icao_type} · ${item.registration}`} price={item.price} badge={`${item.manufacture_year}`} />
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4"><MarketStat icon={Clock} label="Hours" value={item.total_hours.toLocaleString()} /><MarketStat icon={Gauge} label="Cycles" value={item.cycles.toLocaleString()} /><MarketStat icon={Wrench} label="Condition" value={`${item.health_pct.toFixed(0)}%`} /><MarketStat icon={MapPin} label="Location" value={item.location_icao} /></div>
            <div className="mt-3 rounded-lg border border-brand-500/10 bg-brand-500/[0.03] px-3 py-2 text-xs"><div className="flex justify-between text-slate-400"><span>Lease-to-own · {term} months · {quote.apr.toFixed(1)}% APR</span><span className="font-mono text-brand-300">{currency(quote.monthly)}/mo</span></div><div className="mt-1 text-[10px] text-slate-600">10% down payment: {currency(quote.down)} · Ownership transfers after final payment</div></div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500"><span className="mr-auto flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" />{item.seller_name}</span><ActionButton secondary loading={processingId === item.id} disabled={!canLease || processingId !== null} onClick={() => setPurchaseRequest({ kind: "lease", item, term, quote })} label={canLease ? "Lease to own" : "Cannot fund deposit"} /><ActionButton loading={processingId === item.id} disabled={!affordable || processingId !== null} onClick={() => setPurchaseRequest({ kind: "used", item })} label={affordable ? "Buy outright" : "Insufficient capital"} /></div>
          </article>;
        })}</div>
      )}
      <ConfirmDialog
        open={purchaseRequest !== null}
        title={purchaseRequest?.kind === "lease" ? "Start lease-to-own?" : purchaseRequest?.kind === "new" ? "Order new aircraft?" : "Buy aircraft?"}
        description={purchaseRequest ? <PurchaseSummary request={purchaseRequest} hubIcao={company.hub_icao} /> : null}
        confirmLabel={purchaseRequest?.kind === "lease" ? "Start lease" : purchaseRequest?.kind === "new" ? "Order aircraft" : "Buy aircraft"}
        loading={purchaseRequest !== null && processingId === purchaseRequest.item.id}
        onCancel={() => { if (processingId === null) setPurchaseRequest(null); }}
        onConfirm={() => void confirmPurchase()}
      />
    </section>
  );
}

function leaseQuote(item: UsedAircraftListing, term: Term) { const down = item.price * 0.10; const age = Math.max(0, new Date().getFullYear() - item.manufacture_year); const apr = Math.min(12, 6 + age * 0.08 + (100 - item.health_pct) * 0.05); const rate = apr / 100 / 12; const monthly = ((item.price - down) * rate) / (1 - Math.pow(1 + rate, -term)); return { down, apr, monthly }; }
function PurchaseSummary({ request, hubIcao }: { request: PurchaseRequest; hubIcao: string }) { return <div className="space-y-3"><p>{request.kind === "new" ? `A factory-new ${request.item.model_name} will be delivered to ${hubIcao}.` : `${request.item.model_name} (${request.item.registration}) will join your fleet.`}</p><div className="space-y-1 rounded-xl bg-white/[0.03] p-3 font-mono text-xs">{request.kind === "lease" ? <><QuoteRow label="Term" value={`${request.term} months`} /><QuoteRow label="Down payment" value={currency(request.quote.down)} strong /><QuoteRow label="Monthly payment" value={`${currency(request.quote.monthly)}/mo`} /><QuoteRow label="APR" value={`${request.quote.apr.toFixed(1)}%`} /></> : <QuoteRow label="Purchase price" value={currency(request.item.price)} strong />}</div></div>; }
function QuoteRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) { return <div className={`flex justify-between gap-4 ${strong ? "border-t border-white/[0.06] pt-2 text-white" : "text-slate-400"}`}><span>{label}</span><span className={strong ? "font-bold text-white" : "text-slate-200"}>{value}</span></div>; }
function filterAndSort<T extends { price: number; icao_type: string; model_name: string }>(items: T[], query: string, sort: "price_asc" | "price_desc" | "health") { const needle = query.trim().toLowerCase(); return [...items].filter((item) => !needle || Object.values(item).some((value) => typeof value === "string" && value.toLowerCase().includes(needle))).sort((a, b) => sort === "health" && "health_pct" in a && "health_pct" in b ? Number(b.health_pct) - Number(a.health_pct) : sort === "price_desc" ? b.price - a.price : a.price - b.price); }
function TabButton({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: typeof Plane; label: string }) { return <button onClick={onClick} className={`flex items-center gap-2 border-b-2 px-1 pb-2 text-xs font-semibold ${active ? "border-brand-400 text-brand-300" : "border-transparent text-slate-500 hover:text-slate-300"}`}><Icon className="h-3.5 w-3.5" />{label}</button>; }
function AircraftHeader({ name, subtitle, price, badge }: { name: string; subtitle: string; price: number; badge: string }) { return <div className="flex items-start justify-between gap-4"><div className="flex min-w-0 items-center gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-500/10"><Plane className="h-5 w-5 text-brand-300" /></div><div><div className="font-semibold text-white">{name}</div><div className="font-mono text-xs text-slate-500">{subtitle}</div></div></div><div className="text-right"><div className="font-mono text-lg font-bold text-white">{currency(price)}</div><div className="text-[10px] uppercase tracking-wider text-slate-500">{badge}</div></div></div>; }
function ActionButton({ label, onClick, disabled, loading, secondary = false }: { label: string; onClick: () => void; disabled: boolean; loading: boolean; secondary?: boolean }) { return <button onClick={onClick} disabled={disabled} className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:bg-white/[0.05] disabled:text-slate-600 ${secondary ? "border border-brand-400/20 text-brand-300 hover:bg-brand-500/10" : "bg-brand-500 text-white hover:bg-brand-400"}`}>{loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShoppingCart className="h-3.5 w-3.5" />}{label}</button>; }
function MarketStat({ icon: Icon, label, value }: { icon: typeof Clock; label: string; value: string }) { return <div className="rounded-lg bg-white/[0.03] px-2.5 py-2"><div className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-slate-600"><Icon className="h-3 w-3" />{label}</div><div className="mt-0.5 font-mono text-xs font-semibold text-slate-200">{value}</div></div>; }
