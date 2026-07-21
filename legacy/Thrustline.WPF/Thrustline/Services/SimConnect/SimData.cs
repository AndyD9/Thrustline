namespace Thrustline.Services.SimConnect;

public record SimData
{
    public double Latitude { get; init; }
    public double Longitude { get; init; }
    public double Altitude { get; init; }          // feet
    public double GroundSpeed { get; init; }       // knots
    public double VerticalSpeed { get; init; }     // feet per minute
    public double FuelQuantity { get; init; }      // gallons
    public bool SimOnGround { get; init; }
    public double GroundTrack { get; init; }       // degrees
    public double Heading { get; init; }           // degrees
    public long Timestamp { get; init; }           // ticks
    public string AircraftIcaoType { get; init; } = string.Empty;
}

public record FlightRecord
{
    public string DepartureIcao { get; init; } = string.Empty;
    public string ArrivalIcao { get; init; } = string.Empty;
    public double DepartureLat { get; init; }
    public double DepartureLon { get; init; }
    public double ArrivalLat { get; init; }
    public double ArrivalLon { get; init; }
    public int DurationMin { get; init; }
    public double FuelUsedGal { get; init; }
    public double DistanceNm { get; init; }
    public double LandingVsFpm { get; init; }
}

public enum FlightState
{
    Idle,
    Airborne,
    Landed
}
