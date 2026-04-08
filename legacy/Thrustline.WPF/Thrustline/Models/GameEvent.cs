namespace Thrustline.Models;

public class GameEvent
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string Type { get; set; } = string.Empty; // fuel_spike | fuel_drop | weather | tourism_boom | strike | mechanical
    public string Scope { get; set; } = string.Empty; // global | route | aircraft
    public string? TargetId { get; set; } // route key "LFPG-KLAX" or aircraftId
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public double Modifier { get; set; } = 1.0; // multiplier or 0 = blocked
    public DateTime StartsAt { get; set; } = DateTime.UtcNow;
    public DateTime ExpiresAt { get; set; }
    public string CompanyId { get; set; } = string.Empty;
    public string? UserId { get; set; }
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? SyncedAt { get; set; }

    // Navigation
    public Company Company { get; set; } = null!;
}
