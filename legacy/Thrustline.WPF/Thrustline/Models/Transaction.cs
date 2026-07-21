namespace Thrustline.Models;

public class Transaction
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string Type { get; set; } = string.Empty; // lease | salary | purchase | maintenance | sale | loan_payment | flight_revenue
    public double Amount { get; set; }
    public string Description { get; set; } = string.Empty;
    public string? FlightId { get; set; }
    public string CompanyId { get; set; } = string.Empty;
    public string? UserId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? SyncedAt { get; set; }
}
