using Microsoft.EntityFrameworkCore;
using Thrustline.Data;
using Thrustline.Models;

namespace Thrustline.Services.GameEngine;

public record MaintenanceResult(
    double NewHealthPct,
    bool IsHardLanding,
    bool LightMaintenance,
    bool HeavyMaintenance,
    bool Grounded);

public static class MaintenanceEngine
{
    private const double WearPerFlightHour = 0.1;
    private const double HardLandingPenalty = 2;
    private const double LightMaintenanceCost = 5_000;
    private const double HeavyMaintenanceCost = 40_000;

    public static MaintenanceResult ComputeWear(double currentHealthPct, int durationMin, double landingVsFpm)
    {
        var isHardLanding = landingVsFpm < -600;

        var newHealth = currentHealthPct;
        newHealth -= (durationMin / 60.0) * WearPerFlightHour;
        if (isHardLanding) newHealth -= HardLandingPenalty;
        newHealth = Math.Max(0, Math.Round(newHealth * 100) / 100);

        return new MaintenanceResult(
            NewHealthPct: newHealth,
            IsHardLanding: isHardLanding,
            LightMaintenance: newHealth < 80 && currentHealthPct >= 80,
            HeavyMaintenance: newHealth < 50 && currentHealthPct >= 50,
            Grounded: newHealth < 50
        );
    }

    public static async Task ApplyMaintenanceAsync(
        ThrustlineDbContext db,
        string aircraftId,
        string companyId,
        string flightId,
        MaintenanceResult result)
    {
        var aircraft = await db.Aircraft.FirstAsync(a => a.Id == aircraftId);
        aircraft.HealthPct = result.NewHealthPct;

        if (result.LightMaintenance)
        {
            db.Transactions.Add(new Transaction
            {
                Type = "maintenance",
                Amount = -LightMaintenanceCost,
                Description = "Light maintenance check (health < 80%)",
                FlightId = flightId,
                CompanyId = companyId,
            });

            var company = await db.Companies.FirstAsync(c => c.Id == companyId);
            company.Capital -= LightMaintenanceCost;
        }

        if (result.HeavyMaintenance)
        {
            db.Transactions.Add(new Transaction
            {
                Type = "maintenance",
                Amount = -HeavyMaintenanceCost,
                Description = "Heavy maintenance required (health < 50%) — aircraft grounded",
                FlightId = flightId,
                CompanyId = companyId,
            });

            var company = await db.Companies.FirstAsync(c => c.Id == companyId);
            company.Capital -= HeavyMaintenanceCost;
        }

        await db.SaveChangesAsync();
    }
}
