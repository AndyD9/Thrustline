namespace Thrustline.Bridge.Services;

/// <summary>
/// Met à jour l'état d'usure d'un avion après un atterrissage.
///
/// - cycles += 1
/// - total_hours += durée du vol en heures
/// - health_pct décroît :
///     base           = -0.5 %                  (usure normale par cycle)
///     hard landing   = -2.0 %   si |vs| > 600  (>600 fpm à l'atterrissage)
///     very hard      = -5.0 %   si |vs| > 1000
///     crash-level    = -12.0 %  si |vs| > 1500
///
/// Garantit health_pct >= 0.
/// </summary>
public class MaintenanceService
{
    public MaintenanceUpdate Apply(
        decimal currentHealthPct,
        int currentCycles,
        decimal currentTotalHours,
        int durationMin,
        decimal landingVsFpm,
        decimal wearMultiplier = 1.0m)
    {
        var absVs = Math.Abs(landingVsFpm);

        decimal penalty = 0.5m; // base wear
        if (absVs > 1500m)      penalty = 12m;
        else if (absVs > 1000m) penalty = 5m;
        else if (absVs > 600m)  penalty = 2m;

        // MRO partnership reduces wear
        penalty *= Math.Clamp(wearMultiplier, 0.5m, 1.0m);

        var newHealth = Math.Max(0m, currentHealthPct - penalty);
        var newCycles = currentCycles + 1;
        var newHours = currentTotalHours + (decimal)durationMin / 60m;

        return new MaintenanceUpdate(
            HealthPct: Math.Round(newHealth, 2),
            Cycles: newCycles,
            TotalHours: Math.Round(newHours, 2),
            HealthPenalty: penalty);
    }
}

public record MaintenanceUpdate(decimal HealthPct, int Cycles, decimal TotalHours, decimal HealthPenalty);
