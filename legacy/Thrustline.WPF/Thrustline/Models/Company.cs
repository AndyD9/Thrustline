namespace Thrustline.Models;

public class Company
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string Name { get; set; } = string.Empty;
    public double Capital { get; set; } = 1_000_000;
    public string? HubIcao { get; set; }
    public string? ActiveAircraftId { get; set; }
    public string AirlineCode { get; set; } = "THL";
    public string? SimbriefUsername { get; set; }
    public bool Onboarded { get; set; }
    public string? UserId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? SyncedAt { get; set; }

    // Navigation properties
    public ICollection<Flight> Flights { get; set; } = new List<Flight>();
    public ICollection<Aircraft> Fleet { get; set; } = new List<Aircraft>();
    public ICollection<Route> Routes { get; set; } = new List<Route>();
    public ICollection<Dispatch> Dispatches { get; set; } = new List<Dispatch>();
    public ICollection<CrewMember> Crew { get; set; } = new List<CrewMember>();
    public ICollection<Reputation> Reputations { get; set; } = new List<Reputation>();
    public ICollection<GameEvent> Events { get; set; } = new List<GameEvent>();
    public ICollection<Loan> Loans { get; set; } = new List<Loan>();
}
