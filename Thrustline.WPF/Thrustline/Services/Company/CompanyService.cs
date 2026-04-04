using Microsoft.EntityFrameworkCore;
using Thrustline.Data;
using Thrustline.Models;

namespace Thrustline.Services.Company;

public record LoanOption(string Key, string Label, double Principal, int TotalMonths, double Rate);

public record SetupInput(string Name, string AirlineCode, string HubIcao, string LoanOption,
    string? AircraftIcaoType = null, string? AircraftMode = null, string? SimbriefUsername = null);

public class CompanyService
{
    private readonly IDbContextFactory<ThrustlineDbContext> _dbFactory;
    private const double DepreciationRate = 0.70;
    private const double MaintenanceCostPerPct = 500;

    public static readonly LoanOption[] LoanOptions =
    {
        new("conservative", "Conservative", 5_000_000, 60, 0.03),
        new("standard", "Standard", 10_000_000, 60, 0.03),
        new("aggressive", "Aggressive", 20_000_000, 60, 0.03),
    };

    public CompanyService(IDbContextFactory<ThrustlineDbContext> dbFactory) => _dbFactory = dbFactory;

    public static double ComputeMonthlyPayment(double principal, double annualRate, int months)
    {
        var r = annualRate / 12;
        if (r == 0) return principal / months;
        return Math.Round(principal * r / (1 - Math.Pow(1 + r, -months)) * 100) / 100;
    }

    public async Task<Models.Company?> GetCompanyAsync(string userId)
    {
        await using var db = await _dbFactory.CreateDbContextAsync();
        return await db.Companies.Include(c => c.Fleet).FirstOrDefaultAsync(c => c.UserId == userId);
    }

    public async Task<List<Aircraft>> GetFleetAsync(string userId)
    {
        await using var db = await _dbFactory.CreateDbContextAsync();
        var company = await db.Companies.FirstOrDefaultAsync(c => c.UserId == userId);
        if (company == null) return new();
        return await db.Aircraft.Where(a => a.CompanyId == company.Id).OrderBy(a => a.Name).ToListAsync();
    }

    public async Task<List<Transaction>> GetTransactionsAsync(string userId, int limit = 50)
    {
        await using var db = await _dbFactory.CreateDbContextAsync();
        var company = await db.Companies.FirstAsync(c => c.UserId == userId);
        return await db.Transactions.Where(t => t.CompanyId == company.Id).OrderByDescending(t => t.CreatedAt).Take(limit).ToListAsync();
    }

    public static double MaintenanceCost(double currentHealthPct) => Math.Round((100 - currentHealthPct) * MaintenanceCostPerPct);

    public async Task MaintainAircraftAsync(string aircraftId, string userId)
    {
        await using var db = await _dbFactory.CreateDbContextAsync();
        var aircraft = await db.Aircraft.FirstAsync(a => a.Id == aircraftId);
        var company = await db.Companies.FirstAsync(c => c.UserId == userId);
        var cost = MaintenanceCost(aircraft.HealthPct);
        if (company.Capital < cost) throw new InvalidOperationException($"Insufficient capital. Need ${cost:N0}.");

        aircraft.HealthPct = 100;
        db.Transactions.Add(new Transaction { Type = "maintenance", Amount = -cost, Description = $"Full maintenance — {aircraft.Name} restored to 100%", CompanyId = company.Id });
        company.Capital -= cost;
        await db.SaveChangesAsync();
    }

    public async Task<Aircraft> LeaseAircraftAsync(string icaoType, string userId)
    {
        await using var db = await _dbFactory.CreateDbContextAsync();
        var company = await db.Companies.FirstAsync(c => c.UserId == userId);
        var cat = AircraftCatalog.Get(icaoType) ?? throw new InvalidOperationException($"Unknown type: {icaoType}");
        if (company.Capital < cat.LeaseCostMo) throw new InvalidOperationException("Insufficient capital for first month lease.");

        var aircraft = new Aircraft { Name = cat.Name, IcaoType = cat.IcaoType, LeaseCostMo = cat.LeaseCostMo, CompanyId = company.Id, UserId = userId };
        db.Aircraft.Add(aircraft);
        db.Transactions.Add(new Transaction { Type = "lease", Amount = -cat.LeaseCostMo, Description = $"First month lease — {cat.Name}", CompanyId = company.Id });
        company.Capital -= cat.LeaseCostMo;
        await db.SaveChangesAsync();
        return aircraft;
    }

    public async Task<Aircraft> PurchaseAircraftAsync(string icaoType, string userId)
    {
        await using var db = await _dbFactory.CreateDbContextAsync();
        var company = await db.Companies.FirstAsync(c => c.UserId == userId);
        var cat = AircraftCatalog.Get(icaoType) ?? throw new InvalidOperationException($"Unknown type: {icaoType}");
        if (company.Capital < cat.PurchasePrice) throw new InvalidOperationException("Insufficient capital.");

        var aircraft = new Aircraft
        {
            Name = cat.Name, IcaoType = cat.IcaoType, LeaseCostMo = 0, Ownership = "owned",
            PurchasePrice = cat.PurchasePrice, PurchasedAt = DateTime.UtcNow, CompanyId = company.Id, UserId = userId
        };
        db.Aircraft.Add(aircraft);
        db.Transactions.Add(new Transaction { Type = "purchase", Amount = -cat.PurchasePrice, Description = $"Aircraft purchase — {cat.Name}", CompanyId = company.Id });
        company.Capital -= cat.PurchasePrice;
        await db.SaveChangesAsync();
        return aircraft;
    }

    public static double ResaleValue(double purchasePrice, double healthPct) => Math.Round(purchasePrice * (healthPct / 100) * DepreciationRate);

    public async Task<(double SalePrice, string Name)> SellAircraftAsync(string aircraftId, string userId)
    {
        await using var db = await _dbFactory.CreateDbContextAsync();
        var aircraft = await db.Aircraft.FirstAsync(a => a.Id == aircraftId);
        if (aircraft.Ownership != "owned") throw new InvalidOperationException("Only owned aircraft can be sold.");
        if (aircraft.PurchasePrice == null) throw new InvalidOperationException("No purchase price on record.");

        var company = await db.Companies.FirstAsync(c => c.UserId == userId);
        var salePrice = ResaleValue(aircraft.PurchasePrice.Value, aircraft.HealthPct);

        // Unlink flights
        var flights = await db.Flights.Where(f => f.AircraftId == aircraftId).ToListAsync();
        foreach (var f in flights) f.AircraftId = null;

        if (company.ActiveAircraftId == aircraftId) company.ActiveAircraftId = null;

        db.Aircraft.Remove(aircraft);
        db.Transactions.Add(new Transaction { Type = "sale", Amount = salePrice, Description = $"Aircraft sold — {aircraft.Name} ({aircraft.HealthPct:F0}% health)", CompanyId = company.Id });
        company.Capital += salePrice;
        await db.SaveChangesAsync();
        return (salePrice, aircraft.Name);
    }

    public async Task SetActiveAircraftAsync(string userId, string aircraftId)
    {
        await using var db = await _dbFactory.CreateDbContextAsync();
        var company = await db.Companies.FirstAsync(c => c.UserId == userId);
        await db.Aircraft.FirstAsync(a => a.Id == aircraftId && a.CompanyId == company.Id); // verify
        company.ActiveAircraftId = aircraftId;
        await db.SaveChangesAsync();
    }

    public async Task UpdateCompanyAsync(string userId, string? name, string? hubIcao, string? airlineCode, string? simbriefUsername)
    {
        await using var db = await _dbFactory.CreateDbContextAsync();
        var company = await db.Companies.FirstAsync(c => c.UserId == userId);
        if (name != null) company.Name = name;
        if (hubIcao != null) company.HubIcao = hubIcao;
        if (airlineCode != null) company.AirlineCode = airlineCode;
        if (simbriefUsername != null) company.SimbriefUsername = simbriefUsername;
        await db.SaveChangesAsync();
    }

    public async Task ResetCompanyDataAsync(string userId)
    {
        await using var db = await _dbFactory.CreateDbContextAsync();
        var company = await db.Companies.FirstAsync(c => c.UserId == userId);
        db.Flights.RemoveRange(db.Flights.Where(f => f.CompanyId == company.Id));
        db.Transactions.RemoveRange(db.Transactions.Where(t => t.CompanyId == company.Id));
        db.Routes.RemoveRange(db.Routes.Where(r => r.CompanyId == company.Id));
        company.Capital = 1_000_000;
        company.ActiveAircraftId = null;
        await db.SaveChangesAsync();
    }

    public async Task<Models.Company> SetupCompanyAsync(string userId, SetupInput input)
    {
        await using var db = await _dbFactory.CreateDbContextAsync();

        var existing = await db.Companies.FirstOrDefaultAsync(c => c.UserId == userId);
        if (existing?.Onboarded == true) throw new InvalidOperationException("Company already set up.");

        var loan = LoanOptions.FirstOrDefault(l => l.Key == input.LoanOption)
            ?? throw new InvalidOperationException($"Invalid loan: {input.LoanOption}");

        var monthlyPayment = ComputeMonthlyPayment(loan.Principal, loan.Rate, loan.TotalMonths);
        var capital = loan.Principal;

        // Delete un-onboarded company if exists
        if (existing != null)
        {
            db.RemoveRange(db.Flights.Where(f => f.CompanyId == existing.Id));
            db.RemoveRange(db.Transactions.Where(t => t.CompanyId == existing.Id));
            db.RemoveRange(db.Routes.Where(r => r.CompanyId == existing.Id));
            db.RemoveRange(db.Aircraft.Where(a => a.CompanyId == existing.Id));
            db.RemoveRange(db.CrewMembers.Where(c => c.CompanyId == existing.Id));
            db.RemoveRange(db.Reputations.Where(r => r.CompanyId == existing.Id));
            db.RemoveRange(db.GameEvents.Where(e => e.CompanyId == existing.Id));
            db.RemoveRange(db.Dispatches.Where(d => d.CompanyId == existing.Id));
            db.RemoveRange(db.Loans.Where(l => l.CompanyId == existing.Id));
            db.Companies.Remove(existing);
            await db.SaveChangesAsync();
        }

        var company = new Models.Company
        {
            Name = input.Name,
            AirlineCode = input.AirlineCode.ToUpperInvariant(),
            HubIcao = input.HubIcao.ToUpperInvariant(),
            Capital = capital,
            Onboarded = true,
            SimbriefUsername = input.SimbriefUsername?.Trim(),
            UserId = userId,
        };
        db.Companies.Add(company);
        await db.SaveChangesAsync();

        db.Loans.Add(new Loan
        {
            Principal = loan.Principal, MonthlyPayment = monthlyPayment,
            RemainingAmount = loan.Principal, TotalMonths = loan.TotalMonths,
            InterestRate = loan.Rate, CompanyId = company.Id, UserId = userId,
        });
        await db.SaveChangesAsync();

        // Optional first aircraft
        if (input.AircraftIcaoType != null)
        {
            var cat = AircraftCatalog.Get(input.AircraftIcaoType);
            if (cat != null)
            {
                var isOwned = input.AircraftMode == "buy";
                var cost = isOwned ? cat.PurchasePrice : cat.LeaseCostMo;

                if (capital >= cost)
                {
                    var aircraft = new Aircraft
                    {
                        Name = cat.Name, IcaoType = cat.IcaoType,
                        LeaseCostMo = isOwned ? 0 : cat.LeaseCostMo,
                        Ownership = isOwned ? "owned" : "leased",
                        PurchasePrice = isOwned ? cat.PurchasePrice : null,
                        PurchasedAt = isOwned ? DateTime.UtcNow : null,
                        CompanyId = company.Id, UserId = userId,
                    };
                    db.Aircraft.Add(aircraft);
                    await db.SaveChangesAsync();

                    capital -= cost;
                    db.Transactions.Add(new Transaction
                    {
                        Type = isOwned ? "purchase" : "lease",
                        Amount = -cost,
                        Description = isOwned ? $"Aircraft purchase — {cat.Name}" : $"First month lease — {cat.Name}",
                        CompanyId = company.Id,
                    });
                    company.Capital = capital;
                    company.ActiveAircraftId = aircraft.Id;
                    await db.SaveChangesAsync();
                }
            }
        }

        return company;
    }

    public async Task<Loan?> GetActiveLoanAsync(string userId)
    {
        await using var db = await _dbFactory.CreateDbContextAsync();
        var company = await db.Companies.FirstOrDefaultAsync(c => c.UserId == userId);
        if (company == null) return null;
        return await db.Loans.Where(l => l.CompanyId == company.Id).OrderByDescending(l => l.CreatedAt).FirstOrDefaultAsync();
    }
}
