namespace Thrustline.Bridge.Services;

/// <summary>
/// Applies aircraft wear after a landing. Wear combines one flight cycle,
/// elapsed flight time, and an additive touchdown penalty.
/// </summary>
public class MaintenanceService
{
    private const decimal CycleWearPct = 0.08m;
    private const decimal HourlyWearPct = 0.04m;

    public MaintenanceUpdate Apply(
        decimal currentHealthPct,
        int currentCycles,
        decimal currentTotalHours,
        int durationMin,
        decimal landingVsFpm,
        decimal wearMultiplier = 1.0m)
    {
        var flightHours = Math.Max(0m, (decimal)durationMin / 60m);
        var normalWear = CycleWearPct + flightHours * HourlyWearPct;
        var landingWear = ComputeLandingWear(Math.Abs(landingVsFpm));

        // An MRO partnership reduces the complete wear accumulated by the flight.
        var penalty = (normalWear + landingWear) * Math.Clamp(wearMultiplier, 0.5m, 1.0m);
        penalty = Math.Round(penalty, 2, MidpointRounding.AwayFromZero);

        var newHealth = Math.Max(0m, currentHealthPct - penalty);
        var newCycles = currentCycles + 1;
        var newHours = currentTotalHours + flightHours;

        return new MaintenanceUpdate(
            HealthPct: Math.Round(newHealth, 2),
            Cycles: newCycles,
            TotalHours: Math.Round(newHours, 2),
            HealthPenalty: penalty,
            NormalWear: Math.Round(normalWear, 2, MidpointRounding.AwayFromZero),
            LandingWear: landingWear);
    }

    private static decimal ComputeLandingWear(decimal absoluteVerticalSpeedFpm) => absoluteVerticalSpeedFpm switch
    {
        <= 300m => 0m,
        <= 600m => 0.05m,
        <= 900m => 0.30m,
        <= 1200m => 1.00m,
        <= 1500m => 3.00m,
        _ => 6.00m,
    };
}

public record MaintenanceUpdate(
    decimal HealthPct,
    int Cycles,
    decimal TotalHours,
    decimal HealthPenalty,
    decimal NormalWear,
    decimal LandingWear);
