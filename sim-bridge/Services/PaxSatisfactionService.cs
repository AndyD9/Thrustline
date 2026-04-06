using System.Text.Json;
using Thrustline.Bridge.Cloud.Models;

namespace Thrustline.Bridge.Services;

/// <summary>
/// Calcule un score de satisfaction passagers (0-100) base sur :
///   - Qualite de l'atterrissage (60%)
///   - Ponctualite vs OFP (40%)
/// </summary>
public class PaxSatisfactionService
{
    /// <summary>
    /// Calcule la satisfaction passagers.
    /// </summary>
    public decimal Compute(decimal landingVsFpm, int durationMin, DispatchRow? dispatch)
    {
        var landingScore = ComputeLandingScore(landingVsFpm);
        var punctualityScore = ComputePunctualityScore(durationMin, dispatch);

        var weighted = landingScore * 0.6m + punctualityScore * 0.4m;
        return Math.Round(Math.Clamp(weighted, 0m, 100m), 2);
    }

    /// <summary>
    /// Map le VS au touchdown vers un score 0-100.
    /// </summary>
    private static decimal ComputeLandingScore(decimal landingVsFpm)
    {
        var absVs = Math.Abs(landingVsFpm);
        return absVs switch
        {
            < 100m  => 100m,
            < 200m  => 90m,
            < 300m  => 75m,
            < 600m  => 50m,
            < 1000m => 20m,
            _       => 0m,
        };
    }

    /// <summary>
    /// Compare la duree reelle vs estimee OFP.
    /// Sans OFP → score neutre de 70.
    /// </summary>
    private static decimal ComputePunctualityScore(int durationMin, DispatchRow? dispatch)
    {
        if (dispatch?.OfpData is null)
            return 70m;

        try
        {
            using var doc = JsonDocument.Parse(dispatch.OfpData);
            var root = doc.RootElement;

            // SimBrief OFP: times.est_time_enroute (seconds)
            if (!root.TryGetProperty("times", out var timesObj))
                return 70m;

            if (!timesObj.TryGetProperty("est_time_enroute", out var enrouteEl))
                return 70m;

            decimal estimSec = 0;
            if (enrouteEl.ValueKind == JsonValueKind.Number)
                estimSec = enrouteEl.GetDecimal();
            else if (enrouteEl.ValueKind == JsonValueKind.String && decimal.TryParse(enrouteEl.GetString(), out var v))
                estimSec = v;

            if (estimSec <= 0)
                return 70m;

            var estimMin = estimSec / 60m;
            var deviation = Math.Abs(durationMin - estimMin) / estimMin;

            return deviation switch
            {
                <= 0.10m => 100m,  // within 10%
                <= 0.20m => 80m,   // within 20%
                <= 0.30m => 60m,   // within 30%
                _        => 40m,   // more than 30% off
            };
        }
        catch
        {
            return 70m;
        }
    }
}
