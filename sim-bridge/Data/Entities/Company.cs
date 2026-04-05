namespace Thrustline.Bridge.Data.Entities;

public class Company
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string UserId { get; set; } = "";
    public string Name { get; set; } = "";
    public string AirlineCode { get; set; } = "";
    public string HubIcao { get; set; } = "";
    public double Capital { get; set; }
    public string? ActiveAircraftId { get; set; }
    public string? SimbriefUsername { get; set; }
    public bool Onboarded { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? SyncedAt { get; set; }
}
