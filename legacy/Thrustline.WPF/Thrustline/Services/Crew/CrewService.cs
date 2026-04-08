using Microsoft.EntityFrameworkCore;
using Thrustline.Data;
using Thrustline.Models;

namespace Thrustline.Services.Crew;

public record CrewCandidate(string FirstName, string LastName, string Rank, int Experience, double SalaryMo);

public class CrewService
{
    private readonly IDbContextFactory<ThrustlineDbContext> _dbFactory;

    private static readonly Dictionary<string, double> BaseSalary = new()
    {
        ["captain"] = 8_000,
        ["first_officer"] = 5_000,
    };

    private static readonly string[] FirstNames = { "James", "Sarah", "Michael", "Emma", "David", "Olivia", "Daniel", "Sophie", "Thomas", "Laura", "Alexandre", "Marie", "Lucas", "Isabelle", "Matteo", "Chloé", "William", "Charlotte", "Benjamin", "Amelia", "Henrik", "Astrid", "Carlos", "Elena", "Kenji", "Yuki", "Raj", "Priya", "Ahmed", "Fatima", "Chen", "Mei" };
    private static readonly string[] LastNames = { "Anderson", "Baker", "Chen", "Dubois", "Evans", "Fischer", "Garcia", "Hughes", "Ibrahim", "Jensen", "Kim", "Laurent", "Müller", "Nakamura", "O'Brien", "Petrov", "Quinn", "Rossi", "Schmidt", "Torres", "Underwood", "Varga", "Williams", "Xu", "Yamamoto", "Zimmerman", "Patel", "Singh", "Johansson", "Hernandez", "Kowalski", "Nguyen" };

    public CrewService(IDbContextFactory<ThrustlineDbContext> dbFactory) => _dbFactory = dbFactory;

    public static double ComputeSalary(string rank, int experience)
    {
        var basePay = BaseSalary.GetValueOrDefault(rank, BaseSalary["first_officer"]);
        return Math.Round(basePay * (1 + experience * 0.1));
    }

    public static List<CrewCandidate> GeneratePool()
    {
        var pool = new List<CrewCandidate>();
        for (var i = 0; i < 8; i++)
        {
            var rank = i < 3 ? "captain" : "first_officer";
            var exp = Random.Shared.Next(1, 10);
            pool.Add(new CrewCandidate(
                FirstNames[Random.Shared.Next(FirstNames.Length)],
                LastNames[Random.Shared.Next(LastNames.Length)],
                rank, exp, ComputeSalary(rank, exp)));
        }
        return pool;
    }

    public async Task<List<CrewMember>> GetCrewAsync(string userId)
    {
        await using var db = await _dbFactory.CreateDbContextAsync();
        var company = await db.Companies.FirstOrDefaultAsync(c => c.UserId == userId);
        if (company == null) return new();
        return await db.CrewMembers
            .Include(c => c.Aircraft)
            .Where(c => c.CompanyId == company.Id)
            .OrderBy(c => c.AircraftId).ThenBy(c => c.Rank).ThenBy(c => c.LastName)
            .ToListAsync();
    }

    public async Task<CrewMember> HireAsync(string userId, CrewCandidate candidate)
    {
        await using var db = await _dbFactory.CreateDbContextAsync();
        var company = await db.Companies.FirstAsync(c => c.UserId == userId);
        if (company.Capital < candidate.SalaryMo) throw new InvalidOperationException("Insufficient capital.");

        var member = new CrewMember
        {
            FirstName = candidate.FirstName, LastName = candidate.LastName,
            Rank = candidate.Rank, Experience = candidate.Experience,
            SalaryMo = candidate.SalaryMo, CompanyId = company.Id, UserId = userId,
        };
        db.CrewMembers.Add(member);
        db.Transactions.Add(new Transaction
        {
            Type = "salary", Amount = -candidate.SalaryMo,
            Description = $"First month salary — {(candidate.Rank == "captain" ? "Cpt" : "FO")} {candidate.FirstName} {candidate.LastName}",
            CompanyId = company.Id,
        });
        company.Capital -= candidate.SalaryMo;
        await db.SaveChangesAsync();
        return member;
    }

    public async Task FireAsync(string crewId)
    {
        await using var db = await _dbFactory.CreateDbContextAsync();
        var member = await db.CrewMembers.FirstAsync(c => c.Id == crewId);
        db.CrewMembers.Remove(member);
        await db.SaveChangesAsync();
    }

    public async Task AssignAsync(string crewId, string aircraftId)
    {
        await using var db = await _dbFactory.CreateDbContextAsync();
        var member = await db.CrewMembers.FirstAsync(c => c.Id == crewId);
        var aircraft = await db.Aircraft.FirstAsync(a => a.Id == aircraftId);
        if (member.CompanyId != aircraft.CompanyId) throw new InvalidOperationException("Different companies.");
        member.AircraftId = aircraftId;
        await db.SaveChangesAsync();
    }

    public async Task UnassignAsync(string crewId)
    {
        await using var db = await _dbFactory.CreateDbContextAsync();
        var member = await db.CrewMembers.FirstAsync(c => c.Id == crewId);
        member.AircraftId = null;
        await db.SaveChangesAsync();
    }
}
