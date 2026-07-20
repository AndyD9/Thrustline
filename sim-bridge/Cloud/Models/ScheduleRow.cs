using Supabase.Postgrest.Attributes;
using Supabase.Postgrest.Models;

namespace Thrustline.Bridge.Cloud.Models;

[Table("schedules")]
public class ScheduleRow : BaseModel
{
    [PrimaryKey("id", false)]
    public Guid Id { get; set; }

    [Column("status")]
    public string Status { get; set; } = "planned";

    [Column("completed_at")]
    public DateTime? CompletedAt { get; set; }
}
