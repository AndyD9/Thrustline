using CommunityToolkit.Mvvm.Messaging;
using Microsoft.EntityFrameworkCore;
using Thrustline.Data;
using Thrustline.Messages;
using Thrustline.Models;
using Thrustline.Services.SimConnect;

namespace Thrustline.Services.GameEngine;

/// <summary>
/// Orchestrates all post-landing processing: yield, costs, flight record,
/// cashflow, maintenance, crew duty, reputation, dispatch linking, notifications.
/// Port of processLanding() from electron/main.ts lines 221-349.
/// </summary>
public class LandingProcessor
{
    private readonly IDbContextFactory<ThrustlineDbContext> _dbFactory;
    private readonly AirportService _airports;

    public LandingProcessor(IDbContextFactory<ThrustlineDbContext> dbFactory, AirportService airports)
    {
        _dbFactory = dbFactory;
        _airports = airports;
    }

    public async Task ProcessAsync(FlightRecord record, string companyId, string userId)
    {
        await using var db = await _dbFactory.CreateDbContextAsync();

        var company = await db.Companies
            .Include(c => c.Fleet)
            .FirstOrDefaultAsync(c => c.Id == companyId);

        if (company == null) return;

        // Resolve active aircraft
        var activeAircraft = company.ActiveAircraftId != null
            ? await db.Aircraft.FirstOrDefaultAsync(a => a.Id == company.ActiveAircraftId)
            : await db.Aircraft.FirstOrDefaultAsync(a => a.CompanyId == companyId);

        var icaoType = activeAircraft?.IcaoType ?? "B738";
        var aircraftId = activeAircraft?.Id;

        // 1. Active events → fuel & demand modifiers
        var activeEvents = await EventEngine.GetActiveEventsAsync(db, companyId);
        var fuelMultiplier = EventEngine.GetFuelMultiplier(activeEvents);
        var loadBonus = EventEngine.GetRouteLoadBonus(activeEvents, record.DepartureIcao, record.ArrivalIcao);

        // 2. Route reputation
        var (repScore, _) = await ReputationEngine.GetRouteReputationAsync(db, record.DepartureIcao, record.ArrivalIcao, companyId);

        // 3. Yield
        var yieldResult = YieldEngine.ComputeYield(record.DistanceNm, icaoType, repScore, loadBonus);

        // 4. Costs
        var costs = CashflowEngine.ComputeCosts(record.FuelUsedGal, record.ArrivalIcao, yieldResult.Revenue, fuelMultiplier);

        // 5. Create flight record
        var flight = new Flight
        {
            DepartureIcao = record.DepartureIcao,
            ArrivalIcao = record.ArrivalIcao,
            DurationMin = record.DurationMin,
            FuelUsedGal = record.FuelUsedGal,
            DistanceNm = record.DistanceNm,
            LandingVsFpm = record.LandingVsFpm,
            Revenue = yieldResult.Revenue,
            FuelCost = costs.FuelCost,
            LandingFee = costs.LandingFee,
            NetResult = costs.NetResult,
            CompanyId = companyId,
            AircraftId = aircraftId,
            UserId = userId,
        };
        db.Flights.Add(flight);
        await db.SaveChangesAsync();

        // 6. Record cashflow
        await CashflowEngine.RecordCashflowAsync(db, companyId, flight.Id, costs.FuelCost, costs.LandingFee, yieldResult.Revenue, costs.NetResult);

        // 7. Maintenance
        bool isHardLanding = false, grounded = false;
        double? healthAfter = null;

        if (aircraftId != null)
        {
            var currentAircraft = await db.Aircraft.FirstOrDefaultAsync(a => a.Id == aircraftId);
            if (currentAircraft != null)
            {
                var wearResult = MaintenanceEngine.ComputeWear(currentAircraft.HealthPct, record.DurationMin, record.LandingVsFpm);
                await MaintenanceEngine.ApplyMaintenanceAsync(db, aircraftId, companyId, flight.Id, wearResult);

                currentAircraft.TotalHours += record.DurationMin / 60.0;
                currentAircraft.Cycles += 1;
                await db.SaveChangesAsync();

                // Add duty hours to assigned crew
                var crew = await db.CrewMembers.Where(c => c.AircraftId == aircraftId).ToListAsync();
                foreach (var c in crew) c.DutyHours += record.DurationMin / 60.0;
                await db.SaveChangesAsync();

                isHardLanding = wearResult.IsHardLanding;
                grounded = wearResult.Grounded;
                healthAfter = wearResult.NewHealthPct;
            }
        }

        // 8. Update reputation
        var avgHealth = await db.Aircraft
            .Where(a => a.CompanyId == companyId)
            .AverageAsync(a => (double?)a.HealthPct) ?? 100;

        await ReputationEngine.UpdateReputationAsync(db, record.DepartureIcao, record.ArrivalIcao, companyId,
            new ReputationFactors(record.LandingVsFpm, yieldResult.LoadFactor, avgHealth));

        // 9. Auto-link to matching dispatch
        var dispatch = await db.Dispatches.FirstOrDefaultAsync(d =>
            d.OriginIcao == record.DepartureIcao &&
            d.DestIcao == record.ArrivalIcao &&
            (d.Status == "pending" || d.Status == "dispatched" || d.Status == "flying"));

        if (dispatch != null)
        {
            dispatch.Status = "completed";
            dispatch.FlightId = flight.Id;
            await db.SaveChangesAsync();
            WeakReferenceMessenger.Default.Send(new DispatchUpdatedMessage());
        }

        // 10. Send messages to UI
        WeakReferenceMessenger.Default.Send(new FlightEndedMessage(flight, record, costs.NetResult, isHardLanding, grounded, healthAfter));
    }
}
