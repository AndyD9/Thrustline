using System.Diagnostics;

namespace Thrustline.Bridge.SimConnect;

/// <summary>
/// Mock SimClient : simule un vol à la demande pour le dev sans MSFS / macOS.
/// Reste idle (au sol) jusqu'à l'appel de <see cref="StartFlight"/>, puis
/// simule un vol complet origin → destination avec les paramètres du dispatch.
/// Émet un SimData à 1 Hz.
/// </summary>
public class MockSimClient : ISimClient
{
    private readonly ILogger<MockSimClient> _log;
    private readonly SimBridgeOptions _options;
    private readonly Stopwatch _clock = new();
    private CancellationTokenSource? _cts;
    private Task? _loop;

    // Flight parameters — set by StartFlight()
    private MockFlightPlan? _plan;
    private readonly object _planLock = new();

    public bool IsConnected { get; private set; }
    public SimData? Latest { get; private set; }

    public event EventHandler<SimData>? DataReceived;
    public event EventHandler<bool>? ConnectionChanged;

    public MockSimClient(ILogger<MockSimClient> log, SimBridgeOptions options)
    {
        _log = log;
        _options = options;
    }

    /// <summary>
    /// Start a simulated flight with the given parameters.
    /// Called from POST /mock/start-flight endpoint.
    /// </summary>
    public void StartFlight(MockFlightPlan plan)
    {
        lock (_planLock)
        {
            _plan = plan;
            _clock.Restart();
        }
        _log.LogInformation("Mock flight started: {Origin} → {Dest} ({Type}), duration {Dur}s",
            plan.OriginIcao, plan.DestIcao, plan.IcaoType, plan.DurationSeconds);
    }

    public Task StartAsync(CancellationToken ct)
    {
        _log.LogInformation("MockSimClient starting (idle — waiting for dispatch).");
        _cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
        _clock.Restart();
        SetConnected(true);
        _loop = Task.Run(() => RunLoopAsync(_cts.Token), _cts.Token);
        return Task.CompletedTask;
    }

    public async Task StopAsync(CancellationToken ct)
    {
        _log.LogInformation("MockSimClient stopping.");
        SetConnected(false);
        _cts?.Cancel();
        if (_loop is not null)
        {
            try { await _loop; } catch (OperationCanceledException) { }
        }
    }

    public async ValueTask DisposeAsync()
    {
        await StopAsync(CancellationToken.None);
        _cts?.Dispose();
    }

    private async Task RunLoopAsync(CancellationToken ct)
    {
        var interval = TimeSpan.FromMilliseconds(_options.PollingIntervalMs);
        while (!ct.IsCancellationRequested)
        {
            var data = GenerateSnapshot();
            Latest = data;
            DataReceived?.Invoke(this, data);

            try { await Task.Delay(interval, ct); }
            catch (OperationCanceledException) { break; }
        }
    }

    private SimData GenerateSnapshot()
    {
        MockFlightPlan? plan;
        lock (_planLock) { plan = _plan; }

        // No flight active → idle on ground at origin (or 0,0 if no plan ever set)
        if (plan == null)
        {
            return new SimData
            {
                Latitude = 0, Longitude = 0,
                AltitudeFt = 0, GroundSpeedKts = 0,
                IndicatedAirspeedKts = 0, HeadingDeg = 0,
                VerticalSpeedFpm = 0, FuelTotalGal = 0,
                OnGround = true, AircraftTitle = "Mock (idle)",
            };
        }

        var elapsed = _clock.Elapsed.TotalSeconds;
        var dur = plan.DurationSeconds;

        // Phases: ground(10%) → takeoff(10%) → cruise(60%) → descent(15%) → touchdown(5%)
        var groundEnd = dur * 0.10;
        var takeoffEnd = dur * 0.20;
        var cruiseEnd = dur * 0.80;
        var descentEnd = dur * 0.95;
        // after descentEnd → on ground at destination

        bool onGround;
        double alt, gs, ias, vs, fuel;
        double lat, lon, hdg;

        var cruiseAlt = plan.CruiseAltFt;
        var startFuel = plan.FuelGal;
        hdg = plan.Heading;

        if (elapsed < groundEnd)
        {
            // On ground at origin
            onGround = true;
            alt = plan.OriginElevFt;
            gs = 0; ias = 0; vs = 0;
            fuel = startFuel;
            lat = plan.OriginLat; lon = plan.OriginLon;
        }
        else if (elapsed < takeoffEnd)
        {
            // Takeoff phase
            var p = (elapsed - groundEnd) / (takeoffEnd - groundEnd);
            onGround = p < 0.4;
            alt = plan.OriginElevFt + p * Math.Min(8000, cruiseAlt * 0.25);
            gs = p * 200; ias = p * 180;
            vs = 2200;
            fuel = startFuel - p * (startFuel * 0.02); // burn 2% during takeoff
            lat = Lerp(plan.OriginLat, plan.DestLat, 0.01 * p);
            lon = Lerp(plan.OriginLon, plan.DestLon, 0.01 * p);
        }
        else if (elapsed < cruiseEnd)
        {
            // Cruise
            var p = (elapsed - takeoffEnd) / (cruiseEnd - takeoffEnd);
            onGround = false;
            alt = cruiseAlt;
            gs = plan.CruiseSpeedKts; ias = plan.CruiseSpeedKts * 0.61; // rough IAS at FL350
            vs = 0;
            fuel = startFuel * 0.98 - p * (startFuel * 0.50); // burn 50% during cruise
            lat = Lerp(plan.OriginLat, plan.DestLat, 0.01 + 0.98 * p);
            lon = Lerp(plan.OriginLon, plan.DestLon, 0.01 + 0.98 * p);
        }
        else if (elapsed < descentEnd)
        {
            // Descent
            var p = (elapsed - cruiseEnd) / (descentEnd - cruiseEnd);
            onGround = false;
            alt = cruiseAlt * (1 - p) + plan.DestElevFt * p;
            gs = plan.CruiseSpeedKts * (1 - 0.6 * p);
            ias = gs * 0.61;
            vs = -1800;
            fuel = startFuel * 0.48 - p * (startFuel * 0.02);
            lat = Lerp(plan.OriginLat, plan.DestLat, 0.99 + 0.01 * p);
            lon = Lerp(plan.OriginLon, plan.DestLon, 0.99 + 0.01 * p);
        }
        else
        {
            // Touchdown at destination — stay here until next StartFlight
            onGround = true;
            alt = plan.DestElevFt;
            gs = 0; ias = 0; vs = -220;
            fuel = startFuel * 0.46;
            lat = plan.DestLat; lon = plan.DestLon;

            // Clear plan after a few seconds on ground so we go back to idle
            if (elapsed > descentEnd + 10)
            {
                lock (_planLock) { _plan = null; }
            }
        }

        return new SimData
        {
            Latitude = lat,
            Longitude = lon,
            AltitudeFt = alt,
            GroundSpeedKts = gs,
            IndicatedAirspeedKts = ias,
            HeadingDeg = hdg,
            VerticalSpeedFpm = vs,
            FuelTotalGal = fuel,
            OnGround = onGround,
            AircraftTitle = $"Mock {plan.IcaoType}",
        };
    }

    private static double Lerp(double a, double b, double t) => a + (b - a) * t;

    private void SetConnected(bool value)
    {
        if (IsConnected == value) return;
        IsConnected = value;
        ConnectionChanged?.Invoke(this, value);
    }
}

/// <summary>
/// Parameters for a mock flight, populated from dispatch data.
/// </summary>
public class MockFlightPlan
{
    public string OriginIcao { get; set; } = "";
    public string DestIcao { get; set; } = "";
    public string IcaoType { get; set; } = "";
    public double OriginLat { get; set; }
    public double OriginLon { get; set; }
    public double OriginElevFt { get; set; }
    public double DestLat { get; set; }
    public double DestLon { get; set; }
    public double DestElevFt { get; set; }
    public double CruiseAltFt { get; set; } = 35000;
    public double CruiseSpeedKts { get; set; } = 460;
    public double FuelGal { get; set; } = 5000;
    public double Heading { get; set; } = 270;
    /// <summary>Total simulated flight duration in seconds (default 120s for dev).</summary>
    public double DurationSeconds { get; set; } = 120;
}
