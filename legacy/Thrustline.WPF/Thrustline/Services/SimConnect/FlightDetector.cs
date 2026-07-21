namespace Thrustline.Services.SimConnect;

/// <summary>
/// Flight state machine: idle → airborne → landed → idle (with 5s debounce).
/// Detects takeoff and landing transitions from SimConnect data.
/// </summary>
public class FlightDetector
{
    public event Action<string>? OnTakeoff; // departureIcao
    public event Action<FlightRecord>? OnLanding;

    private readonly AirportService _airports;
    private FlightState _state = FlightState.Idle;
    private bool? _prevOnGround;
    private double _prevVerticalSpeed;

    // Takeoff snapshot
    private double _fuelAtDeparture;
    private long _departureTime;
    private double _departureLat;
    private double _departureLon;

    // Debounce
    private long _landingLockUntil;

    public FlightState State => _state;

    public FlightDetector(AirportService airports)
    {
        _airports = airports;
    }

    public void Update(SimData data)
    {
        var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();

        // Skip if in debounce window
        if (now < _landingLockUntil)
        {
            _prevOnGround = data.SimOnGround;
            _prevVerticalSpeed = data.VerticalSpeed;
            return;
        }

        if (_prevOnGround.HasValue)
        {
            // Takeoff: was on ground → now airborne
            if (_prevOnGround.Value && !data.SimOnGround)
            {
                _state = FlightState.Airborne;
                _fuelAtDeparture = data.FuelQuantity;
                _departureTime = now;
                _departureLat = data.Latitude;
                _departureLon = data.Longitude;

                var depApt = _airports.FindNearest(_departureLat, _departureLon);
                OnTakeoff?.Invoke(depApt?.Icao ?? string.Empty);
            }

            // Landing: was airborne → now on ground
            if (!_prevOnGround.Value && data.SimOnGround && _state == FlightState.Airborne)
            {
                _state = FlightState.Landed;
                _landingLockUntil = now + 5000;

                var durationMin = (int)Math.Round((now - _departureTime) / 60_000.0);
                var fuelUsedGal = Math.Max(0, _fuelAtDeparture - data.FuelQuantity);
                var distanceNm = AirportService.HaversineNm(_departureLat, _departureLon, data.Latitude, data.Longitude);

                // Use previous tick's VS — current tick may already read 0
                var landingVsFpm = _prevVerticalSpeed;

                var depApt = _airports.FindNearest(_departureLat, _departureLon);
                var arrApt = _airports.FindNearest(data.Latitude, data.Longitude);

                var record = new FlightRecord
                {
                    DepartureIcao = depApt?.Icao ?? "UNKN",
                    ArrivalIcao = arrApt?.Icao ?? "UNKN",
                    DepartureLat = _departureLat,
                    DepartureLon = _departureLon,
                    ArrivalLat = data.Latitude,
                    ArrivalLon = data.Longitude,
                    DurationMin = Math.Max(1, durationMin),
                    FuelUsedGal = Math.Round(fuelUsedGal * 100) / 100,
                    DistanceNm = Math.Round(distanceNm * 10) / 10,
                    LandingVsFpm = Math.Round(landingVsFpm),
                };

                OnLanding?.Invoke(record);

                // Reset to idle after debounce
                Task.Delay(5000).ContinueWith(_ => _state = FlightState.Idle);
            }
        }

        _prevOnGround = data.SimOnGround;
        _prevVerticalSpeed = data.VerticalSpeed;
    }
}
