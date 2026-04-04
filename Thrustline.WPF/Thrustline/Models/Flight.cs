namespace Thrustline.Models;

public class Flight
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string DepartureIcao { get; set; } = string.Empty;
    public string ArrivalIcao { get; set; } = string.Empty;
    public int DurationMin { get; set; }
    public double FuelUsedGal { get; set; }
    public double DistanceNm { get; set; }
    public double LandingVsFpm { get; set; }
    public double Revenue { get; set; }
    public double FuelCost { get; set; }
    public double LandingFee { get; set; }
    public double NetResult { get; set; }
    public string CompanyId { get; set; } = string.Empty;
    public string? AircraftId { get; set; }
    public string? UserId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? SyncedAt { get; set; }

    // Navigation
    public Company Company { get; set; } = null!;
    public Aircraft? Aircraft { get; set; }
}
