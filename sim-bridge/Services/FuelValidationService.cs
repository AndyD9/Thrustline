using System.Text.Json;
using Thrustline.Bridge.Cloud.Models;

namespace Thrustline.Bridge.Services;

/// <summary>
/// Compare le fuel reellement utilise au fuel prevu par SimBrief (OFP).
/// Retourne un pourcentage de precision (100 = parfait, 0 = completement a cote).
/// </summary>
public class FuelValidationService
{
    public record FuelResult(decimal? PlannedFuelGal, decimal? FuelAccuracyPct);

    /// <summary>
    /// Extrait le fuel prevu du dispatch OFP et calcule la precision.
    /// </summary>
    public FuelResult Compute(decimal actualFuelUsedGal, DispatchRow? dispatch)
    {
        if (dispatch?.OfpData is null)
            return new(null, null);

        try
        {
            using var doc = JsonDocument.Parse(dispatch.OfpData);
            var root = doc.RootElement;

            // SimBrief OFP structure: fuel.plan_ramp (lbs)
            if (!root.TryGetProperty("fuel", out var fuelObj))
                return new(null, null);

            decimal plannedLbs = 0;

            // Try plan_ramp first (total fuel at ramp), then enroute_burn
            if (fuelObj.TryGetProperty("plan_ramp", out var rampEl))
                plannedLbs = ParseDecimal(rampEl);
            else if (fuelObj.TryGetProperty("enroute_burn", out var burnEl))
                plannedLbs = ParseDecimal(burnEl);

            if (plannedLbs <= 0)
                return new(null, null);

            // Convert lbs to gallons (Jet-A density ~6.7 lbs/gal)
            const decimal JetADensity = 6.7m;
            var plannedGal = plannedLbs / JetADensity;

            // Accuracy = 100 - |delta| / planned * 100, clamped 0-100
            var delta = Math.Abs(actualFuelUsedGal - plannedGal);
            var accuracy = Math.Max(0m, 100m - (delta / plannedGal * 100m));
            accuracy = Math.Round(accuracy, 2);

            return new(Math.Round(plannedGal, 2), accuracy);
        }
        catch
        {
            return new(null, null);
        }
    }

    private static decimal ParseDecimal(JsonElement el)
    {
        if (el.ValueKind == JsonValueKind.Number)
            return el.GetDecimal();
        if (el.ValueKind == JsonValueKind.String && decimal.TryParse(el.GetString(), out var val))
            return val;
        return 0;
    }
}
