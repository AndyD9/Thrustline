namespace Thrustline.Models;

public class Loan
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public double Principal { get; set; }
    public double MonthlyPayment { get; set; }
    public double RemainingAmount { get; set; }
    public int TotalMonths { get; set; }
    public int PaidMonths { get; set; }
    public double InterestRate { get; set; }
    public string CompanyId { get; set; } = string.Empty;
    public string? UserId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? SyncedAt { get; set; }

    // Navigation
    public Company Company { get; set; } = null!;
}
