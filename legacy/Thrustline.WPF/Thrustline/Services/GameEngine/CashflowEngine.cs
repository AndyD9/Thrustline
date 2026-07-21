using Microsoft.EntityFrameworkCore;
using Thrustline.Data;
using Thrustline.Models;

namespace Thrustline.Services.GameEngine;

public record CashflowResult(double FuelCost, double LandingFee, double NetResult);

public static class CashflowEngine
{
    public const double FuelPricePerGal = 3.20;

    private static readonly Dictionary<string, int> LandingFees = new()
    {
        ["hub"] = 800,
        ["large"] = 400,
        ["medium"] = 150,
        ["small"] = 50,
    };

    private static readonly HashSet<string> HubAirports = new(StringComparer.OrdinalIgnoreCase)
    {
        "EGLL", "KLAX", "KJFK", "KORD", "KATL", "KDFW", "KDEN",
        "LFPG", "EDDF", "EHAM", "LEMD", "LIRF", "LEBL",
        "OMDB", "VHHH", "RJTT", "YSSY", "ZBAA", "WSSS",
        "EGKK", "EDDM", "UUEE",
    };

    private static readonly HashSet<string> LargeAirports = new(StringComparer.OrdinalIgnoreCase)
    {
        "EGCC", "EDDL", "EDDB", "EDDH", "LSZH", "LSGG",
        "KBOS", "KIAD", "KSFO", "KMIA", "KLAS", "KSEA",
        "LTBA", "UKBB", "LFLL", "LFMN", "LPPT", "LPPR",
        "CYYZ", "CYVR", "CYUL", "YSME",
    };

    public static string GetAirportCategory(string icao)
    {
        var code = icao.ToUpperInvariant();
        if (HubAirports.Contains(code)) return "hub";
        if (LargeAirports.Contains(code)) return "large";
        if (code.Length > 0 && "KELY".Contains(code[0])) return "medium";
        return "small";
    }

    public static CashflowResult ComputeCosts(double fuelUsedGal, string arrivalIcao, double revenue, double fuelMultiplier = 1.0)
    {
        var fuelCost = Math.Round(fuelUsedGal * FuelPricePerGal * fuelMultiplier * 100) / 100;
        var category = GetAirportCategory(arrivalIcao);
        var landingFee = LandingFees[category];
        var netResult = Math.Round((revenue - fuelCost - landingFee) * 100) / 100;

        return new CashflowResult(fuelCost, landingFee, netResult);
    }

    public static async Task RecordCashflowAsync(
        ThrustlineDbContext db,
        string companyId,
        string flightId,
        double fuelCost,
        double landingFee,
        double revenue,
        double netResult)
    {
        db.Transactions.AddRange(
            new Transaction
            {
                Type = "revenue",
                Amount = revenue,
                Description = "Ticket sales",
                FlightId = flightId,
                CompanyId = companyId,
            },
            new Transaction
            {
                Type = "fuel",
                Amount = -fuelCost,
                Description = $"Fuel cost ({(fuelCost / FuelPricePerGal):F0} gal)",
                FlightId = flightId,
                CompanyId = companyId,
            },
            new Transaction
            {
                Type = "landing_fee",
                Amount = -landingFee,
                Description = "Landing fee",
                FlightId = flightId,
                CompanyId = companyId,
            }
        );

        var company = await db.Companies.FirstAsync(c => c.Id == companyId);
        company.Capital += netResult;

        await db.SaveChangesAsync();
    }
}
