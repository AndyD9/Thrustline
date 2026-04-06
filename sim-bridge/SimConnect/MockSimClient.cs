using System.Diagnostics;

namespace Thrustline.Bridge.SimConnect;

/// <summary>
/// Mock SimClient : simule un vol à la demande pour le dev sans MSFS / macOS.
/// Reste idle (au sol) jusqu'à l'appel de <see cref="StartFlight"/>, puis
/// simule un vol complet en suivant les waypoints du plan de vol.
/// Émet un SimData à 1 Hz.
/// </summary>
public class MockSimClient : ISimClient
{
    private readonly ILogger<MockSimClient> _log;
    private readonly SimBridgeOptions _options;
    private readonly Stopwatch _clock = new();
    private CancellationTokenSource? _cts;
    private Task? _loop;

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
    /// </summary>
    public void StartFlight(MockFlightPlan plan)
    {
        lock (_planLock)
        {
            _plan = plan;
            _clock.Restart();
        }
        _log.LogInformation("Mock flight started: {Origin} → {Dest} ({Type}), {Wpts} waypoints, duration {Dur}s",
            plan.OriginIcao, plan.DestIcao, plan.IcaoType, plan.Waypoints.Count, plan.DurationSeconds);
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

        // Build the full route path: origin → waypoints → destination
        var route = plan.BuildRoute();

        // Phases: ground(10%) → takeoff(10%) → cruise(60%) → descent(15%) → touchdown(5%)
        var groundEnd = dur * 0.10;
        var takeoffEnd = dur * 0.20;
        var cruiseEnd = dur * 0.80;
        var descentEnd = dur * 0.95;

        bool onGround;
        double alt, gs, ias, vs, fuel;
        double lat, lon, hdg;

        var cruiseAlt = plan.CruiseAltFt;
        var startFuel = plan.FuelGal;

        if (elapsed < groundEnd)
        {
            onGround = true;
            alt = plan.OriginElevFt;
            gs = 0; ias = 0; vs = 0;
            fuel = startFuel;
            lat = plan.OriginLat; lon = plan.OriginLon;
            hdg = route.Count >= 2 ? Bearing(route[0].Lat, route[0].Lon, route[1].Lat, route[1].Lon) : 0;
        }
        else if (elapsed < takeoffEnd)
        {
            var p = (elapsed - groundEnd) / (takeoffEnd - groundEnd);
            onGround = p < 0.4;
            alt = plan.OriginElevFt + p * Math.Min(8000, cruiseAlt * 0.25);
            gs = p * 200; ias = p * 180;
            vs = 2200;
            fuel = startFuel - p * (startFuel * 0.02);
            var routeP = p * 0.01; // first 1% of route
            (lat, lon, hdg) = InterpolateRoute(route, routeP);
        }
        else if (elapsed < cruiseEnd)
        {
            var p = (elapsed - takeoffEnd) / (cruiseEnd - takeoffEnd);
            onGround = false;
            alt = cruiseAlt;
            gs = plan.CruiseSpeedKts; ias = plan.CruiseSpeedKts * 0.61;
            vs = 0;
            fuel = startFuel * 0.98 - p * (startFuel * 0.50);
            var routeP = 0.01 + 0.98 * p; // 1% to 99% of route
            (lat, lon, hdg) = InterpolateRoute(route, routeP);
        }
        else if (elapsed < descentEnd)
        {
            var p = (elapsed - cruiseEnd) / (descentEnd - cruiseEnd);
            onGround = false;
            alt = cruiseAlt * (1 - p) + plan.DestElevFt * p;
            gs = plan.CruiseSpeedKts * (1 - 0.6 * p);
            ias = gs * 0.61;
            vs = -1800;
            fuel = startFuel * 0.48 - p * (startFuel * 0.02);
            var routeP = 0.99 + 0.01 * p; // last 1% of route
            (lat, lon, hdg) = InterpolateRoute(route, routeP);
        }
        else
        {
            onGround = true;
            alt = plan.DestElevFt;
            gs = 0; ias = 0; vs = -220;
            fuel = startFuel * 0.46;
            lat = plan.DestLat; lon = plan.DestLon;
            hdg = route.Count >= 2 ? Bearing(route[^2].Lat, route[^2].Lon, route[^1].Lat, route[^1].Lon) : 0;

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

    /// <summary>
    /// Interpolate position along a route of waypoints.
    /// <paramref name="t"/> is 0..1 along the total route distance.
    /// Returns (lat, lon, heading).
    /// </summary>
    private static (double Lat, double Lon, double Hdg) InterpolateRoute(List<LatLon> route, double t)
    {
        if (route.Count < 2)
            return (route[0].Lat, route[0].Lon, 0);

        t = Math.Clamp(t, 0, 1);

        // Compute cumulative segment distances
        var segDists = new double[route.Count - 1];
        double totalDist = 0;
        for (int i = 0; i < route.Count - 1; i++)
        {
            segDists[i] = HaversineNm(route[i].Lat, route[i].Lon, route[i + 1].Lat, route[i + 1].Lon);
            totalDist += segDists[i];
        }

        if (totalDist < 0.001)
            return (route[0].Lat, route[0].Lon, 0);

        var targetDist = t * totalDist;
        double accumulated = 0;

        for (int i = 0; i < segDists.Length; i++)
        {
            if (accumulated + segDists[i] >= targetDist || i == segDists.Length - 1)
            {
                var segT = segDists[i] > 0.001 ? (targetDist - accumulated) / segDists[i] : 0;
                segT = Math.Clamp(segT, 0, 1);
                var lat = route[i].Lat + (route[i + 1].Lat - route[i].Lat) * segT;
                var lon = route[i].Lon + (route[i + 1].Lon - route[i].Lon) * segT;
                var hdg = Bearing(route[i].Lat, route[i].Lon, route[i + 1].Lat, route[i + 1].Lon);
                return (lat, lon, hdg);
            }
            accumulated += segDists[i];
        }

        return (route[^1].Lat, route[^1].Lon, 0);
    }

    /// <summary>Initial bearing from point A to point B in degrees (0-360).</summary>
    private static double Bearing(double lat1, double lon1, double lat2, double lon2)
    {
        var dLon = (lon2 - lon1) * Math.PI / 180;
        var y = Math.Sin(dLon) * Math.Cos(lat2 * Math.PI / 180);
        var x = Math.Cos(lat1 * Math.PI / 180) * Math.Sin(lat2 * Math.PI / 180)
              - Math.Sin(lat1 * Math.PI / 180) * Math.Cos(lat2 * Math.PI / 180) * Math.Cos(dLon);
        return (Math.Atan2(y, x) * 180 / Math.PI + 360) % 360;
    }

    private static double HaversineNm(double lat1, double lon1, double lat2, double lon2)
    {
        const double R = 3440.065;
        var dLat = (lat2 - lat1) * Math.PI / 180;
        var dLon = (lon2 - lon1) * Math.PI / 180;
        var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2)
              + Math.Cos(lat1 * Math.PI / 180) * Math.Cos(lat2 * Math.PI / 180)
              * Math.Sin(dLon / 2) * Math.Sin(dLon / 2);
        return 2 * R * Math.Asin(Math.Sqrt(a));
    }

    private void SetConnected(bool value)
    {
        if (IsConnected == value) return;
        IsConnected = value;
        ConnectionChanged?.Invoke(this, value);
    }
}

public record LatLon(double Lat, double Lon);

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
    public double DurationSeconds { get; set; } = 120;
    /// <summary>Waypoints from OFP navlog (lat/lon pairs). If empty, straight line origin→dest.</summary>
    public List<LatLon> Waypoints { get; set; } = new();

    /// <summary>Build the full route: origin → waypoints → destination.</summary>
    public List<LatLon> BuildRoute()
    {
        var route = new List<LatLon> { new(OriginLat, OriginLon) };
        route.AddRange(Waypoints);
        route.Add(new(DestLat, DestLon));
        return route;
    }
}
