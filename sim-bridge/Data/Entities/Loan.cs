namespace Thrustline.Bridge.Data.Entities;

public class Loan
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string UserId { get; set; } = "";
    public string CompanyId { get; set; } = "";
    public double Principal { get; set; }
    public double MonthlyPayment { get; set; }
    public double RemainingAmount { get; set; }
    public int TotalMonths { get; set; }
    public int PaidMonths { get; set; }
    public double InterestRate { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? SyncedAt { get; set; }
}
