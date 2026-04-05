namespace Thrustline.Bridge.Data.Entities;

public class Reputation
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string UserId { get; set; } = "";
    public string CompanyId { get; set; } = "";
    public string OriginIcao { get; set; } = "";
    public string DestIcao { get; set; } = "";
    public double Score { get; set; } = 50.0; // 0..100, 50 = neutre
    public int FlightCount { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? SyncedAt { get; set; }
}
