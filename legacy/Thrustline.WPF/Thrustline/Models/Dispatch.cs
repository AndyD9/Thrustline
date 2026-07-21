namespace Thrustline.Models;

public class Dispatch
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string FlightNumber { get; set; } = string.Empty;
    public string OriginIcao { get; set; } = string.Empty;
    public string DestIcao { get; set; } = string.Empty;
    public string IcaoType { get; set; } = string.Empty;
    public double DistanceNm { get; set; }
    public int EcoPax { get; set; }
    public int BizPax { get; set; }
    public double CargoKg { get; set; }
    public double EstimFuelLbs { get; set; }
    public int CruiseAlt { get; set; }
    public string Status { get; set; } = "pending"; // pending | dispatched | flying | completed
    public string? OfpData { get; set; } // raw JSON from SimBrief
    public string? FlightId { get; set; } // linked after landing
    public string? AircraftId { get; set; }
    public string CompanyId { get; set; } = string.Empty;
    public string? UserId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? SyncedAt { get; set; }

    // Navigation
    public Company Company { get; set; } = null!;
}
