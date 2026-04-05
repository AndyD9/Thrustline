namespace Thrustline.Bridge.Data.Entities;

public enum AircraftOwnership { Leased, Owned }

public class Aircraft
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string UserId { get; set; } = "";
    public string CompanyId { get; set; } = "";
    public string Name { get; set; } = "";
    public string IcaoType { get; set; } = "";
    public double HealthPct { get; set; } = 100.0;
    public double LeaseCostMo { get; set; }
    public double TotalHours { get; set; }
    public int Cycles { get; set; }
    public AircraftOwnership Ownership { get; set; } = AircraftOwnership.Leased;
    public double PurchasePrice { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? SyncedAt { get; set; }
}
