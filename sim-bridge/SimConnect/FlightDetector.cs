namespace Thrustline.Bridge.SimConnect;

/// <summary>
/// Machine à états pour détecter les événements de vol :
///   - Takeoff = passage à SimOnGround=false confirmé (debounce 5s)
///   - Landing = passage à SimOnGround=true confirmé (debounce 5s)
///
/// Port direct de l'ancien electron/simconnect/flightDetector.ts.
/// </summary>
public class FlightDetector
{
    public enum FlightPhase { OnGround, InFlight }

    private readonly TimeSpan _debounce;
    private readonly ILogger<FlightDetector> _log;

    private FlightPhase _current = FlightPhase.OnGround;
    private DateTimeOffset? _pendingSince;
    private bool? _pendingTargetOnGround;

    // Contexte du vol courant, capturé au takeoff
    public SimData? TakeoffSnapshot { get; private set; }
    public SimData? LandingSnapshot { get; private set; }
    public FlightPhase Phase => _current;

    public event EventHandler<SimData>? Takeoff;
    public event EventHandler<LandingEvent>? Landing;

    public FlightDetector(ILogger<FlightDetector> log, SimBridgeOptions options)
    {
        _log = log;
        _debounce = TimeSpan.FromSeconds(options.GroundDebounceSeconds);
    }

    public void Ingest(SimData data)
    {
        // Note: menu/loading-screen data is already filtered upstream
        // via SIM DISABLED — only active flight data reaches here.

        var desiredPhase = data.OnGround ? FlightPhase.OnGround : FlightPhase.InFlight;
        if (desiredPhase == _current)
        {
            // État stable, on reset tout pending
            _pendingSince = null;
            _pendingTargetOnGround = null;
            return;
        }

        // État différent : démarre ou continue un debounce
        if (_pendingTargetOnGround != data.OnGround)
        {
            _pendingSince = data.Timestamp;
            _pendingTargetOnGround = data.OnGround;
            return;
        }

        if (_pendingSince is null) return;

        var elapsed = data.Timestamp - _pendingSince.Value;
        if (elapsed < _debounce) return;

        // Debounce validé : transition
        if (desiredPhase == FlightPhase.InFlight)
        {
            _current = FlightPhase.InFlight;
            TakeoffSnapshot = data;
            LandingSnapshot = null;
            _log.LogInformation("✈️  Takeoff detected at {Lat},{Lon} fuel={Fuel}gal",
                data.Latitude, data.Longitude, data.FuelTotalGal);
            Takeoff?.Invoke(this, data);
        }
        else
        {
            _current = FlightPhase.OnGround;
            LandingSnapshot = data;
            var takeoff = TakeoffSnapshot;
            if (takeoff is not null)
            {
                var distanceNm = HaversineNm(takeoff.Latitude, takeoff.Longitude, data.Latitude, data.Longitude);
                var fuelUsedGal = Math.Max(0, takeoff.FuelTotalGal - data.FuelTotalGal);
                var durationMin = (int)Math.Round((data.Timestamp - takeoff.Timestamp).TotalMinutes);
                var evt = new LandingEvent(takeoff, data, distanceNm, fuelUsedGal, durationMin, data.VerticalSpeedFpm);
                _log.LogInformation("🛬 Landing: distance={Dist:F1}nm fuel={Fuel:F1}gal vs={Vs:F0}fpm",
                    distanceNm, fuelUsedGal, data.VerticalSpeedFpm);
                Landing?.Invoke(this, evt);
            }
        }

        _pendingSince = null;
        _pendingTargetOnGround = null;
    }

    private static double HaversineNm(double lat1, double lon1, double lat2, double lon2)
    {
        const double Rnm = 3440.065; // rayon terrestre en nm
        var dLat = ToRad(lat2 - lat1);
        var dLon = ToRad(lon2 - lon1);
        var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2)
              + Math.Cos(ToRad(lat1)) * Math.Cos(ToRad(lat2))
                * Math.Sin(dLon / 2) * Math.Sin(dLon / 2);
        var c = 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
        return Rnm * c;
    }

    private static double ToRad(double deg) => deg * Math.PI / 180.0;
}

public record LandingEvent(
    SimData Takeoff,
    SimData Touchdown,
    double DistanceNm,
    double FuelUsedGal,
    int DurationMin,
    double LandingVsFpm);
