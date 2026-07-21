using Microsoft.EntityFrameworkCore;
using Thrustline.Data;
using Thrustline.Models;

namespace Thrustline.Services.GameEngine;

public record ReputationFactors(double LandingVsFpm, double LoadFactor, double AvgFleetHealth);

public static class ReputationEngine
{
    private const double BaseScore = 50;
    private const double MinScore = 0;
    private const double MaxScore = 100;
    private const double Smoothing = 0.85;

    private static double LandingDelta(double vsFpm)
    {
        var vs = Math.Abs(vsFpm);
        if (vs < 50) return 3;    // butter
        if (vs < 150) return 2;   // smooth
        if (vs < 300) return 1;   // normal
        if (vs < 500) return 0;   // firm
        if (vs < 700) return -3;  // hard
        return -6;                // crash-like
    }

    private static double ComputeDelta(ReputationFactors factors)
    {
        var delta = LandingDelta(factors.LandingVsFpm);

        if (factors.LoadFactor > 0.85) delta += 1;
        if (factors.LoadFactor < 0.50) delta -= 1;

        if (factors.AvgFleetHealth < 60) delta -= 2;
        else if (factors.AvgFleetHealth < 75) delta -= 1;
        else if (factors.AvgFleetHealth >= 95) delta += 1;

        return delta;
    }

    public static async Task<(double Score, int FlightCount)> GetRouteReputationAsync(
        ThrustlineDbContext db, string originIcao, string destIcao, string companyId)
    {
        var rep = await db.Reputations.FirstOrDefaultAsync(r =>
            r.OriginIcao == originIcao && r.DestIcao == destIcao && r.CompanyId == companyId);

        return rep != null ? (rep.Score, rep.FlightCount) : (BaseScore, 0);
    }

    public static async Task<(double Score, double Delta)> UpdateReputationAsync(
        ThrustlineDbContext db, string originIcao, string destIcao, string companyId, ReputationFactors factors)
    {
        var delta = ComputeDelta(factors);

        var existing = await db.Reputations.FirstOrDefaultAsync(r =>
            r.OriginIcao == originIcao && r.DestIcao == destIcao && r.CompanyId == companyId);

        var oldScore = existing?.Score ?? BaseScore;
        var newScore = Math.Clamp(
            oldScore * Smoothing + (oldScore + delta) * (1 - Smoothing),
            MinScore, MaxScore);

        if (existing != null)
        {
            existing.Score = newScore;
            existing.FlightCount++;
        }
        else
        {
            db.Reputations.Add(new Reputation
            {
                OriginIcao = originIcao,
                DestIcao = destIcao,
                CompanyId = companyId,
                Score = newScore,
                FlightCount = 1,
            });
        }

        await db.SaveChangesAsync();
        return (Math.Round(newScore * 10) / 10, delta);
    }

    public static async Task<double> GetCompanyReputationAsync(ThrustlineDbContext db, string companyId)
    {
        var reps = await db.Reputations
            .Where(r => r.CompanyId == companyId)
            .Select(r => r.Score)
            .ToListAsync();

        if (reps.Count == 0) return BaseScore;
        return Math.Round(reps.Average() * 10) / 10;
    }
}
