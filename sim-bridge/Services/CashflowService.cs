namespace Thrustline.Bridge.Services;

/// <summary>
/// Calcule les coûts opérationnels d'un vol (fuel + landing fee) et le net.
///
/// Formules v1 :
///   fuel_cost    = fuel_used_gal * price_per_gal    (price_per_gal = 5.50 $)
///   landing_fee  = 500 $ plat (à raffiner avec le MTOW de l'avion plus tard)
///   net          = revenue - fuel_cost - landing_fee
///
/// Les modificateurs (fuel_spike/drop événements) sont injectables via le paramètre
/// fuelPriceMultiplier.
/// </summary>
public class CashflowService
{
    private const decimal BaseFuelPriceGal = 5.50m;
    private const decimal BaseLandingFee = 500m;

    public LandingFinancials Compute(
        decimal revenue,
        decimal fuelUsedGal,
        decimal fuelPriceMultiplier = 1.0m,
        decimal landingFeeMultiplier = 1.0m)
    {
        var fuelCost = Math.Round(fuelUsedGal * BaseFuelPriceGal * fuelPriceMultiplier, 2);
        var landingFee = Math.Round(BaseLandingFee * landingFeeMultiplier, 2);
        var net = Math.Round(revenue - fuelCost - landingFee, 2);
        return new LandingFinancials(revenue, fuelCost, landingFee, net);
    }
}

public record LandingFinancials(decimal Revenue, decimal FuelCost, decimal LandingFee, decimal NetResult);
