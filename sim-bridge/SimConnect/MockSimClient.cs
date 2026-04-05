using System.Diagnostics;

namespace Thrustline.Bridge.SimConnect;

/// <summary>
/// Mock SimClient : simule un vol CDG → JFK pour permettre le dev sans MSFS
/// ou sur macOS/Linux. Émet un SimData à 1 Hz.
///
/// Phases du vol simulé :
///  0..10s    : au sol CDG, fuel 5000gal
///  10..20s   : taxi + décollage (vs positive, onGround = false)
///  20..80s   : croisière FL350
///  80..95s   : descente
///  95..100s  : atterrissage JFK (onGround = true)
///  puis cycle recommence.
/// </summary>
public class MockSimClient : ISimClient
{
    private readonly ILogger<MockSimClient> _log;
    private readonly SimBridgeOptions _options;
    private readonly Stopwatch _clock = new();
    private CancellationTokenSource? _cts;
    private Task? _loop;

    // CDG → JFK approximatif
    private const double CdgLat = 49.0097, CdgLon = 2.5479;
    private const double JfkLat = 40.6413, JfkLon = -73.7781;

    public bool IsConnected { get; private set; }
    public SimData? Latest { get; private set; }

    public event EventHandler<SimData>? DataReceived;
    public event EventHandler<bool>? ConnectionChanged;

    public MockSimClient(ILogger<MockSimClient> log, SimBridgeOptions options)
    {
        _log = log;
        _options = options;
    }

    public Task StartAsync(CancellationToken ct)
    {
        _log.LogInformation("MockSimClient starting (mock flight CDG → JFK loop).");
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

    /// <summary>
    /// Génère un snapshot en fonction du temps écoulé (modulo 100s).
    /// </summary>
    private SimData GenerateSnapshot()
    {
        var t = _clock.Elapsed.TotalSeconds % 100.0;

        bool onGround;
        double alt, gs, ias, vs, fuel;
        double lat, lon;

        if (t < 10)
        {
            // au sol CDG
            onGround = true;
            alt = 392; // elev CDG
            gs = 0; ias = 0; vs = 0;
            fuel = 5000;
            lat = CdgLat; lon = CdgLon;
        }
        else if (t < 20)
        {
            // décollage
            var p = (t - 10) / 10.0;
            onGround = p < 0.4;
            alt = 392 + p * 8000;
            gs = p * 200;
            ias = p * 180;
            vs = 2200;
            fuel = 5000 - p * 100;
            lat = CdgLat + (JfkLat - CdgLat) * 0.01 * p;
            lon = CdgLon + (JfkLon - CdgLon) * 0.01 * p;
        }
        else if (t < 80)
        {
            // croisière
            var p = (t - 20) / 60.0;
            onGround = false;
            alt = 35000;
            gs = 460; ias = 280; vs = 0;
            fuel = 4900 - p * 2500;
            lat = CdgLat + (JfkLat - CdgLat) * (0.01 + 0.98 * p);
            lon = CdgLon + (JfkLon - CdgLon) * (0.01 + 0.98 * p);
        }
        else if (t < 95)
        {
            // descente
            var p = (t - 80) / 15.0;
            onGround = false;
            alt = 35000 - p * 34000;
            gs = 460 - p * 310;
            ias = 280 - p * 150;
            vs = -1800;
            fuel = 2400 - p * 100;
            lat = JfkLat - (JfkLat - CdgLat) * 0.01 * (1 - p);
            lon = JfkLon - (JfkLon - CdgLon) * 0.01 * (1 - p);
        }
        else
        {
            // touchdown JFK
            onGround = true;
            alt = 13; // elev JFK
            gs = 0; ias = 0; vs = -220;
            fuel = 2300;
            lat = JfkLat; lon = JfkLon;
        }

        return new SimData
        {
            Latitude = lat,
            Longitude = lon,
            AltitudeFt = alt,
            GroundSpeedKts = gs,
            IndicatedAirspeedKts = ias,
            HeadingDeg = 270,
            VerticalSpeedFpm = vs,
            FuelTotalGal = fuel,
            OnGround = onGround,
            AircraftTitle = "Mock A320neo",
        };
    }

    private void SetConnected(bool value)
    {
        if (IsConnected == value) return;
        IsConnected = value;
        ConnectionChanged?.Invoke(this, value);
    }
}
