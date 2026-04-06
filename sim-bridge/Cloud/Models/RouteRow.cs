using Supabase.Postgrest.Attributes;
using Supabase.Postgrest.Models;

namespace Thrustline.Bridge.Cloud.Models;

[Table("routes")]
public class RouteRow : BaseModel
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

    [Column("distance_nm")]
    public decimal DistanceNm { get; set; }

    [Column("base_price")]
    public decimal BasePrice { get; set; }

    [Column("price_modifier")]
    public decimal PriceModifier { get; set; } = 1.0m;

    [Column("active")]
    public bool Active { get; set; } = true;

    [Column("created_at")]
    public DateTime CreatedAt { get; set; }

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; }
}
