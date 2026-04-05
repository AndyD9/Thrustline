namespace Thrustline.Bridge.Data.Entities;

public enum DispatchStatus { Pending, Dispatched, Flying, Completed, Cancelled }

public class Dispatch
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string UserId { get; set; } = "";
    public string CompanyId { get; set; } = "";
    public string? AircraftId { get; set; }
    public string FlightNumber { get; set; } = "";
    public string OriginIcao { get; set; } = "";
    public string DestIcao { get; set; } = "";
    public string IcaoType { get; set; } = "";
    public int PaxEco { get; set; }
    public int PaxBiz { get; set; }
    public double CargoKg { get; set; }
    public double EstimFuelLbs { get; set; }
    public int CruiseAlt { get; set; }
    public DispatchStatus Status { get; set; } = DispatchStatus.Pending;
    public string? OfpData { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? SyncedAt { get; set; }
}
