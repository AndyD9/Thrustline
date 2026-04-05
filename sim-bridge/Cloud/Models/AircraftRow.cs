using Supabase.Postgrest.Attributes;
using Supabase.Postgrest.Models;

namespace Thrustline.Bridge.Cloud.Models;

[Table("aircraft")]
public class AircraftRow : BaseModel
{
    [PrimaryKey("id", false)]
    public Guid Id { get; set; }

    [Column("user_id")]
    public Guid UserId { get; set; }

    [Column("company_id")]
    public Guid CompanyId { get; set; }

    [Column("name")]
    public string Name { get; set; } = "";

    [Column("icao_type")]
    public string IcaoType { get; set; } = "";

    [Column("health_pct")]
    public decimal HealthPct { get; set; } = 100m;

    [Column("lease_cost_mo")]
    public decimal LeaseCostMo { get; set; }

    [Column("total_hours")]
    public decimal TotalHours { get; set; }

    [Column("cycles")]
    public int Cycles { get; set; }

    [Column("ownership")]
    public string Ownership { get; set; } = "leased"; // 'leased' | 'owned'

    [Column("purchase_price")]
    public decimal PurchasePrice { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; }

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; }
}
