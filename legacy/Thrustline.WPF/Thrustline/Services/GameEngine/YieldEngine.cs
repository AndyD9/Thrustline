using Thrustline.Data;

namespace Thrustline.Services.GameEngine;

public record YieldResult(double Revenue, double LoadFactor, int EcoSeats, int BizSeats, string IcaoType);

public static class YieldEngine
{
    private const int DefaultEcoSeats = 150;
    private const int DefaultBizSeats = 12;
    private const double EcoPricePerNm = 0.12;
    private const double BizPricePerNm = 0.35;

    /// <param name="reputationScore">0-100, default 50 (neutral). 0 = x0.85, 50 = x1.0, 100 = x1.15</param>
    /// <param name="loadFactorBonus">Additive bonus from events (e.g., tourism boom +0.08)</param>
    public static YieldResult ComputeYield(double distanceNm, string icaoType, double reputationScore = 50, double loadFactorBonus = 0)
    {
        var cat = AircraftCatalog.Get(icaoType.ToUpperInvariant());
        int ecoSeats = cat?.SeatsEco ?? DefaultEcoSeats;
        int bizSeats = cat?.SeatsBiz ?? DefaultBizSeats;

        // Reputation modifier: score 50 = x1.0, score 100 = x1.15, score 0 = x0.85
        var reputationModifier = 0.85 + (reputationScore / 100.0) * 0.30;

        // Load factor: 60-95% base, higher for long-haul
        var minLoad = distanceNm > 2000 ? 0.70 : 0.60;
        var baseLF = minLoad + Random.Shared.NextDouble() * (0.95 - minLoad);
        var loadFactor = Math.Clamp(baseLF * reputationModifier + loadFactorBonus, 0.30, 0.98);

        var ecoRevenue = ecoSeats * loadFactor * EcoPricePerNm * distanceNm;
        var bizRevenue = bizSeats * loadFactor * BizPricePerNm * distanceNm;
        var revenue = Math.Round((ecoRevenue + bizRevenue) * 100) / 100;

        return new YieldResult(revenue, Math.Round(loadFactor * 1000) / 1000, ecoSeats, bizSeats, icaoType);
    }
}
