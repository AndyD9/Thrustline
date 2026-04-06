using Supabase.Postgrest.Attributes;
using Supabase.Postgrest.Models;

namespace Thrustline.Bridge.Cloud.Models;

[Table("partnerships")]
public class PartnershipRow : BaseModel
{
    [PrimaryKey("id", false)]
    public Guid Id { get; set; }

    [Column("user_id")]
    public Guid UserId { get; set; }

    [Column("company_id")]
    public Guid CompanyId { get; set; }

    [Column("partner_key")]
    public string PartnerKey { get; set; } = "";

    [Column("partner_name")]
    public string PartnerName { get; set; } = "";

    [Column("bonus_type")]
    public string BonusType { get; set; } = "";

    [Column("bonus_value")]
    public decimal BonusValue { get; set; }

    [Column("monthly_cost")]
    public decimal MonthlyCost { get; set; }

    [Column("active")]
    public bool Active { get; set; } = true;

    [Column("created_at")]
    public DateTime CreatedAt { get; set; }

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; }
}
