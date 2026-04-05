using Supabase.Postgrest.Attributes;
using Supabase.Postgrest.Models;

namespace Thrustline.Bridge.Cloud.Models;

[Table("dispatches")]
public class DispatchRow : BaseModel
{
    public const string StatusPending = "pending";
    public const string StatusDispatched = "dispatched";
    public const string StatusFlying = "flying";
    public const string StatusCompleted = "completed";
    public const string StatusCancelled = "cancelled";

    [PrimaryKey("id", false)]
    public Guid Id { get; set; }

    [Column("user_id")]
    public Guid UserId { get; set; }

    [Column("company_id")]
    public Guid CompanyId { get; set; }

    [Column("aircraft_id")]
    public Guid? AircraftId { get; set; }

    [Column("flight_number")]
    public string FlightNumber { get; set; } = "";

    [Column("origin_icao")]
    public string OriginIcao { get; set; } = "";

    [Column("dest_icao")]
    public string DestIcao { get; set; } = "";

    [Column("icao_type")]
    public string IcaoType { get; set; } = "";

    [Column("pax_eco")]
    public int PaxEco { get; set; }

    [Column("pax_biz")]
    public int PaxBiz { get; set; }

    [Column("cargo_kg")]
    public decimal CargoKg { get; set; }

    [Column("estim_fuel_lbs")]
    public decimal EstimFuelLbs { get; set; }

    [Column("cruise_alt")]
    public int CruiseAlt { get; set; }

    [Column("status")]
    public string Status { get; set; } = StatusPending;

    [Column("ofp_data")]
    public string? OfpData { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; }

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; }
}
