namespace Thrustline.Models;

public class CrewMember
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string Rank { get; set; } = "first_officer"; // captain | first_officer
    public int Experience { get; set; } = 1; // 1-10
    public double SalaryMo { get; set; }
    public double DutyHours { get; set; } // hours flown this month
    public double MaxDutyH { get; set; } = 80;
    public string Status { get; set; } = "available"; // available | flying | resting
    public string? AircraftId { get; set; }
    public string CompanyId { get; set; } = string.Empty;
    public DateTime HiredAt { get; set; } = DateTime.UtcNow;
    public string? UserId { get; set; }
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? SyncedAt { get; set; }

    // Navigation
    public Aircraft? Aircraft { get; set; }
    public Company Company { get; set; } = null!;
}
