using Microsoft.EntityFrameworkCore;
using Thrustline.Bridge.Data.Entities;

namespace Thrustline.Bridge.Data;

public class ThrustlineDbContext : DbContext
{
    public ThrustlineDbContext(DbContextOptions<ThrustlineDbContext> options) : base(options) { }

    public DbSet<Company> Companies => Set<Company>();
    public DbSet<Aircraft> Aircraft => Set<Aircraft>();
    public DbSet<Flight> Flights => Set<Flight>();
    public DbSet<Dispatch> Dispatches => Set<Dispatch>();
    public DbSet<Route> Routes => Set<Route>();
    public DbSet<Reputation> Reputations => Set<Reputation>();
    public DbSet<CrewMember> CrewMembers => Set<CrewMember>();
    public DbSet<Loan> Loans => Set<Loan>();
    public DbSet<GameEvent> GameEvents => Set<GameEvent>();
    public DbSet<Transaction> Transactions => Set<Transaction>();
    public DbSet<SyncLog> SyncLogs => Set<SyncLog>();

    protected override void OnModelCreating(ModelBuilder mb)
    {
        // --- Keys (string Guids by default, long for SyncLog) ---
        mb.Entity<Company>().HasKey(e => e.Id);
        mb.Entity<Aircraft>().HasKey(e => e.Id);
        mb.Entity<Flight>().HasKey(e => e.Id);
        mb.Entity<Dispatch>().HasKey(e => e.Id);
        mb.Entity<Route>().HasKey(e => e.Id);
        mb.Entity<Reputation>().HasKey(e => e.Id);
        mb.Entity<CrewMember>().HasKey(e => e.Id);
        mb.Entity<Loan>().HasKey(e => e.Id);
        mb.Entity<GameEvent>().HasKey(e => e.Id);
        mb.Entity<Transaction>().HasKey(e => e.Id);
        mb.Entity<SyncLog>().HasKey(e => e.Id);

        // --- Multi-tenant indexes ---
        mb.Entity<Company>().HasIndex(e => e.UserId);
        mb.Entity<Aircraft>().HasIndex(e => new { e.UserId, e.CompanyId });
        mb.Entity<Flight>().HasIndex(e => new { e.UserId, e.CompanyId, e.CompletedAt });
        mb.Entity<Dispatch>().HasIndex(e => new { e.UserId, e.CompanyId, e.Status });
        mb.Entity<Route>().HasIndex(e => new { e.UserId, e.CompanyId });
        mb.Entity<Reputation>().HasIndex(e => new { e.CompanyId, e.OriginIcao, e.DestIcao }).IsUnique();
        mb.Entity<CrewMember>().HasIndex(e => new { e.UserId, e.CompanyId });
        mb.Entity<Loan>().HasIndex(e => new { e.UserId, e.CompanyId });
        mb.Entity<GameEvent>().HasIndex(e => new { e.UserId, e.ExpiresAt });
        mb.Entity<Transaction>().HasIndex(e => new { e.UserId, e.CompanyId, e.CreatedAt });
        mb.Entity<SyncLog>().HasIndex(e => new { e.UserId, e.SyncedAt });

        // --- Enums stored as strings for readability in SQLite ---
        mb.Entity<Aircraft>().Property(e => e.Ownership).HasConversion<string>();
        mb.Entity<Dispatch>().Property(e => e.Status).HasConversion<string>();
        mb.Entity<CrewMember>().Property(e => e.Rank).HasConversion<string>();
        mb.Entity<CrewMember>().Property(e => e.Status).HasConversion<string>();
        mb.Entity<GameEvent>().Property(e => e.Type).HasConversion<string>();
        mb.Entity<GameEvent>().Property(e => e.Scope).HasConversion<string>();
        mb.Entity<Transaction>().Property(e => e.Type).HasConversion<string>();
        mb.Entity<SyncLog>().Property(e => e.Action).HasConversion<string>();
    }

    public override int SaveChanges()
    {
        TouchTimestamps();
        return base.SaveChanges();
    }

    public override Task<int> SaveChangesAsync(CancellationToken ct = default)
    {
        TouchTimestamps();
        return base.SaveChangesAsync(ct);
    }

    private void TouchTimestamps()
    {
        var now = DateTimeOffset.UtcNow;
        foreach (var entry in ChangeTracker.Entries())
        {
            if (entry.State == EntityState.Modified)
            {
                if (entry.Metadata.FindProperty("UpdatedAt") != null)
                    entry.Property("UpdatedAt").CurrentValue = now;
                if (entry.Metadata.FindProperty("SyncedAt") != null)
                    entry.Property("SyncedAt").CurrentValue = null; // invalidate pour prochain push
            }
        }
    }
}
