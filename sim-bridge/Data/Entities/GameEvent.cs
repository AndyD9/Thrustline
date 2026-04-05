namespace Thrustline.Bridge.Data.Entities;

public enum GameEventType
{
    FuelSpike,
    FuelDrop,
    Weather,
    TourismBoom,
    Strike,
    Mechanical
}

public enum GameEventScope { Global, Route, Aircraft }

public class GameEvent
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string UserId { get; set; } = "";
    public string CompanyId { get; set; } = "";
    public GameEventType Type { get; set; }
    public GameEventScope Scope { get; set; } = GameEventScope.Global;
    public string? TargetId { get; set; }
    public string Title { get; set; } = "";
    public string Description { get; set; } = "";
    public double Modifier { get; set; } = 1.0;
    public DateTimeOffset StartsAt { get; set; }
    public DateTimeOffset ExpiresAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? SyncedAt { get; set; }
}
