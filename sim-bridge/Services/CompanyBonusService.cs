using Thrustline.Bridge.Cloud;
using Thrustline.Bridge.Cloud.Models;

namespace Thrustline.Bridge.Services;

/// <summary>
/// Agrege tous les bonus actifs d'une compagnie :
/// partnerships actives + marketing campaigns non expirees.
/// Appele par LandingProcessor avant les calculs de revenue/cost.
/// </summary>
public class CompanyBonusService
{
    private readonly ISupabaseClientProvider _supabase;
    private readonly ILogger<CompanyBonusService> _log;

    public CompanyBonusService(ISupabaseClientProvider supabase, ILogger<CompanyBonusService> log)
    {
        _supabase = supabase;
        _log = log;
    }

    public record CompanyBonuses(
        decimal FuelDiscount,           // 0.0-0.15 (ex: 0.10 = 10% cheaper fuel)
        decimal MaintenanceDiscount,    // 0.0-0.20
        decimal PaxSatisfactionBonus,   // 0-10 (additive points)
        decimal DemandMultiplier,       // 1.0-1.5 (from GDS + campaigns)
        decimal BizDemandMultiplier,    // 1.0-1.2 (from lounge provider)
        decimal CargoRevenueMultiplier, // 1.0-1.3
        decimal PriceModifier           // 0.7-1.3 (from route pricing)
    );

    /// <summary>
    /// Charge et agrege les bonus pour une compagnie + route specifique.
    /// </summary>
    public async Task<CompanyBonuses> GetActiveBonusesAsync(
        Guid companyId,
        string? originIcao,
        string? destIcao,
        decimal routePriceModifier,
        CancellationToken ct)
    {
        decimal fuelDiscount = 0m;
        decimal maintenanceDiscount = 0m;
        decimal paxSatisfactionBonus = 0m;
        decimal demandMultiplier = 1.0m;
        decimal bizDemandMultiplier = 1.0m;
        decimal cargoRevenueMultiplier = 1.0m;

        try
        {
            await _supabase.EnsureInitializedAsync(ct);
            var client = _supabase.Client;

            // 1. Active partnerships
            var partnershipsResp = await client.From<PartnershipRow>()
                .Where(p => p.CompanyId == companyId)
                .Where(p => p.Active == true)
                .Get(ct);

            foreach (var p in partnershipsResp.Models)
            {
                switch (p.BonusType)
                {
                    case "fuel_discount":
                        fuelDiscount = Math.Max(fuelDiscount, p.BonusValue);
                        break;
                    case "maintenance_discount":
                        maintenanceDiscount = Math.Max(maintenanceDiscount, p.BonusValue);
                        break;
                    case "pax_satisfaction":
                        paxSatisfactionBonus += p.BonusValue;
                        break;
                    case "demand_boost":
                        demandMultiplier *= (1m + p.BonusValue);
                        break;
                    case "biz_demand":
                        bizDemandMultiplier *= (1m + p.BonusValue);
                        break;
                    case "cargo_revenue":
                        cargoRevenueMultiplier *= (1m + p.BonusValue);
                        break;
                }
            }

            // 2. Active marketing campaigns (non-expired)
            var campaignsResp = await client.From<MarketingCampaignRow>()
                .Where(c => c.CompanyId == companyId)
                .Get(ct);

            var now = DateTime.UtcNow;
            var routeKey = originIcao != null && destIcao != null
                ? $"{originIcao}-{destIcao}"
                : null;

            foreach (var c in campaignsResp.Models)
            {
                if (c.ExpiresAt < now) continue; // expired

                var applies = c.Scope == "global"
                    || (c.Scope == "route" && c.TargetRoute == routeKey);

                if (applies)
                {
                    demandMultiplier *= c.DemandMultiplier;
                }
            }

            _log.LogDebug(
                "Company bonuses: fuel={Fuel:P0} maint={Maint:P0} pax=+{Pax} demand={Demand:F2}x price={Price:F2}x",
                fuelDiscount, maintenanceDiscount, paxSatisfactionBonus, demandMultiplier, routePriceModifier);
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "Failed to load company bonuses");
        }

        return new CompanyBonuses(
            fuelDiscount,
            maintenanceDiscount,
            paxSatisfactionBonus,
            demandMultiplier,
            bizDemandMultiplier,
            cargoRevenueMultiplier,
            routePriceModifier
        );
    }

    /// <summary>
    /// Recalcule la reputation globale de la compagnie.
    /// Formule : 70% avg reputations ponderee + 30% avg pax satisfaction recente.
    /// </summary>
    public async Task<decimal> RecalculateGlobalReputationAsync(Guid companyId, CancellationToken ct)
    {
        try
        {
            await _supabase.EnsureInitializedAsync(ct);
            var client = _supabase.Client;

            // Route reputations weighted by flight_count
            var repResp = await client.From<ReputationRow>()
                .Where(r => r.CompanyId == companyId)
                .Get(ct);
            var reps = repResp.Models;

            decimal repPart = 50m; // default
            if (reps.Count > 0)
            {
                var totalFlights = reps.Sum(r => r.FlightCount);
                if (totalFlights > 0)
                    repPart = reps.Sum(r => r.Score * r.FlightCount) / totalFlights;
            }

            // Recent pax satisfaction (last 10 flights)
            var flightsResp = await client.From<FlightRow>()
                .Where(f => f.CompanyId == companyId)
                .Order(f => f.CompletedAt, Supabase.Postgrest.Constants.Ordering.Descending)
                .Limit(10)
                .Get(ct);
            var recentFlights = flightsResp.Models.Where(f => f.PaxSatisfaction.HasValue).ToList();

            decimal paxPart = 50m; // default
            if (recentFlights.Count > 0)
                paxPart = recentFlights.Average(f => f.PaxSatisfaction!.Value);

            var globalRep = Math.Clamp(repPart * 0.7m + paxPart * 0.3m, 0m, 100m);
            return Math.Round(globalRep, 2);
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "Failed to recalculate global reputation");
            return 50m;
        }
    }
}
