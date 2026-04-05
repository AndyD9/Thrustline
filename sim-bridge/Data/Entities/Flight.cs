namespace Thrustline.Bridge.Data.Entities;

public class Flight
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string UserId { get; set; } = "";
    public string CompanyId { get; set; } = "";
    public string? AircraftId { get; set; }
    public string? DispatchId { get; set; }
    public string DepartureIcao { get; set; } = "";
    public string ArrivalIcao { get; set; } = "";
    public int DurationMin { get; set; }
    public double FuelUsedGal { get; set; }
    public double DistanceNm { get; set; }
    public double LandingVsFpm { get; set; }
    public double Revenue { get; set; }
    public double FuelCost { get; set; }
    public double LandingFee { get; set; }
    public double NetResult { get; set; }
    public DateTimeOffset StartedAt { get; set; }
    public DateTimeOffset CompletedAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? SyncedAt { get; set; }
}
