using Supabase.Postgrest.Attributes;
using Supabase.Postgrest.Models;

namespace Thrustline.Bridge.Cloud.Models;

[Table("companies")]
public class CompanyRow : BaseModel
{
    [PrimaryKey("id", false)]
    public Guid Id { get; set; }

    [Column("user_id")]
    public Guid UserId { get; set; }

    [Column("name")]
    public string Name { get; set; } = "";

    [Column("airline_code")]
    public string AirlineCode { get; set; } = "";

    [Column("hub_icao")]
    public string HubIcao { get; set; } = "";

    [Column("capital")]
    public decimal Capital { get; set; }

    [Column("active_aircraft_id")]
    public Guid? ActiveAircraftId { get; set; }

    [Column("simbrief_username")]
    public string? SimbriefUsername { get; set; }

    [Column("onboarded")]
    public bool Onboarded { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; }

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; }
}
