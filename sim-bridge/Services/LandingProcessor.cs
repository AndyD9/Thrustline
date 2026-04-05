using Supabase.Postgrest;
using Thrustline.Bridge.Cloud;
using Thrustline.Bridge.Cloud.Models;
using Thrustline.Bridge.Session;
using Thrustline.Bridge.SimConnect;

namespace Thrustline.Bridge.Services;

/// <summary>
/// Orchestre tout le traitement d'un atterrissage :
///   1. Vérifie qu'il y a une session utilisateur + Supabase configuré
///   2. Charge la compagnie active de l'utilisateur
///   3. Cherche un dispatch "flying" pour lier le vol (sans dispatch → skip, v1)
///   4. Charge l'avion (depuis dispatch ou active_aircraft_id)
///   5. Charge la réputation existante sur la route (ou 50 par défaut)
///   6. Calcule revenue (YieldService), fuel/landing/net (CashflowService)
///   7. Applique l'usure (MaintenanceService)
///   8. Écrit dans Supabase :
///        - insert flights
///        - insert 3 transactions (revenue, fuel, landing_fee)
///        - update companies.capital
///        - update aircraft (health_pct, cycles, total_hours)
///        - upsert reputations (score ajusté selon |vs|, flight_count++)
///        - update dispatch.status = 'completed'
/// </summary>
public class LandingProcessor
{
    private readonly ISupabaseClientProvider _supabase;
    private readonly ISessionStore _session;
    private readonly YieldService _yield;
    private readonly CashflowService _cashflow;
    private readonly MaintenanceService _maintenance;
    private readonly ILogger<LandingProcessor> _log;

    public LandingProcessor(
        ISupabaseClientProvider supabase,
        ISessionStore session,
        YieldService yield,
        CashflowService cashflow,
        MaintenanceService maintenance,
        ILogger<LandingProcessor> log)
    {
        _supabase = supabase;
        _session = session;
        _yield = yield;
        _cashflow = cashflow;
        _maintenance = maintenance;
        _log = log;
    }

    public async Task ProcessAsync(LandingEvent evt, CancellationToken ct = default)
    {
        if (!_supabase.IsConfigured)
        {
            _log.LogWarning("Landing detected but Supabase not configured — skipping persistence.");
            return;
        }

        var userId = _session.CurrentUserId;
        if (userId is null)
        {
            _log.LogWarning("Landing detected but no session user set — skipping persistence.");
            return;
        }

        try
        {
            await _supabase.EnsureInitializedAsync(ct);
            var client = _supabase.Client;

            // 1. Compagnie active
            var company = (await client.From<CompanyRow>()
                .Where(c => c.UserId == userId.Value)
                .Single(ct))
                ?? throw new InvalidOperationException($"No company for user {userId}");

            // 2. Dispatch flying (optionnel mais fortement conseillé en v1)
            var dispatchResp = await client.From<DispatchRow>()
                .Where(d => d.CompanyId == company.Id)
                .Where(d => d.Status == DispatchRow.StatusFlying)
                .Limit(1)
                .Get(ct);
            var dispatch = dispatchResp.Models.FirstOrDefault();

            if (dispatch is null)
            {
                _log.LogWarning("Landing ignored: no flying dispatch for company {Company}. " +
                                "Create a dispatch and set it to 'flying' before landing.", company.Name);
                return;
            }

            // 3. Avion : depuis dispatch.aircraft_id ou company.active_aircraft_id
            var aircraftId = dispatch.AircraftId ?? company.ActiveAircraftId;
            AircraftRow? aircraft = null;
            if (aircraftId is not null)
            {
                aircraft = await client.From<AircraftRow>()
                    .Where(a => a.Id == aircraftId.Value)
                    .Single(ct);
            }

            // 4. Réputation sur la route
            var repResp = await client.From<ReputationRow>()
                .Where(r => r.CompanyId == company.Id)
                .Where(r => r.OriginIcao == dispatch.OriginIcao)
                .Where(r => r.DestIcao == dispatch.DestIcao)
                .Limit(1)
                .Get(ct);
            var reputation = repResp.Models.FirstOrDefault();
            var repScore = reputation?.Score ?? 50m;

            // 5. Calculs
            var distanceNm = (decimal)evt.DistanceNm;
            var fuelUsedGal = (decimal)evt.FuelUsedGal;
            var landingVsFpm = (decimal)evt.LandingVsFpm;

            var revenue = _yield.Compute(dispatch.PaxEco, dispatch.PaxBiz, distanceNm, repScore);
            var fin = _cashflow.Compute(revenue, fuelUsedGal);

            MaintenanceUpdate? maint = null;
            if (aircraft is not null)
            {
                maint = _maintenance.Apply(
                    aircraft.HealthPct,
                    aircraft.Cycles,
                    aircraft.TotalHours,
                    evt.DurationMin,
                    landingVsFpm);
            }

            // 6. Insert flight
            var flight = new FlightRow
            {
                UserId = userId.Value,
                CompanyId = company.Id,
                AircraftId = aircraft?.Id,
                DispatchId = dispatch.Id,
                DepartureIcao = dispatch.OriginIcao,
                ArrivalIcao = dispatch.DestIcao,
                DurationMin = evt.DurationMin,
                FuelUsedGal = fuelUsedGal,
                DistanceNm = distanceNm,
                LandingVsFpm = landingVsFpm,
                Revenue = fin.Revenue,
                FuelCost = fin.FuelCost,
                LandingFee = fin.LandingFee,
                NetResult = fin.NetResult,
                StartedAt = evt.Takeoff.Timestamp.UtcDateTime,
                CompletedAt = evt.Touchdown.Timestamp.UtcDateTime,
            };
            var insertedFlight = (await client.From<FlightRow>().Insert(flight, cancellationToken: ct))
                .Models.First();

            // 7. Transactions (revenue, fuel, landing_fee)
            var transactions = new List<TransactionRow>
            {
                new()
                {
                    UserId = userId.Value,
                    CompanyId = company.Id,
                    FlightId = insertedFlight.Id,
                    Type = TransactionRow.TypeRevenue,
                    Amount = fin.Revenue,
                    Description = $"Ticket sales {dispatch.OriginIcao}→{dispatch.DestIcao} ({dispatch.FlightNumber})"
                },
                new()
                {
                    UserId = userId.Value,
                    CompanyId = company.Id,
                    FlightId = insertedFlight.Id,
                    Type = TransactionRow.TypeFuel,
                    Amount = -fin.FuelCost,
                    Description = $"Fuel {fuelUsedGal:F0} gal — {dispatch.FlightNumber}"
                },
                new()
                {
                    UserId = userId.Value,
                    CompanyId = company.Id,
                    FlightId = insertedFlight.Id,
                    Type = TransactionRow.TypeLandingFee,
                    Amount = -fin.LandingFee,
                    Description = $"Landing fee {dispatch.DestIcao}"
                }
            };
            await client.From<TransactionRow>().Insert(transactions, cancellationToken: ct);

            // 8. Update capital compagnie
            await client.From<CompanyRow>()
                .Where(c => c.Id == company.Id)
                .Set(c => c.Capital!, company.Capital + fin.NetResult)
                .Update(cancellationToken: ct);

            // 9. Update aircraft (health/cycles/hours)
            if (aircraft is not null && maint is not null)
            {
                await client.From<AircraftRow>()
                    .Where(a => a.Id == aircraft.Id)
                    .Set(a => a.HealthPct, maint.HealthPct)
                    .Set(a => a.Cycles, maint.Cycles)
                    .Set(a => a.TotalHours, maint.TotalHours)
                    .Update(cancellationToken: ct);
            }

            // 10. Upsert reputation
            var repAdjustment = ComputeReputationAdjustment(landingVsFpm);
            if (reputation is null)
            {
                await client.From<ReputationRow>().Insert(new ReputationRow
                {
                    UserId = userId.Value,
                    CompanyId = company.Id,
                    OriginIcao = dispatch.OriginIcao,
                    DestIcao = dispatch.DestIcao,
                    Score = Math.Clamp(50m + repAdjustment, 0m, 100m),
                    FlightCount = 1
                }, cancellationToken: ct);
            }
            else
            {
                var newScore = Math.Clamp(reputation.Score + repAdjustment, 0m, 100m);
                await client.From<ReputationRow>()
                    .Where(r => r.Id == reputation.Id)
                    .Set(r => r.Score, newScore)
                    .Set(r => r.FlightCount, reputation.FlightCount + 1)
                    .Update(cancellationToken: ct);
            }

            // 11. Dispatch → completed
            await client.From<DispatchRow>()
                .Where(d => d.Id == dispatch.Id)
                .Set(d => d.Status, DispatchRow.StatusCompleted)
                .Update(cancellationToken: ct);

            _log.LogInformation(
                "✅ Landing persisted: flight {Flight} {From}→{To} revenue={Rev:C} fuel={Fuel:C} landingFee={Fee:C} net={Net:C}",
                insertedFlight.Id, dispatch.OriginIcao, dispatch.DestIcao,
                fin.Revenue, fin.FuelCost, fin.LandingFee, fin.NetResult);
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "Failed to persist landing to Supabase.");
        }
    }

    /// <summary>
    /// Ajuste la réputation selon la qualité de l'atterrissage (vs en fpm).
    /// Soft landing = bonus, hard landing = malus.
    /// </summary>
    private static decimal ComputeReputationAdjustment(decimal landingVsFpm)
    {
        var absVs = Math.Abs(landingVsFpm);
        return absVs switch
        {
            < 150m  =>  1.0m,   // greaser
            < 300m  =>  0.5m,   // nice touchdown
            < 600m  =>  0.0m,   // acceptable
            < 1000m => -1.0m,   // hard
            _       => -3.0m,   // very hard, pax not happy
        };
    }
}
