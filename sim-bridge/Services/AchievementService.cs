using Microsoft.AspNetCore.SignalR;
using Thrustline.Bridge.Cloud;
using Thrustline.Bridge.Cloud.Models;
using Thrustline.Bridge.SimConnect;

namespace Thrustline.Bridge.Services;

/// <summary>
/// Verifie et decerne les achievements apres chaque vol.
/// 16 achievements couvrant : vols, landings, distance, heures, routes, finances, precision.
/// </summary>
public class AchievementService
{
    private readonly ISupabaseClientProvider _supabase;
    private readonly IHubContext<SimHub> _hub;
    private readonly ILogger<AchievementService> _log;

    public AchievementService(
        ISupabaseClientProvider supabase,
        IHubContext<SimHub> hub,
        ILogger<AchievementService> log)
    {
        _supabase = supabase;
        _hub = hub;
        _log = log;
    }

    private record AchievementDef(string Key, string Title, string Description, string Icon);

    private static readonly AchievementDef[] Definitions =
    [
        new("first_flight",        "First Flight",        "Complete your first flight",                      "plane"),
        new("ten_flights",         "Frequent Flyer",      "Complete 10 flights",                             "plane"),
        new("fifty_flights",       "Veteran Pilot",       "Complete 50 flights",                             "award"),
        new("hundred_flights",     "Sky Legend",           "Complete 100 flights",                            "crown"),
        new("first_greaser",       "Butter Landing",      "Land with less than 100 fpm",                     "heart"),
        new("fifty_greasers",      "Smooth Operator",     "50 landings under 100 fpm",                       "zap"),
        new("a_plus_landing",      "Perfection",          "Achieve an A+ landing grade",                     "star"),
        new("first_transatlantic", "Transatlantic",       "Fly a route longer than 1,500 nm",                "globe"),
        new("circumnavigator",     "Around the World",    "Accumulate 21,600+ nm total distance",            "globe-2"),
        new("hundred_hours",       "Century",             "Fly 100+ total hours",                            "clock"),
        new("thousand_hours",      "Thousand Hours",      "Fly 1,000+ total hours",                          "timer"),
        new("five_routes",         "Route Explorer",      "Fly 5 unique routes",                             "map"),
        new("twenty_routes",       "Network Builder",     "Fly 20 unique routes",                            "map-pin"),
        new("millionaire",         "Millionaire",         "Reach $1,000,000 in capital",                     "banknote"),
        new("perfect_fuel",        "Fuel Miser",          "Achieve 95%+ fuel accuracy on a flight",          "fuel"),
        new("pax_loved",           "Passenger Favorite",  "Achieve 95+ passenger satisfaction on a flight",  "smile"),
    ];

    /// <summary>
    /// Verifie tous les achievements non encore debloqués et decerne ceux merites.
    /// Retourne la liste des nouveaux achievements.
    /// </summary>
    public async Task<List<AchievementRow>> CheckAndAwardAsync(
        FlightRow flight,
        CompanyRow company,
        Guid userId,
        CancellationToken ct)
    {
        if (!_supabase.IsConfigured) return [];

        try
        {
            await _supabase.EnsureInitializedAsync(ct);
            var client = _supabase.Client;

            // 1. Load already-earned keys
            var earnedResp = await client.From<AchievementRow>()
                .Where(a => a.CompanyId == company.Id)
                .Get(ct);
            var earnedKeys = new HashSet<string>(earnedResp.Models.Select(a => a.Key));

            // 2. Check which definitions are not yet earned
            var candidates = Definitions.Where(d => !earnedKeys.Contains(d.Key)).ToList();
            if (candidates.Count == 0) return [];

            // 3. Load aggregate stats for evaluation
            var flightsResp = await client.From<FlightRow>()
                .Where(f => f.CompanyId == company.Id)
                .Get(ct);
            var allFlights = flightsResp.Models;

            var totalFlights = allFlights.Count;
            var totalDistanceNm = allFlights.Sum(f => f.DistanceNm);
            var totalHours = allFlights.Sum(f => f.DurationMin) / 60m;
            var greasers = allFlights.Count(f => Math.Abs(f.LandingVsFpm) < 100m);
            var uniqueRoutes = allFlights
                .Select(f => $"{f.DepartureIcao}-{f.ArrivalIcao}")
                .Distinct()
                .Count();

            // 4. Evaluate each candidate
            var newAchievements = new List<AchievementRow>();

            foreach (var def in candidates)
            {
                bool earned = def.Key switch
                {
                    "first_flight"        => totalFlights >= 1,
                    "ten_flights"         => totalFlights >= 10,
                    "fifty_flights"       => totalFlights >= 50,
                    "hundred_flights"     => totalFlights >= 100,
                    "first_greaser"       => greasers >= 1,
                    "fifty_greasers"      => greasers >= 50,
                    "a_plus_landing"      => flight.LandingGrade == "A+",
                    "first_transatlantic" => flight.DistanceNm > 1500m,
                    "circumnavigator"     => totalDistanceNm > 21600m,
                    "hundred_hours"       => totalHours >= 100m,
                    "thousand_hours"      => totalHours >= 1000m,
                    "five_routes"         => uniqueRoutes >= 5,
                    "twenty_routes"       => uniqueRoutes >= 20,
                    "millionaire"         => company.Capital >= 1_000_000m,
                    "perfect_fuel"        => flight.FuelAccuracyPct is not null && flight.FuelAccuracyPct >= 95m,
                    "pax_loved"           => flight.PaxSatisfaction is not null && flight.PaxSatisfaction >= 95m,
                    _ => false,
                };

                if (!earned) continue;

                newAchievements.Add(new AchievementRow
                {
                    UserId = userId,
                    CompanyId = company.Id,
                    Key = def.Key,
                    Title = def.Title,
                    Description = def.Description,
                    Icon = def.Icon,
                    UnlockedAt = DateTime.UtcNow,
                    FlightId = flight.Id,
                });
            }

            // 5. Batch insert (unique constraint prevents duplicates)
            if (newAchievements.Count > 0)
            {
                try
                {
                    await client.From<AchievementRow>()
                        .Insert(newAchievements, cancellationToken: ct);

                    foreach (var a in newAchievements)
                    {
                        _log.LogInformation("Achievement unlocked: {Title} ({Key})", a.Title, a.Key);
                        await _hub.Clients.All.SendAsync("achievementUnlocked", new
                        {
                            key = a.Key,
                            title = a.Title,
                            description = a.Description,
                            icon = a.Icon,
                        }, ct);
                    }
                }
                catch (Exception ex)
                {
                    // Unique constraint violation = already earned (race condition), safe to ignore
                    _log.LogWarning(ex, "Achievement insert partially failed (possible race condition)");
                }
            }

            return newAchievements;
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "Failed to check achievements");
            return [];
        }
    }
}
