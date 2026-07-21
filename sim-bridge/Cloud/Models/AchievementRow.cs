using Supabase.Postgrest.Attributes;
using Supabase.Postgrest.Models;

namespace Thrustline.Bridge.Cloud.Models;

[Table("achievements")]
public class AchievementRow : BaseModel
{
    [PrimaryKey("id", false)]
    public Guid Id { get; set; }

    [Column("user_id")]
    public Guid UserId { get; set; }

    [Column("company_id")]
    public Guid CompanyId { get; set; }

    [Column("key")]
    public string Key { get; set; } = "";

    [Column("title")]
    public string Title { get; set; } = "";

    [Column("description")]
    public string Description { get; set; } = "";

    [Column("icon")]
    public string Icon { get; set; } = "trophy";

    [Column("unlocked_at")]
    public DateTime UnlockedAt { get; set; }

    [Column("flight_id")]
    public Guid? FlightId { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; }
}
