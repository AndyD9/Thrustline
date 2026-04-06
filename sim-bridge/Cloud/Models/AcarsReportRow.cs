using Supabase.Postgrest.Attributes;
using Supabase.Postgrest.Models;

namespace Thrustline.Bridge.Cloud.Models;

[Table("acars_reports")]
public class AcarsReportRow : BaseModel
{
    [PrimaryKey("id", false)]
    public Guid Id { get; set; }

    [Column("user_id")]
    public Guid UserId { get; set; }

    [Column("company_id")]
    public Guid CompanyId { get; set; }

    [Column("flight_id")]
    public Guid? FlightId { get; set; }

    [Column("dispatch_id")]
    public Guid DispatchId { get; set; }

    [Column("phase")]
    public string Phase { get; set; } = "";

    [Column("latitude")]
    public double Latitude { get; set; }

    [Column("longitude")]
    public double Longitude { get; set; }

    [Column("altitude_ft")]
    public double AltitudeFt { get; set; }

    [Column("ground_speed_kts")]
    public double GroundSpeedKts { get; set; }

    [Column("heading_deg")]
    public double HeadingDeg { get; set; }

    [Column("vs_fpm")]
    public double VsFpm { get; set; }

    [Column("fuel_gal")]
    public double FuelGal { get; set; }

    [Column("message")]
    public string Message { get; set; } = "";

    [Column("created_at")]
    public DateTime CreatedAt { get; set; }
}
