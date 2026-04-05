namespace Thrustline.Bridge.Data.Entities;

public enum SyncAction { Create, Update, Delete }

public class SyncLog
{
    public long Id { get; set; }
    public string UserId { get; set; } = "";
    public string TableName { get; set; } = "";
    public string RecordId { get; set; } = "";
    public SyncAction Action { get; set; }
    public string? Payload { get; set; } // JSON
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? SyncedAt { get; set; }
}
