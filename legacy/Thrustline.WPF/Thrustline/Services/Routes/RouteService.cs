using Microsoft.EntityFrameworkCore;
using Thrustline.Data;
using Thrustline.Models;

namespace Thrustline.Services.Routes;

public record DiscoveredRoute(string OriginIcao, string DestIcao, int FlightCount, double TotalRevenue, double TotalNet, double AvgNet, double AvgVs);

public class RouteService
{
    private readonly IDbContextFactory<ThrustlineDbContext> _dbFactory;

    public RouteService(IDbContextFactory<ThrustlineDbContext> dbFactory) => _dbFactory = dbFactory;

    public async Task<List<DiscoveredRoute>> GetDiscoveredRoutesAsync(string userId)
    {
        await using var db = await _dbFactory.CreateDbContextAsync();
        var company = await db.Companies.FirstOrDefaultAsync(c => c.UserId == userId);
        if (company == null) return new();

        return await db.Flights
            .Where(f => f.CompanyId == company.Id)
            .GroupBy(f => new { f.DepartureIcao, f.ArrivalIcao })
            .Select(g => new DiscoveredRoute(
                g.Key.DepartureIcao, g.Key.ArrivalIcao,
                g.Count(), g.Sum(f => f.Revenue), g.Sum(f => f.NetResult),
                g.Average(f => f.NetResult), g.Average(f => f.LandingVsFpm)))
            .ToListAsync();
    }

    public async Task<List<Route>> GetSavedRoutesAsync(string userId)
    {
        await using var db = await _dbFactory.CreateDbContextAsync();
        var company = await db.Companies.FirstOrDefaultAsync(c => c.UserId == userId);
        if (company == null) return new();
        return await db.Routes.Where(r => r.CompanyId == company.Id && r.Active).ToListAsync();
    }

    public async Task<Route> CreateRouteAsync(string userId, string originIcao, string destIcao)
    {
        await using var db = await _dbFactory.CreateDbContextAsync();
        var company = await db.Companies.FirstOrDefaultAsync(c => c.UserId == userId)
            ?? throw new InvalidOperationException("No company found.");
        var route = new Route
        {
            OriginIcao = originIcao.ToUpperInvariant(), DestIcao = destIcao.ToUpperInvariant(),
            DistanceNm = 0, BasePrice = 0, CompanyId = company.Id, UserId = userId,
        };
        db.Routes.Add(route);
        await db.SaveChangesAsync();
        return route;
    }

    public async Task DeleteRouteAsync(string id)
    {
        await using var db = await _dbFactory.CreateDbContextAsync();
        var route = await db.Routes.FirstOrDefaultAsync(r => r.Id == id);
        if (route == null) return;
        route.Active = false;
        await db.SaveChangesAsync();
    }
}
