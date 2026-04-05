using Supabase.Postgrest.Attributes;
using Supabase.Postgrest.Models;

namespace Thrustline.Bridge.Cloud.Models;

[Table("flights")]
public class FlightRow : BaseModel
{
    [PrimaryKey("id", false)]
    public Guid Id { get; set; }

    [Column("user_id")]
    public Guid UserId { get; set; }

    [Column("company_id")]
    public Guid CompanyId { get; set; }

    [Column("aircraft_id")]
    public Guid? AircraftId { get; set; }

    [Column("dispatch_id")]
    public Guid? DispatchId { get; set; }

    [Column("departure_icao")]
    public string DepartureIcao { get; set; } = "";

    [Column("arrival_icao")]
    public string ArrivalIcao { get; set; } = "";

    [Column("duration_min")]
    public int DurationMin { get; set; }

    [Column("fuel_used_gal")]
    public decimal FuelUsedGal { get; set; }

    [Column("distance_nm")]
    public decimal DistanceNm { get; set; }

    [Column("landing_vs_fpm")]
    public decimal LandingVsFpm { get; set; }

    [Column("revenue")]
    public decimal Revenue { get; set; }

    [Column("fuel_cost")]
    public decimal FuelCost { get; set; }

    [Column("landing_fee")]
    public decimal LandingFee { get; set; }

    [Column("net_result")]
    public decimal NetResult { get; set; }

    [Column("started_at")]
    public DateTime StartedAt { get; set; }

    [Column("completed_at")]
    public DateTime CompletedAt { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; }

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; }
}
