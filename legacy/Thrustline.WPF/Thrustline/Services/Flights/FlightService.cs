using Microsoft.EntityFrameworkCore;
using Thrustline.Data;
using Thrustline.Models;

namespace Thrustline.Services.Flights;

public class FlightService
{
    private readonly IDbContextFactory<ThrustlineDbContext> _dbFactory;

    public FlightService(IDbContextFactory<ThrustlineDbContext> dbFactory) => _dbFactory = dbFactory;

    public async Task<List<Flight>> GetAllFlightsAsync(string userId, int? limit = null)
    {
        await using var db = await _dbFactory.CreateDbContextAsync();
        var company = await db.Companies.FirstOrDefaultAsync(c => c.UserId == userId);
        if (company == null) return new();

        var query = db.Flights
            .Include(f => f.Aircraft)
            .Where(f => f.CompanyId == company.Id)
            .OrderByDescending(f => f.CreatedAt);

        return limit.HasValue
            ? await query.Take(limit.Value).ToListAsync()
            : await query.ToListAsync();
    }

    public async Task<Flight?> GetByIdAsync(string id)
    {
        await using var db = await _dbFactory.CreateDbContextAsync();
        return await db.Flights.Include(f => f.Aircraft).FirstOrDefaultAsync(f => f.Id == id);
    }
}
