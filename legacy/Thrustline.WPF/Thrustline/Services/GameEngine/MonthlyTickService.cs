using CommunityToolkit.Mvvm.Messaging;
using Microsoft.EntityFrameworkCore;
using Thrustline.Data;
using Thrustline.Messages;
using Thrustline.Models;

namespace Thrustline.Services.GameEngine;

/// <summary>
/// Runs periodic timers for monthly deductions and event rolling.
/// Port of electron/main.ts lines 469-531.
/// </summary>
public class MonthlyTickService : IDisposable
{
    private readonly IDbContextFactory<ThrustlineDbContext> _dbFactory;
    private Timer? _monthlyTimer;
    private Timer? _eventTimer;
    private string? _companyId;
    private string? _userId;

    public MonthlyTickService(IDbContextFactory<ThrustlineDbContext> dbFactory)
    {
        _dbFactory = dbFactory;
    }

    public void Start(string companyId, string userId)
    {
        _companyId = companyId;
        _userId = userId;

        // Monthly deductions every 30 seconds
        _monthlyTimer = new Timer(async _ => await MonthlyTickAsync(), null, TimeSpan.FromSeconds(30), TimeSpan.FromSeconds(30));

        // Event rolling every 60 seconds
        _eventTimer = new Timer(async _ => await EventTickAsync(), null, TimeSpan.FromSeconds(60), TimeSpan.FromSeconds(60));
    }

    private async Task MonthlyTickAsync()
    {
        if (_companyId == null || _userId == null) return;

        try
        {
            await using var db = await _dbFactory.CreateDbContextAsync();

            await DeductLeasesAsync(db);
            await DeductSalariesAsync(db);
            await DeductLoanPaymentAsync(db);
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[MonthlyTick] Error: {ex.Message}");
        }
    }

    private async Task DeductLeasesAsync(ThrustlineDbContext db)
    {
        var company = await db.Companies.Include(c => c.Fleet).FirstOrDefaultAsync(c => c.Id == _companyId);
        if (company == null) return;

        var leased = company.Fleet.Where(a => a.Ownership == "leased").ToList();
        if (leased.Count == 0) return;

        var total = leased.Sum(a => a.LeaseCostMo);

        foreach (var aircraft in leased)
        {
            db.Transactions.Add(new Transaction
            {
                Type = "lease",
                Amount = -aircraft.LeaseCostMo,
                Description = $"Monthly lease — {aircraft.Name}",
                CompanyId = company.Id,
            });
        }

        company.Capital -= total;
        await db.SaveChangesAsync();

        WeakReferenceMessenger.Default.Send(new LeaseDeductedMessage(total, leased.Count));
    }

    private async Task DeductSalariesAsync(ThrustlineDbContext db)
    {
        var company = await db.Companies.Include(c => c.Crew).FirstOrDefaultAsync(c => c.Id == _companyId);
        if (company == null || company.Crew.Count == 0) return;

        var totalSalary = company.Crew.Sum(c => c.SalaryMo);

        foreach (var member in company.Crew)
        {
            db.Transactions.Add(new Transaction
            {
                Type = "salary",
                Amount = -member.SalaryMo,
                Description = $"Monthly salary — {(member.Rank == "captain" ? "Cpt" : "FO")} {member.FirstName} {member.LastName}",
                CompanyId = company.Id,
            });
            member.DutyHours = 0; // Reset for new month
        }

        company.Capital -= totalSalary;
        await db.SaveChangesAsync();

        WeakReferenceMessenger.Default.Send(new SalaryDeductedMessage(totalSalary, company.Crew.Count));
    }

    private async Task DeductLoanPaymentAsync(ThrustlineDbContext db)
    {
        var company = await db.Companies.FirstOrDefaultAsync(c => c.Id == _companyId);
        if (company == null) return;

        var loan = await db.Loans
            .Where(l => l.CompanyId == company.Id)
            .OrderByDescending(l => l.CreatedAt)
            .FirstOrDefaultAsync();

        if (loan == null || loan.PaidMonths >= loan.TotalMonths) return;

        var payment = loan.MonthlyPayment;
        loan.RemainingAmount = Math.Max(0, loan.RemainingAmount - payment);
        loan.PaidMonths++;

        db.Transactions.Add(new Transaction
        {
            Type = "loan_payment",
            Amount = -payment,
            Description = $"Loan payment {loan.PaidMonths}/{loan.TotalMonths}",
            CompanyId = company.Id,
        });

        company.Capital -= payment;
        await db.SaveChangesAsync();

        WeakReferenceMessenger.Default.Send(new LoanPaymentMessage(payment, loan.PaidMonths, loan.TotalMonths, loan.RemainingAmount));
    }

    private async Task EventTickAsync()
    {
        if (_companyId == null) return;

        try
        {
            await using var db = await _dbFactory.CreateDbContextAsync();

            // Clean expired events
            var cleaned = await EventEngine.CleanExpiredEventsAsync(db, _companyId);
            if (cleaned > 0)
                WeakReferenceMessenger.Default.Send(new GameEventExpiredMessage(cleaned));

            // Roll new event
            var newEvent = await EventEngine.RollRandomEventAsync(db, _companyId);
            if (newEvent != null)
                WeakReferenceMessenger.Default.Send(new GameEventNewMessage(newEvent));
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[EventTick] Error: {ex.Message}");
        }
    }

    public void Stop()
    {
        _monthlyTimer?.Dispose();
        _monthlyTimer = null;
        _eventTimer?.Dispose();
        _eventTimer = null;
    }

    public void Dispose()
    {
        Stop();
        GC.SuppressFinalize(this);
    }
}
