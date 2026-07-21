using System.Net.Http;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Thrustline.Data;
using Thrustline.Models;
using Thrustline.Services.GameEngine;

namespace Thrustline.Services.Dispatch;

public class DispatchService
{
    private readonly IDbContextFactory<ThrustlineDbContext> _dbFactory;
    private static readonly HttpClient Http = new() { Timeout = TimeSpan.FromSeconds(10) };

    public DispatchService(IDbContextFactory<ThrustlineDbContext> dbFactory) => _dbFactory = dbFactory;

    public static (int EcoPax, int BizPax, double CargoKg, double EstimFuelLbs, int CruiseAlt) GenerateNumbers(
        string icaoType, string originIcao, string destIcao, double distanceNm)
    {
        var cat = AircraftCatalog.Get(icaoType);
        int seatsEco = cat?.SeatsEco ?? 150, seatsBiz = cat?.SeatsBiz ?? 12;
        double fuelLbsPerNm = cat?.FuelLbsPerNm ?? 45;

        var baseLF = distanceNm < 800 ? 0.72 : distanceNm < 2500 ? 0.78 : 0.85;
        var lf = Math.Clamp(baseLF + (Random.Shared.NextDouble() * 2 - 1) * 0.05, 0.45, 0.97);

        var ecoPax = (int)Math.Round(seatsEco * lf);
        var bizPax = (int)Math.Round(seatsBiz * Math.Clamp(lf + 0.05 + (Random.Shared.NextDouble() * 2 - 1) * 0.05, 0.5, 1.0));
        var totalPax = ecoPax + bizPax;
        var cargoKg = Math.Round(totalPax * 23 + (distanceNm < 1500 ? 1200 + Random.Shared.NextDouble() * 1000 : 600 + Random.Shared.NextDouble() * 800));
        var estimFuelLbs = Math.Round(distanceNm * fuelLbsPerNm * 1.22);
        var cruiseAlt = distanceNm < 400 ? 28000 : distanceNm < 1200 ? 33000 : distanceNm < 3500 ? 37000 : 39000;

        return (ecoPax, bizPax, cargoKg, estimFuelLbs, cruiseAlt);
    }

    public static string GenerateFlightNumber(string airlineCode, string origin, string dest)
    {
        var h = 5381;
        foreach (var c in origin + dest) h = ((h << 5) + h + c) & 0x7FFFFFFF;
        return $"{airlineCode[..Math.Min(3, airlineCode.Length)].ToUpperInvariant()}{1000 + h % 8000}";
    }

    public async Task<Models.Dispatch> CreateDispatchAsync(string userId, string originIcao, string destIcao, double distanceNm, string? aircraftId = null)
    {
        await using var db = await _dbFactory.CreateDbContextAsync();
        var company = await db.Companies.FirstAsync(c => c.UserId == userId);

        // Resolve aircraft
        var aircraft = aircraftId != null
            ? await db.Aircraft.FirstOrDefaultAsync(a => a.Id == aircraftId)
            : company.ActiveAircraftId != null
                ? await db.Aircraft.FirstOrDefaultAsync(a => a.Id == company.ActiveAircraftId)
                : await db.Aircraft.FirstOrDefaultAsync(a => a.CompanyId == company.Id);

        if (aircraft == null) throw new InvalidOperationException("No aircraft in fleet.");

        // Range check
        var spec = AircraftCatalog.Get(aircraft.IcaoType);
        if (spec != null && distanceNm > spec.RangeNm)
            throw new InvalidOperationException($"{aircraft.Name} range is {spec.RangeNm:N0} nm — route is {distanceNm:N0} nm.");

        // Event checks
        var events = await EventEngine.GetActiveEventsAsync(db, company.Id);
        var routeBlock = EventEngine.IsRouteBlocked(events, originIcao, destIcao);
        if (routeBlock != null) throw new InvalidOperationException($"Route blocked: {routeBlock}");
        var acBlock = EventEngine.IsAircraftGroundedByEvent(events, aircraft.Id);
        if (acBlock != null) throw new InvalidOperationException($"Aircraft grounded: {acBlock}");

        // Crew check
        var crew = await db.CrewMembers.Where(c => c.AircraftId == aircraft.Id).ToListAsync();
        if (crew.Count < 2) throw new InvalidOperationException($"{aircraft.Name} needs at least 2 crew (has {crew.Count}).");
        var exhausted = crew.FirstOrDefault(c => c.DutyHours >= c.MaxDutyH);
        if (exhausted != null) throw new InvalidOperationException($"{exhausted.FirstName} {exhausted.LastName} has reached duty hour limit.");

        var (ecoPax, bizPax, cargoKg, estimFuelLbs, cruiseAlt) = GenerateNumbers(aircraft.IcaoType, originIcao, destIcao, distanceNm);
        var fltNum = GenerateFlightNumber(company.AirlineCode, originIcao, destIcao);

        var dispatch = new Models.Dispatch
        {
            FlightNumber = fltNum, OriginIcao = originIcao.ToUpperInvariant(), DestIcao = destIcao.ToUpperInvariant(),
            IcaoType = aircraft.IcaoType, DistanceNm = distanceNm,
            EcoPax = ecoPax, BizPax = bizPax, CargoKg = cargoKg, EstimFuelLbs = estimFuelLbs, CruiseAlt = cruiseAlt,
            CompanyId = company.Id, AircraftId = aircraft.Id, UserId = userId,
        };
        db.Dispatches.Add(dispatch);
        await db.SaveChangesAsync();
        return dispatch;
    }

    public async Task<List<Models.Dispatch>> GetDispatchesAsync(string userId)
    {
        await using var db = await _dbFactory.CreateDbContextAsync();
        var company = await db.Companies.FirstOrDefaultAsync(c => c.UserId == userId);
        if (company == null) return new();
        return await db.Dispatches.Where(d => d.CompanyId == company.Id).OrderByDescending(d => d.CreatedAt).Take(50).ToListAsync();
    }

    public async Task DeleteDispatchAsync(string id)
    {
        await using var db = await _dbFactory.CreateDbContextAsync();
        var dispatch = await db.Dispatches.FirstAsync(d => d.Id == id);
        db.Dispatches.Remove(dispatch);
        await db.SaveChangesAsync();
    }

    public async Task SetStatusAsync(string id, string status)
    {
        await using var db = await _dbFactory.CreateDbContextAsync();
        var dispatch = await db.Dispatches.FirstAsync(d => d.Id == id);
        dispatch.Status = status;
        await db.SaveChangesAsync();
    }

    public static string BuildSimbriefUrl(Models.Dispatch dispatch, string airlineCode)
    {
        var code = airlineCode[..Math.Min(3, airlineCode.Length)].ToUpperInvariant();
        var fltNum = dispatch.FlightNumber.StartsWith(code) ? dispatch.FlightNumber[code.Length..] : dispatch.FlightNumber;

        var qs = $"orig={dispatch.OriginIcao}&dest={dispatch.DestIcao}&type={dispatch.IcaoType}" +
                 $"&airline={code}&fltnum={fltNum}&pax={dispatch.EcoPax + dispatch.BizPax}" +
                 $"&cargo={Math.Round(dispatch.CargoKg)}&cruisealt={dispatch.CruiseAlt}" +
                 $"&manualrmk=Dispatched+via+Thrustline";
        return $"https://www.simbrief.com/system/dispatch.php?{qs}";
    }
}
