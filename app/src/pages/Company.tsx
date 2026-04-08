import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useCompany } from "@/contexts/CompanyContext";
import { PARTNERS, MAX_ACTIVE_PARTNERSHIPS } from "@/lib/partnerships";
import { CAMPAIGNS, campaignTotalCost } from "@/lib/campaigns";
import type { Partnership, MarketingCampaign, Route, Flight } from "@/lib/database.types";
import type { LucideIcon } from "lucide-react";
import {
  Building2,
  Star,
  DollarSign,
  Handshake,
  Megaphone,
  Tag,
  Fuel,
  Wrench,
  Utensils,
  Globe,
  Armchair,
  Package,
  Tv,
  Heart,
  Zap,
  Monitor,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
  fuel: Fuel, wrench: Wrench, utensils: Utensils, globe: Globe,
  armchair: Armchair, package: Package, megaphone: Megaphone,
  monitor: Monitor, tv: Tv, heart: Heart, zap: Zap,
};

const currency = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export default function Company() {
  const { company, refetch } = useCompany();
  const [partnerships, setPartnerships] = useState<Partnership[]>([]);
  const [campaigns, setCampaigns] = useState<MarketingCampaign[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);

  // Campaign launch modal state
  const [showCampaignModal, setShowCampaignModal] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null);
  const [campaignRoute, setCampaignRoute] = useState<string>("");

  // Derived route pairs from flights (for campaign route picker)
  const [flightRoutes, setFlightRoutes] = useState<{ key: string; origin: string; dest: string }[]>([]);

  const loadData = useCallback(async () => {
    if (!company) return;
    setLoading(true);

    // Query each table independently so a 404 on one doesn't break the others
    const [pRes, cRes, rRes, fRes] = await Promise.all([
      supabase.from("partnerships").select("*").eq("company_id", company.id).then(r => r).catch(() => ({ data: null })),
      supabase.from("marketing_campaigns").select("*").eq("company_id", company.id)
        .gt("expires_at", new Date().toISOString()).order("expires_at", { ascending: true }).then(r => r).catch(() => ({ data: null })),
      supabase.from("routes").select("*").eq("company_id", company.id).eq("active", true).then(r => r).catch(() => ({ data: null })),
      supabase.from("flights").select("departure_icao,arrival_icao").eq("company_id", company.id).then(r => r).catch(() => ({ data: null })),
    ]);

    setPartnerships((pRes.data as Partnership[]) ?? []);
    setCampaigns((cRes.data as MarketingCampaign[]) ?? []);
    setRoutes((rRes.data as Route[]) ?? []);

    // Derive unique route pairs from flights for the campaign route picker
    const flights = (fRes.data as Pick<Flight, "departure_icao" | "arrival_icao">[]) ?? [];
    const seen = new Set<string>();
    const derived: { key: string; origin: string; dest: string }[] = [];
    for (const f of flights) {
      const key = `${f.departure_icao}-${f.arrival_icao}`;
      if (!seen.has(key)) {
        seen.add(key);
        derived.push({ key, origin: f.departure_icao, dest: f.arrival_icao });
      }
    }
    setFlightRoutes(derived);
    setLoading(false);
  }, [company?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadData(); }, [loadData]);

  if (!company) return null;

  const activePartnerKeys = new Set(partnerships.filter((p) => p.active).map((p) => p.partner_key));
  const activeCount = activePartnerKeys.size;
  const monthlyOverhead = partnerships.filter((p) => p.active).reduce((s, p) => s + p.monthly_cost, 0);

  // Toggle partnership
  const togglePartner = async (partnerDef: typeof PARTNERS[0]) => {
    const existing = partnerships.find((p) => p.partner_key === partnerDef.key);
    if (existing) {
      // Toggle active
      if (!existing.active && activeCount >= MAX_ACTIVE_PARTNERSHIPS) return; // at max
      await supabase.from("partnerships").update({ active: !existing.active }).eq("id", existing.id);
    } else {
      // Create new
      if (activeCount >= MAX_ACTIVE_PARTNERSHIPS) return;
      await supabase.from("partnerships").insert({
        user_id: company.user_id,
        company_id: company.id,
        partner_key: partnerDef.key,
        partner_name: partnerDef.name,
        bonus_type: partnerDef.bonusType,
        bonus_value: partnerDef.bonusValue,
        monthly_cost: partnerDef.monthlyCost,
        active: true,
      });
    }
    loadData();
  };

  // Launch campaign
  const launchCampaign = async () => {
    const def = CAMPAIGNS.find((c) => c.type === selectedCampaign);
    if (!def) return;
    const totalCost = campaignTotalCost(def);
    if (company.capital < totalCost) return; // can't afford

    const now = new Date();
    const expires = new Date(now.getTime() + def.durationDays * 86400000);
    const targetRoute = def.scope === "route" ? campaignRoute : null;

    await supabase.from("marketing_campaigns").insert({
      user_id: company.user_id,
      company_id: company.id,
      campaign_type: def.type,
      scope: def.scope,
      target_route: targetRoute,
      demand_multiplier: def.demandMultiplier,
      daily_cost: def.dailyCost,
      started_at: now.toISOString(),
      expires_at: expires.toISOString(),
    });

    // Debit upfront cost
    await supabase.from("companies").update({ capital: company.capital - totalCost }).eq("id", company.id);
    await supabase.from("transactions").insert({
      user_id: company.user_id,
      company_id: company.id,
      type: "maintenance",
      amount: -totalCost,
      description: `Marketing: ${def.name}${targetRoute ? ` (${targetRoute})` : ""}`,
    });

    setShowCampaignModal(false);
    setSelectedCampaign(null);
    setCampaignRoute("");
    refetch();
    loadData();
  };

  // Cancel campaign (refund remaining days)
  const cancelCampaign = async (campaign: MarketingCampaign) => {
    const remaining = Math.max(0, Math.ceil((new Date(campaign.expires_at).getTime() - Date.now()) / 86400000));
    const refund = Math.round(campaign.daily_cost * remaining);

    // Delete campaign
    await supabase.from("marketing_campaigns").delete().eq("id", campaign.id);

    // Refund remaining cost
    if (refund > 0) {
      await supabase.from("companies").update({ capital: company.capital + refund }).eq("id", company.id);
      await supabase.from("transactions").insert({
        user_id: company.user_id,
        company_id: company.id,
        type: "revenue",
        amount: refund,
        description: `Campaign cancelled: ${campaign.campaign_type.replace("_", " ")} — ${remaining}d refund`,
      });
    }

    refetch();
    loadData();
  };

  // Update route pricing
  const updatePricing = async (routeId: string, modifier: number) => {
    await supabase.from("routes").update({ price_modifier: modifier }).eq("id", routeId);
    loadData();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white">Company Management</h1>
        <p className="text-sm text-slate-400">Marketing, pricing strategy, and partnerships</p>
      </div>

      {/* Overview KPIs */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Global Reputation" value={`${company.global_reputation?.toFixed(0) ?? 50}/100`} icon={Star} iconColor="text-amber-300" />
        <KpiCard label="Capital" value={currency(company.capital)} icon={DollarSign} iconColor="text-brand-300" glow />
        <KpiCard label="Active Partners" value={`${activeCount}/${MAX_ACTIVE_PARTNERSHIPS}`} icon={Handshake} iconColor="text-emerald-400" />
        <KpiCard label="Monthly Overhead" value={currency(monthlyOverhead)} icon={Clock} iconColor="text-red-400" sub="Partnership fees" />
      </div>

      {/* Global Reputation Gauge */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
        <div className="mb-3 text-[10px] uppercase tracking-[0.15em] text-slate-500">Global Reputation</div>
        <div className="h-3 overflow-hidden rounded-full bg-white/[0.04]">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              (company.global_reputation ?? 50) >= 70 ? "bg-emerald-400" : (company.global_reputation ?? 50) >= 40 ? "bg-amber-400" : "bg-red-400"
            }`}
            style={{ width: `${company.global_reputation ?? 50}%` }}
          />
        </div>
        <div className="mt-1 text-xs text-slate-500">
          Weighted average of route reputations and passenger satisfaction
        </div>
      </div>

      {/* Marketing Campaigns */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.15em] text-slate-500">
            <Megaphone className="h-3.5 w-3.5" /> Marketing Campaigns
          </div>
          <button
            onClick={() => setShowCampaignModal(true)}
            className="rounded-lg bg-brand-500/15 px-3 py-1.5 text-xs font-semibold text-brand-300 transition-all hover:bg-brand-500/25"
          >
            Launch Campaign
          </button>
        </div>

        {campaigns.length === 0 ? (
          <div className="py-6 text-center text-sm text-slate-500">No active campaigns. Launch one to boost demand!</div>
        ) : (
          <div className="space-y-2">
            {campaigns.map((c) => {
              const remaining = Math.max(0, Math.ceil((new Date(c.expires_at).getTime() - Date.now()) / 86400000));
              return (
                <div key={c.id} className="flex items-center justify-between rounded-lg border border-brand-500/10 bg-brand-500/[0.03] px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Megaphone className="h-4 w-4 text-brand-400" />
                    <div>
                      <div className="text-sm font-semibold text-white">{c.campaign_type.replace("_", " ")}</div>
                      <div className="text-[10px] text-slate-500">
                        {c.scope === "route" ? c.target_route : "Global"} · +{Math.round((c.demand_multiplier - 1) * 100)}% demand
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="font-mono text-xs text-brand-300">{remaining}d left</div>
                      <div className="text-[10px] text-slate-500">{currency(c.daily_cost)}/day</div>
                    </div>
                    <button
                      onClick={() => cancelCampaign(c)}
                      className="rounded-lg bg-red-500/15 px-2.5 py-1.5 text-[10px] font-bold text-red-400 transition-all hover:bg-red-500/25"
                      title={`Cancel & refund ~${currency(Math.round(c.daily_cost * remaining))}`}
                    >
                      <XCircle className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Campaign Launch Modal */}
      {showCampaignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-white/[0.08] bg-[#0a0f18] p-6">
            <h3 className="mb-4 text-lg font-bold text-white">Launch Marketing Campaign</h3>
            <div className="space-y-2">
              {CAMPAIGNS.map((def) => {
                const Icon = ICON_MAP[def.icon] ?? Megaphone;
                const total = campaignTotalCost(def);
                const canAfford = company.capital >= total;
                return (
                  <button
                    key={def.type}
                    onClick={() => setSelectedCampaign(def.type)}
                    className={`flex w-full items-center gap-4 rounded-xl border px-4 py-3 text-left transition-all ${
                      selectedCampaign === def.type
                        ? "border-brand-500/30 bg-brand-500/[0.06]"
                        : "border-white/[0.04] bg-white/[0.02] hover:bg-white/[0.04]"
                    } ${!canAfford ? "opacity-40" : ""}`}
                    disabled={!canAfford}
                  >
                    <Icon className="h-5 w-5 shrink-0 text-brand-400" />
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-white">{def.name}</div>
                      <div className="text-[10px] text-slate-500">{def.description}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono text-xs text-white">{currency(total)}</div>
                      <div className="text-[10px] text-slate-500">{def.durationDays}d · +{Math.round((def.demandMultiplier - 1) * 100)}%</div>
                    </div>
                  </button>
                );
              })}
            </div>
            {/* Route picker for route-scoped campaigns */}
            {selectedCampaign && CAMPAIGNS.find((c) => c.type === selectedCampaign)?.scope === "route" && (
              <div className="mt-4">
                <label className="text-[10px] uppercase tracking-[0.15em] text-slate-500">Target Route</label>
                <select
                  value={campaignRoute}
                  onChange={(e) => setCampaignRoute(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-sm text-white"
                >
                  <option value="">Select a route...</option>
                  {flightRoutes.map((r) => (
                    <option key={r.key} value={r.key}>
                      {r.origin} → {r.dest}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="mt-4 flex gap-3">
              <button
                onClick={() => { setShowCampaignModal(false); setSelectedCampaign(null); }}
                className="flex-1 rounded-xl border border-white/[0.06] py-2.5 text-sm text-slate-400 hover:bg-white/[0.04]"
              >
                Cancel
              </button>
              <button
                onClick={launchCampaign}
                disabled={!selectedCampaign || (CAMPAIGNS.find((c) => c.type === selectedCampaign)?.scope === "route" && !campaignRoute)}
                className="flex-1 rounded-xl bg-brand-500 py-2.5 text-sm font-semibold text-white transition-all hover:bg-brand-400 disabled:opacity-40"
              >
                Launch
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pricing Strategy */}
      {routes.length > 0 && (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
          <div className="mb-4 flex items-center gap-2 text-[10px] uppercase tracking-[0.15em] text-slate-500">
            <Tag className="h-3.5 w-3.5" /> Pricing Strategy
          </div>
          <div className="space-y-2">
            {routes.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-lg border border-white/[0.04] bg-white/[0.01] px-4 py-3">
                <div className="flex items-center gap-3 font-mono text-sm">
                  <span className="font-semibold text-white">{r.origin_icao}</span>
                  <span className="text-slate-600">→</span>
                  <span className="font-semibold text-white">{r.dest_icao}</span>
                </div>
                <div className="flex items-center gap-2">
                  {[0.80, 1.00, 1.20].map((mod) => (
                    <button
                      key={mod}
                      onClick={() => updatePricing(r.id, mod)}
                      className={`rounded-lg px-3 py-1.5 text-[10px] font-bold transition-all ${
                        Math.abs((r.price_modifier ?? 1) - mod) < 0.01
                          ? mod < 1 ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                            : mod > 1 ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                            : "bg-white/[0.08] text-white border border-white/[0.12]"
                          : "text-slate-500 border border-white/[0.04] hover:bg-white/[0.04]"
                      }`}
                    >
                      {mod < 1 ? "Discount" : mod > 1 ? "Premium" : "Normal"}
                    </button>
                  ))}
                  <span className={`ml-2 font-mono text-xs ${
                    (r.price_modifier ?? 1) > 1 ? "text-amber-400" : (r.price_modifier ?? 1) < 1 ? "text-blue-400" : "text-slate-500"
                  }`}>
                    {(r.price_modifier ?? 1) > 1 ? "+" : ""}{Math.round(((r.price_modifier ?? 1) - 1) * 100)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2 text-[10px] text-slate-600">
            Premium pricing increases revenue per passenger but reduces demand. Discount pricing does the opposite.
          </div>
        </div>
      )}

      {/* Partnerships */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.15em] text-slate-500">
            <Handshake className="h-3.5 w-3.5" /> Partnerships
          </div>
          <span className="text-[10px] text-slate-500">
            {activeCount}/{MAX_ACTIVE_PARTNERSHIPS} active
            {activeCount >= MAX_ACTIVE_PARTNERSHIPS && (
              <span className="ml-2 text-amber-400">Max reached</span>
            )}
          </span>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {PARTNERS.map((def) => {
            const isActive = activePartnerKeys.has(def.key);
            const atMax = activeCount >= MAX_ACTIVE_PARTNERSHIPS && !isActive;
            const Icon = ICON_MAP[def.icon] ?? Handshake;

            return (
              <div
                key={def.key}
                className={`rounded-xl border px-5 py-4 transition-all ${
                  isActive
                    ? "border-emerald-500/20 bg-emerald-500/[0.04]"
                    : atMax
                    ? "border-white/[0.04] bg-white/[0.01] opacity-40"
                    : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                      isActive ? "bg-emerald-500/15" : "bg-white/[0.04]"
                    }`}>
                      <Icon className={`h-5 w-5 ${isActive ? "text-emerald-300" : "text-slate-500"}`} />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white">{def.name}</div>
                      <div className={`text-xs font-mono ${isActive ? "text-emerald-400" : "text-brand-400"}`}>
                        {def.bonusLabel}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => togglePartner(def)}
                    disabled={atMax}
                    className={`rounded-lg px-3 py-1.5 text-[10px] font-bold transition-all ${
                      isActive
                        ? "bg-red-500/15 text-red-400 hover:bg-red-500/25"
                        : "bg-brand-500/15 text-brand-300 hover:bg-brand-500/25"
                    } disabled:opacity-30`}
                  >
                    {isActive ? "Remove" : "Activate"}
                  </button>
                </div>
                <div className="mt-2 text-[10px] text-slate-500">{def.description}</div>
                <div className="mt-2 font-mono text-xs text-slate-400">{currency(def.monthlyCost)}/mo</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  label, value, icon: Icon, iconColor = "text-brand-300", glow, sub,
}: {
  label: string; value: string; icon: LucideIcon; iconColor?: string; glow?: boolean; sub?: string;
}) {
  return (
    <div className={`rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-4 transition-all hover:bg-white/[0.04] ${glow ? "glow-brand-sm" : ""}`}>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-[0.15em] text-slate-500">{label}</span>
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.04] ${iconColor}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="text-xl font-bold text-white">{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
    </div>
  );
}
