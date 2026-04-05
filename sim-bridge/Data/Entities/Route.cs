namespace Thrustline.Bridge.Data.Entities;

public class Route
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string UserId { get; set; } = "";
    public string CompanyId { get; set; } = "";
    public string OriginIcao { get; set; } = "";
    public string DestIcao { get; set; } = "";
    public double DistanceNm { get; set; }
    public double BasePrice { get; set; }
    public bool Active { get; set; } = true;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? SyncedAt { get; set; }
}
