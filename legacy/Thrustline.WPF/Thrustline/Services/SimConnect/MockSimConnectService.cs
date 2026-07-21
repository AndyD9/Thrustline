using System.Windows.Threading;

namespace Thrustline.Services.SimConnect;

/// <summary>
/// Mock SimConnect that simulates a CDG → JFK flight in a 60-second cycle.
/// Used for development/testing when MSFS is not available.
/// </summary>
public class MockSimConnectService : ISimConnectService, IDisposable
{
    public event Action<SimData>? SimDataReceived;
    public string Status { get; private set; } = "disconnected";

    private DispatcherTimer? _timer;
    private long _startTime;
    private double _fuel = 18000;

    // CDG → JFK
    private const double DepLat = 49.0097, DepLon = 2.5479;
    private const double ArrLat = 40.6413, ArrLon = -73.7781;
    private const long CycleDuration = 60_000;

    public void Start()
    {
        _startTime = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        _fuel = 18000;

        _timer = new DispatcherTimer { Interval = TimeSpan.FromSeconds(1) };
        _timer.Tick += OnTick;
        _timer.Start();
        Status = "mock";
    }

    private void OnTick(object? sender, EventArgs e)
    {
        var elapsed = (DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() - _startTime) % CycleDuration;
        var progress = (double)elapsed / CycleDuration;

        double altitude, groundSpeed, verticalSpeed, lat, lon;
        bool onGround;

        if (progress < 0.1)
        {
            // Taxi
            onGround = true; altitude = 392; groundSpeed = progress * 1500; verticalSpeed = 0;
            lat = DepLat; lon = DepLon;
        }
        else if (progress < 0.3)
        {
            // Climb
            var p = (progress - 0.1) / 0.2;
            onGround = false; altitude = 392 + p * 34608; groundSpeed = 280 + p * 170; verticalSpeed = 2000;
            lat = DepLat + (ArrLat - DepLat) * p * 0.3;
            lon = DepLon + (ArrLon - DepLon) * p * 0.3;
        }
        else if (progress < 0.7)
        {
            // Cruise
            var p = (progress - 0.3) / 0.4;
            onGround = false; altitude = 35000; groundSpeed = 450; verticalSpeed = 0;
            lat = DepLat + (ArrLat - DepLat) * (0.3 + p * 0.4);
            lon = DepLon + (ArrLon - DepLon) * (0.3 + p * 0.4);
        }
        else if (progress < 0.9)
        {
            // Descent
            var p = (progress - 0.7) / 0.2;
            onGround = false; altitude = 35000 - p * 34987; groundSpeed = 450 - p * 300; verticalSpeed = -1800;
            lat = DepLat + (ArrLat - DepLat) * (0.7 + p * 0.3);
            lon = DepLon + (ArrLon - DepLon) * (0.7 + p * 0.3);
        }
        else
        {
            // Landing roll
            onGround = true; altitude = 13;
            groundSpeed = Math.Max(0, (1 - (progress - 0.9) / 0.1) * 150);
            verticalSpeed = 0;
            lat = ArrLat; lon = ArrLon;
        }

        _fuel = Math.Max(0, _fuel - 3);

        var dx = ArrLon - lon;
        var dy = ArrLat - lat;
        var hdg = ((Math.Atan2(dx, dy) * 180) / Math.PI + 360) % 360;

        var rng = Random.Shared;
        SimDataReceived?.Invoke(new SimData
        {
            Latitude = lat + (rng.NextDouble() - 0.5) * 0.0001,
            Longitude = lon + (rng.NextDouble() - 0.5) * 0.0001,
            Altitude = altitude,
            GroundSpeed = groundSpeed,
            VerticalSpeed = verticalSpeed,
            FuelQuantity = _fuel,
            SimOnGround = onGround,
            GroundTrack = hdg,
            Heading = hdg,
            Timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
            AircraftIcaoType = "B738",
        });
    }

    public void Stop()
    {
        _timer?.Stop();
        _timer = null;
        Status = "disconnected";
    }

    public void Dispose()
    {
        Stop();
        GC.SuppressFinalize(this);
    }
}
