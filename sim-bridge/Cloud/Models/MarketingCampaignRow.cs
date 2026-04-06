using Supabase.Postgrest.Attributes;
using Supabase.Postgrest.Models;

namespace Thrustline.Bridge.Cloud.Models;

[Table("marketing_campaigns")]
public class MarketingCampaignRow : BaseModel
{
    [PrimaryKey("id", false)]
    public Guid Id { get; set; }

    [Column("user_id")]
    public Guid UserId { get; set; }

    [Column("company_id")]
    public Guid CompanyId { get; set; }

    [Column("campaign_type")]
    public string CampaignType { get; set; } = "";

    [Column("scope")]
    public string Scope { get; set; } = "global";

    [Column("target_route")]
    public string? TargetRoute { get; set; }

    [Column("demand_multiplier")]
    public decimal DemandMultiplier { get; set; } = 1.0m;

    [Column("daily_cost")]
    public decimal DailyCost { get; set; }

    [Column("started_at")]
    public DateTime StartedAt { get; set; }

    [Column("expires_at")]
    public DateTime ExpiresAt { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; }
}
