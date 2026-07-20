using Supabase.Postgrest.Attributes;
using Supabase.Postgrest.Models;

namespace Thrustline.Bridge.Cloud.Models;

[Table("schedule_legs")]
public class ScheduleLegRow : BaseModel
{
    [PrimaryKey("id", false)]
    public Guid Id { get; set; }

    [Column("schedule_id")]
    public Guid ScheduleId { get; set; }

    [Column("rotation_id")]
    public Guid RotationId { get; set; }

    [Column("dispatch_id")]
    public Guid? DispatchId { get; set; }

    [Column("sequence")]
    public int Sequence { get; set; }

    [Column("status")]
    public string Status { get; set; } = "planned";

    [Column("completed_at")]
    public DateTime? CompletedAt { get; set; }
}
