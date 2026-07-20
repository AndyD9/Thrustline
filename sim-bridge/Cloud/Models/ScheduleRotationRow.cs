using Supabase.Postgrest.Attributes;
using Supabase.Postgrest.Models;

namespace Thrustline.Bridge.Cloud.Models;

[Table("schedule_rotations")]
public class ScheduleRotationRow : BaseModel
{
    [PrimaryKey("id", false)]
    public Guid Id { get; set; }

    [Column("schedule_id")]
    public Guid ScheduleId { get; set; }

    [Column("sequence")]
    public int Sequence { get; set; }

    [Column("status")]
    public string Status { get; set; } = "planned";
}
