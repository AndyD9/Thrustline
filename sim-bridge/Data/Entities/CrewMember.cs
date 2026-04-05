namespace Thrustline.Bridge.Data.Entities;

public enum CrewRank { Captain, FirstOfficer }
public enum CrewStatus { Available, Flying, Resting }

public class CrewMember
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string UserId { get; set; } = "";
    public string CompanyId { get; set; } = "";
    public string? AircraftId { get; set; }
    public string FirstName { get; set; } = "";
    public string LastName { get; set; } = "";
    public CrewRank Rank { get; set; } = CrewRank.FirstOfficer;
    public int Experience { get; set; }
    public double SalaryMo { get; set; }
    public double DutyHours { get; set; }
    public double MaxDutyH { get; set; } = 80.0;
    public CrewStatus Status { get; set; } = CrewStatus.Available;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? SyncedAt { get; set; }
}
