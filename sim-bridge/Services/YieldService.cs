namespace Thrustline.Bridge.Services;

/// <summary>
/// Calcule le revenue d'un vol à partir du pax transporté, de la distance et de la réputation.
///
/// Formule v1 (simple, tunable plus tard) :
///   revenue = (paxEco * pricePerPaxNm + paxBiz * pricePerPaxNm * bizMultiplier) * distanceNm * repMult
///
///   pricePerPaxNm       = 0.18 $/pax/nm  (base)
///   bizMultiplier       = 3.0
///   repMult             = 0.5 + score / 100    → 0.5 @ score=0, 1.0 @ 50, 1.5 @ 100
///
/// Les modificateurs d'événements (tourism_boom, strike...) seront appliqués en amont
/// par LandingProcessor en multipliant le résultat.
/// </summary>
public class YieldService
{
    private const decimal PricePerPaxNm = 0.18m;
    private const decimal BizMultiplier = 3.0m;

    public decimal Compute(
        int paxEco,
        int paxBiz,
        decimal distanceNm,
        decimal reputationScore,
        decimal priceModifier = 1.0m)
    {
        if (distanceNm <= 0 || (paxEco == 0 && paxBiz == 0)) return 0m;

        var repMult = 0.5m + (Math.Clamp(reputationScore, 0m, 100m) / 100m);
        var effectivePax = paxEco + (paxBiz * BizMultiplier);
        var revenue = effectivePax * PricePerPaxNm * distanceNm * repMult * Math.Clamp(priceModifier, 0.5m, 2.0m);
        return Math.Round(revenue, 2);
    }
}
