using Supabase.Postgrest.Attributes;
using Supabase.Postgrest.Models;

namespace Thrustline.Bridge.Cloud.Models;

[Table("reputations")]
public class ReputationRow : BaseModel
{
    [PrimaryKey("id", false)]
    public Guid Id { get; set; }

    [Column("user_id")]
    public Guid UserId { get; set; }

    [Column("company_id")]
    public Guid CompanyId { get; set; }

    [Column("origin_icao")]
    public string OriginIcao { get; set; } = "";

    [Column("dest_icao")]
    public string DestIcao { get; set; } = "";

    [Column("score")]
    public decimal Score { get; set; } = 50m;

    [Column("flight_count")]
    public int FlightCount { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; }

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; }
}
