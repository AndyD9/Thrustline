using Microsoft.EntityFrameworkCore;
using Thrustline.Data;
using Thrustline.Models;

namespace Thrustline.Services.GameEngine;

public static class EventEngine
{
    private const double EventChance = 0.15;

    private record EventTemplate(string Type, string Scope, string Title, string Desc, double Modifier, int MinHours, int MaxHours);

    private static readonly EventTemplate[] Templates =
    {
        // Global — fuel costs
        new("fuel_spike",   "global",   "Fuel Price Surge",   "Oil prices surged due to geopolitical tensions.",     1.30, 12, 48),
        new("fuel_drop",    "global",   "Fuel Prices Drop",   "Oversupply brought fuel prices down.",                0.75, 12, 36),
        // Route — demand or block
        new("weather",      "route",    "Severe Weather",     "Route closed due to severe weather conditions.",      0,     4, 12),
        new("tourism_boom", "route",    "Tourism Boom",       "Tourism surge — passenger demand increased!",         1.20, 24, 72),
        new("strike",       "route",    "Airport Strike",     "Airport staff on strike — departures suspended.",     0,     6, 24),
        // Aircraft — ground
        new("mechanical",   "aircraft", "Mechanical Issue",   "Unexpected maintenance required — aircraft grounded.", 0,    6, 24),
    };

    public static async Task<GameEvent?> RollRandomEventAsync(ThrustlineDbContext db, string companyId)
    {
        if (Random.Shared.NextDouble() > EventChance) return null;

        var activeCount = await db.GameEvents.CountAsync(e => e.CompanyId == companyId && e.ExpiresAt > DateTime.UtcNow);
        if (activeCount >= 3) return null;

        var template = Templates[Random.Shared.Next(Templates.Length)];
        var durationHours = template.MinHours + Random.Shared.NextDouble() * (template.MaxHours - template.MinHours);
        var expiresAt = DateTime.UtcNow.AddHours(durationHours);

        string? targetId = null;

        if (template.Scope == "route")
        {
            var flights = await db.Flights
                .Where(f => f.CompanyId == companyId)
                .Select(f => new { f.DepartureIcao, f.ArrivalIcao })
                .Distinct()
                .Take(20)
                .ToListAsync();

            if (flights.Count == 0) return null;
            var f = flights[Random.Shared.Next(flights.Count)];
            targetId = $"{f.DepartureIcao}-{f.ArrivalIcao}";
        }
        else if (template.Scope == "aircraft")
        {
            var aircraftIds = await db.Aircraft
                .Where(a => a.CompanyId == companyId)
                .Select(a => a.Id)
                .ToListAsync();

            if (aircraftIds.Count == 0) return null;
            targetId = aircraftIds[Random.Shared.Next(aircraftIds.Count)];
        }

        var gameEvent = new GameEvent
        {
            Type = template.Type,
            Scope = template.Scope,
            TargetId = targetId,
            Title = template.Title,
            Description = template.Desc,
            Modifier = template.Modifier,
            ExpiresAt = expiresAt,
            CompanyId = companyId,
        };

        db.GameEvents.Add(gameEvent);
        await db.SaveChangesAsync();
        return gameEvent;
    }

    public static async Task<List<GameEvent>> GetActiveEventsAsync(ThrustlineDbContext db, string companyId)
    {
        return await db.GameEvents
            .Where(e => e.CompanyId == companyId && e.ExpiresAt > DateTime.UtcNow)
            .OrderBy(e => e.ExpiresAt)
            .ToListAsync();
    }

    public static async Task<int> CleanExpiredEventsAsync(ThrustlineDbContext db, string companyId)
    {
        var expired = await db.GameEvents
            .Where(e => e.CompanyId == companyId && e.ExpiresAt < DateTime.UtcNow)
            .ToListAsync();

        db.GameEvents.RemoveRange(expired);
        await db.SaveChangesAsync();
        return expired.Count;
    }

    /// <summary>Returns fuel cost multiplier from all active global events</summary>
    public static double GetFuelMultiplier(IEnumerable<GameEvent> events)
    {
        return events
            .Where(e => e.Scope == "global" && (e.Type == "fuel_spike" || e.Type == "fuel_drop"))
            .Aggregate(1.0, (mult, e) => mult * e.Modifier);
    }

    /// <summary>Returns load factor bonus from tourism boom events</summary>
    public static double GetRouteLoadBonus(IEnumerable<GameEvent> events, string originIcao, string destIcao)
    {
        var routeKey = $"{originIcao}-{destIcao}";
        return events
            .Where(e => e.Scope == "route" && e.Type == "tourism_boom" && e.TargetId == routeKey)
            .Sum(e => (e.Modifier - 1.0) * 0.4);
    }

    /// <summary>Returns blocker title if route is blocked by weather or strike, null otherwise</summary>
    public static string? IsRouteBlocked(IEnumerable<GameEvent> events, string originIcao, string destIcao)
    {
        var routeKey = $"{originIcao}-{destIcao}";
        return events.FirstOrDefault(e => e.Scope == "route" && e.Modifier == 0 && e.TargetId == routeKey)?.Title;
    }

    /// <summary>Returns blocker title if aircraft is grounded by mechanical event, null otherwise</summary>
    public static string? IsAircraftGroundedByEvent(IEnumerable<GameEvent> events, string aircraftId)
    {
        return events.FirstOrDefault(e => e.Scope == "aircraft" && e.Modifier == 0 && e.TargetId == aircraftId)?.Title;
    }
}
