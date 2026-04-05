namespace Thrustline.Bridge.Data.Entities;

public enum TransactionType
{
    Revenue,
    Fuel,
    LandingFee,
    Lease,
    Maintenance,
    Salary,
    Purchase,
    Sale,
    LoanPayment
}

public class Transaction
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string UserId { get; set; } = "";
    public string CompanyId { get; set; } = "";
    public string? FlightId { get; set; }
    public TransactionType Type { get; set; }
    public double Amount { get; set; }
    public string Description { get; set; } = "";
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? SyncedAt { get; set; }
}
