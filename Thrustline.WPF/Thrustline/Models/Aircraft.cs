namespace Thrustline.Models;

public class Aircraft
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string Name { get; set; } = string.Empty;
    public string IcaoType { get; set; } = string.Empty;
    public double HealthPct { get; set; } = 100;
    public double LeaseCostMo { get; set; }
    public double TotalHours { get; set; }
    public int Cycles { get; set; }
    public string Ownership { get; set; } = "leased"; // "leased" | "owned"
    public double? PurchasePrice { get; set; }
    public DateTime? PurchasedAt { get; set; }
    public string CompanyId { get; set; } = string.Empty;
    public string? UserId { get; set; }
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? SyncedAt { get; set; }

    // Navigation
    public Company Company { get; set; } = null!;
    public ICollection<Flight> Flights { get; set; } = new List<Flight>();
    public ICollection<CrewMember> Crew { get; set; } = new List<CrewMember>();
}
