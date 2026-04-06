using System.Collections.Concurrent;
using Microsoft.AspNetCore.SignalR;
using Thrustline.Bridge.Cloud;
using Thrustline.Bridge.Cloud.Models;
using Thrustline.Bridge.Session;
using Thrustline.Bridge.SimConnect;

namespace Thrustline.Bridge.Services;

/// <summary>
/// Singleton service qui :
///   1. Detecte les phases de vol (preflight → taxi_out → takeoff → climb → cruise → descent → approach → landing → taxi_in)
///   2. Accumule des position reports en memoire
///   3. Flush vers Supabase toutes les 30 secondes
///   4. Broadcast phase changes et ACARS updates via SignalR
/// </summary>
public class AcarsService : IDisposable
{
    public const string PhasePreflight = "preflight";
    public const string PhaseTaxiOut   = "taxi_out";
    public const string PhaseTakeoff   = "takeoff";
    public const string PhaseClimb     = "climb";
    public const string PhaseCruise    = "cruise";
    public const string PhaseDescent   = "descent";
    public const string PhaseApproach  = "approach";
    public const string PhaseLanding   = "landing";
    public const string PhaseTaxiIn    = "taxi_in";

    private readonly IHubContext<SimHub> _hub;
    private readonly ISupabaseClientProvider _supabase;
    private readonly ISessionStore _session;
    private readonly ILogger<AcarsService> _log;

    // Current state
    private string _currentPhase = PhasePreflight;
    private bool _wasAirborne;
    private Guid? _activeDispatchId;
    private Guid? _activeCompanyId;
    private DateTimeOffset _lastReportTime = DateTimeOffset.MinValue;
    private readonly TimeSpan _reportInterval = TimeSpan.FromSeconds(30);

    // Buffer for batch writes
    private readonly ConcurrentQueue<AcarsReportRow> _buffer = new();
    private readonly Timer _flushTimer;

    // Cap in-memory to avoid OOM on very long flights
    private const int MaxBufferSize = 500;

    public string CurrentPhase => _currentPhase;

    public AcarsService(
        IHubContext<SimHub> hub,
        ISupabaseClientProvider supabase,
        ISessionStore session,
        ILogger<AcarsService> log)
    {
        _hub = hub;
        _supabase = supabase;
        _session = session;
        _log = log;

        // Flush buffer every 30 seconds
        _flushTimer = new Timer(FlushCallback, null, TimeSpan.FromSeconds(30), TimeSpan.FromSeconds(30));
    }

    /// <summary>
    /// Appele par SimConnectWorker quand un dispatch passe en flying (takeoff).
    /// Reset l'etat pour un nouveau vol.
    /// </summary>
    public void StartFlight(Guid dispatchId, Guid companyId)
    {
        _activeDispatchId = dispatchId;
        _activeCompanyId = companyId;
        _currentPhase = PhaseTakeoff;
        _wasAirborne = false;
        _lastReportTime = DateTimeOffset.MinValue;
        _log.LogInformation("ACARS: Flight started for dispatch {Dispatch}", dispatchId);
    }

    /// <summary>
    /// Appele par SimConnectWorker quand le vol se termine.
    /// </summary>
    public void EndFlight()
    {
        _activeDispatchId = null;
        _activeCompanyId = null;
        _currentPhase = PhasePreflight;
        _wasAirborne = false;
    }

    /// <summary>
    /// Ingere un SimData tick pour detecter la phase et emettre des reports.
    /// Appele a chaque tick (~1Hz) depuis SimConnectWorker.OnData.
    /// </summary>
    public void Ingest(SimData data)
    {
        if (_activeDispatchId is null) return;

        var newPhase = DetectPhase(data);
        if (newPhase != _currentPhase)
        {
            var oldPhase = _currentPhase;
            _currentPhase = newPhase;
            _log.LogInformation("ACARS: Phase {Old} → {New}", oldPhase, newPhase);
            _ = _hub.Clients.All.SendAsync("phaseChange", newPhase);

            // Force a report on phase change
            EnqueueReport(data, $"Phase: {newPhase}");
            _lastReportTime = data.Timestamp;
            return;
        }

        // Periodic report every 30s
        if (data.Timestamp - _lastReportTime >= _reportInterval)
        {
            EnqueueReport(data, "");
            _lastReportTime = data.Timestamp;
        }
    }

    /// <summary>
    /// Apres qu'un flight est insere en DB, lie tous les ACARS reports du dispatch a ce flight_id.
    /// </summary>
    public async Task LinkReportsToFlight(Guid dispatchId, Guid flightId, CancellationToken ct)
    {
        if (!_supabase.IsConfigured) return;

        try
        {
            // Flush any remaining buffered reports first
            await FlushBufferAsync();

            await _supabase.EnsureInitializedAsync(ct);
            await _supabase.Client.From<AcarsReportRow>()
                .Where(r => r.DispatchId == dispatchId)
                .Set(r => r.FlightId, flightId)
                .Update(cancellationToken: ct);

            _log.LogInformation("ACARS: Linked reports for dispatch {Dispatch} to flight {Flight}",
                dispatchId, flightId);
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "ACARS: Failed to link reports to flight {Flight}", flightId);
        }
    }

    private string DetectPhase(SimData data)
    {
        if (!data.OnGround && !_wasAirborne)
            _wasAirborne = true;

        if (data.OnGround)
        {
            if (_wasAirborne)
            {
                // Was flying, now on ground
                if (data.GroundSpeedKts >= 5)
                    return PhaseTaxiIn;
                return PhaseLanding;
            }
            else
            {
                // Never left ground yet
                if (data.GroundSpeedKts >= 5)
                    return PhaseTaxiOut;
                return PhasePreflight;
            }
        }

        // Airborne
        var vs = data.VerticalSpeedFpm;
        var alt = data.AltitudeFt;

        if (alt < 5000 && vs < -300)
            return PhaseApproach;

        if (vs < -300)
            return PhaseDescent;

        if (vs > 500 && alt < 10000)
            return PhaseTakeoff;

        if (vs > 300)
            return PhaseClimb;

        // Stable flight (|VS| < 300)
        return PhaseCruise;
    }

    private void EnqueueReport(SimData data, string message)
    {
        var userId = _session.CurrentUserId;
        if (userId is null || _activeDispatchId is null || _activeCompanyId is null) return;

        // Cap buffer to prevent OOM
        while (_buffer.Count >= MaxBufferSize)
            _buffer.TryDequeue(out _);

        var report = new AcarsReportRow
        {
            UserId = userId.Value,
            CompanyId = _activeCompanyId.Value,
            DispatchId = _activeDispatchId.Value,
            Phase = _currentPhase,
            Latitude = data.Latitude,
            Longitude = data.Longitude,
            AltitudeFt = data.AltitudeFt,
            GroundSpeedKts = data.GroundSpeedKts,
            HeadingDeg = data.HeadingDeg,
            VsFpm = data.VerticalSpeedFpm,
            FuelGal = data.FuelTotalGal,
            Message = message,
        };

        _buffer.Enqueue(report);

        // Broadcast to UI
        _ = _hub.Clients.All.SendAsync("acarsUpdate", new
        {
            phase = report.Phase,
            latitude = report.Latitude,
            longitude = report.Longitude,
            altitudeFt = report.AltitudeFt,
            groundSpeedKts = report.GroundSpeedKts,
            headingDeg = report.HeadingDeg,
            fuelGal = report.FuelGal,
            message = report.Message,
            timestamp = data.Timestamp.ToString("O"),
        });
    }

    private void FlushCallback(object? state)
    {
        _ = FlushBufferAsync();
    }

    private async Task FlushBufferAsync()
    {
        if (_buffer.IsEmpty || !_supabase.IsConfigured) return;

        var batch = new List<AcarsReportRow>();
        while (_buffer.TryDequeue(out var report))
            batch.Add(report);

        if (batch.Count == 0) return;

        try
        {
            await _supabase.EnsureInitializedAsync(CancellationToken.None);
            await _supabase.Client.From<AcarsReportRow>()
                .Insert(batch, cancellationToken: CancellationToken.None);
            _log.LogDebug("ACARS: Flushed {Count} reports to Supabase", batch.Count);
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "ACARS: Failed to flush {Count} reports", batch.Count);
            // Re-enqueue failed reports (best-effort)
            foreach (var r in batch)
                _buffer.Enqueue(r);
        }
    }

    public void Dispose()
    {
        _flushTimer.Dispose();
        // Final flush attempt
        _ = FlushBufferAsync();
    }
}
