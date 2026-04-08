namespace Thrustline.Bridge.SimConnect;

/// <summary>
/// Snapshot des SimVars lus depuis MSFS (ou le mock).
/// Miroir de l'ancien SimData TypeScript côté node-simconnect.
/// </summary>
public record SimData
{
    public DateTimeOffset Timestamp { get; init; } = DateTimeOffset.UtcNow;
    public double Latitude { get; init; }
    public double Longitude { get; init; }
    public double AltitudeFt { get; init; }
    public double GroundSpeedKts { get; init; }
    public double IndicatedAirspeedKts { get; init; }
    public double HeadingDeg { get; init; }
    public double VerticalSpeedFpm { get; init; }
    public double FuelTotalGal { get; init; }
    public bool OnGround { get; init; }
    public string? AircraftTitle { get; init; }
    public double FlapsAnglePct { get; init; }
    public double GearPosition { get; init; }     // 0 = up, 1 = down
    public bool ParkingBrake { get; init; }
    public double SpoilersPct { get; init; }
    public double GroundTrackDeg { get; init; }
}
