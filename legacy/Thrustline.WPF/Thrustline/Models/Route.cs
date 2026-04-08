namespace Thrustline.Models;

public class Route
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string OriginIcao { get; set; } = string.Empty;
    public string DestIcao { get; set; } = string.Empty;
    public double DistanceNm { get; set; }
    public double BasePrice { get; set; }
    public bool Active { get; set; } = true;
    public string CompanyId { get; set; } = string.Empty;
    public string? UserId { get; set; }
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? SyncedAt { get; set; }

    // Navigation
    public Company Company { get; set; } = null!;
}
