namespace Thrustline.Models;

public class Reputation
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string OriginIcao { get; set; } = string.Empty;
    public string DestIcao { get; set; } = string.Empty;
    public double Score { get; set; } = 50; // 0-100, 50 = neutral
    public int FlightCount { get; set; }
    public string CompanyId { get; set; } = string.Empty;
    public string? UserId { get; set; }
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? SyncedAt { get; set; }

    // Navigation
    public Company Company { get; set; } = null!;
}
