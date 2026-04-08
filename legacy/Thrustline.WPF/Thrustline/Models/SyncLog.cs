namespace Thrustline.Models;

public class SyncLog
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string TableName { get; set; } = string.Empty;
    public string RecordId { get; set; } = string.Empty;
    public string Action { get; set; } = string.Empty; // create | update | delete
    public string? Payload { get; set; } // JSON snapshot
    public DateTime? SyncedAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
