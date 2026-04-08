using Microsoft.EntityFrameworkCore;
using Thrustline.Models;

namespace Thrustline.Data;

public class ThrustlineDbContext : DbContext
{
    public ThrustlineDbContext(DbContextOptions<ThrustlineDbContext> options) : base(options) { }

    public DbSet<Company> Companies => Set<Company>();
    public DbSet<Loan> Loans => Set<Loan>();
    public DbSet<Dispatch> Dispatches => Set<Dispatch>();
    public DbSet<Aircraft> Aircraft => Set<Aircraft>();
    public DbSet<Flight> Flights => Set<Flight>();
    public DbSet<Route> Routes => Set<Route>();
    public DbSet<GameEvent> GameEvents => Set<GameEvent>();
    public DbSet<Reputation> Reputations => Set<Reputation>();
    public DbSet<CrewMember> CrewMembers => Set<CrewMember>();
    public DbSet<Transaction> Transactions => Set<Transaction>();
    public DbSet<SyncLog> SyncLogs => Set<SyncLog>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // ── Company ──────────────────────────────────────────────────────
        modelBuilder.Entity<Company>(e =>
        {
            e.HasKey(c => c.Id);
            e.Property(c => c.Capital).HasDefaultValue(1_000_000);
            e.Property(c => c.AirlineCode).HasDefaultValue("THL");
            e.Property(c => c.Onboarded).HasDefaultValue(false);
        });

        // ── Loan ─────────────────────────────────────────────────────────
        modelBuilder.Entity<Loan>(e =>
        {
            e.HasKey(l => l.Id);
            e.Property(l => l.PaidMonths).HasDefaultValue(0);
            e.HasOne(l => l.Company)
                .WithMany(c => c.Loans)
                .HasForeignKey(l => l.CompanyId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // ── Dispatch ─────────────────────────────────────────────────────
        modelBuilder.Entity<Dispatch>(e =>
        {
            e.HasKey(d => d.Id);
            e.Property(d => d.Status).HasDefaultValue("pending");
            e.HasOne(d => d.Company)
                .WithMany(c => c.Dispatches)
                .HasForeignKey(d => d.CompanyId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // ── Aircraft ─────────────────────────────────────────────────────
        modelBuilder.Entity<Aircraft>(e =>
        {
            e.HasKey(a => a.Id);
            e.Property(a => a.HealthPct).HasDefaultValue(100.0);
            e.Property(a => a.TotalHours).HasDefaultValue(0.0);
            e.Property(a => a.Cycles).HasDefaultValue(0);
            e.Property(a => a.Ownership).HasDefaultValue("leased");
            e.HasOne(a => a.Company)
                .WithMany(c => c.Fleet)
                .HasForeignKey(a => a.CompanyId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // ── Flight ───────────────────────────────────────────────────────
        modelBuilder.Entity<Flight>(e =>
        {
            e.HasKey(f => f.Id);
            e.Property(f => f.Revenue).HasDefaultValue(0.0);
            e.Property(f => f.FuelCost).HasDefaultValue(0.0);
            e.Property(f => f.LandingFee).HasDefaultValue(0.0);
            e.Property(f => f.NetResult).HasDefaultValue(0.0);
            e.HasOne(f => f.Company)
                .WithMany(c => c.Flights)
                .HasForeignKey(f => f.CompanyId)
                .OnDelete(DeleteBehavior.Restrict);
            e.HasOne(f => f.Aircraft)
                .WithMany(a => a.Flights)
                .HasForeignKey(f => f.AircraftId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        // ── Route ────────────────────────────────────────────────────────
        modelBuilder.Entity<Route>(e =>
        {
            e.HasKey(r => r.Id);
            e.Property(r => r.Active).HasDefaultValue(true);
            e.HasOne(r => r.Company)
                .WithMany(c => c.Routes)
                .HasForeignKey(r => r.CompanyId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // ── GameEvent ────────────────────────────────────────────────────
        modelBuilder.Entity<GameEvent>(e =>
        {
            e.HasKey(g => g.Id);
            e.Property(g => g.Modifier).HasDefaultValue(1.0);
            e.HasOne(g => g.Company)
                .WithMany(c => c.Events)
                .HasForeignKey(g => g.CompanyId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // ── Reputation ───────────────────────────────────────────────────
        modelBuilder.Entity<Reputation>(e =>
        {
            e.HasKey(r => r.Id);
            e.Property(r => r.Score).HasDefaultValue(50.0);
            e.Property(r => r.FlightCount).HasDefaultValue(0);
            e.HasIndex(r => new { r.OriginIcao, r.DestIcao, r.CompanyId }).IsUnique();
            e.HasOne(r => r.Company)
                .WithMany(c => c.Reputations)
                .HasForeignKey(r => r.CompanyId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // ── CrewMember ───────────────────────────────────────────────────
        modelBuilder.Entity<CrewMember>(e =>
        {
            e.HasKey(c => c.Id);
            e.Property(c => c.Rank).HasDefaultValue("first_officer");
            e.Property(c => c.Experience).HasDefaultValue(1);
            e.Property(c => c.DutyHours).HasDefaultValue(0.0);
            e.Property(c => c.MaxDutyH).HasDefaultValue(80.0);
            e.Property(c => c.Status).HasDefaultValue("available");
            e.HasOne(c => c.Aircraft)
                .WithMany(a => a.Crew)
                .HasForeignKey(c => c.AircraftId)
                .OnDelete(DeleteBehavior.SetNull);
            e.HasOne(c => c.Company)
                .WithMany(co => co.Crew)
                .HasForeignKey(c => c.CompanyId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // ── Transaction ──────────────────────────────────────────────────
        modelBuilder.Entity<Transaction>(e =>
        {
            e.HasKey(t => t.Id);
        });

        // ── SyncLog ──────────────────────────────────────────────────────
        modelBuilder.Entity<SyncLog>(e =>
        {
            e.HasKey(s => s.Id);
            e.HasIndex(s => new { s.TableName, s.SyncedAt });
        });
    }

    public override int SaveChanges()
    {
        SetUpdatedAt();
        return base.SaveChanges();
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        SetUpdatedAt();
        return base.SaveChangesAsync(cancellationToken);
    }

    private void SetUpdatedAt()
    {
        var entries = ChangeTracker.Entries()
            .Where(e => e.State is EntityState.Modified or EntityState.Added);

        foreach (var entry in entries)
        {
            var prop = entry.Properties.FirstOrDefault(p => p.Metadata.Name == "UpdatedAt");
            if (prop != null)
                prop.CurrentValue = DateTime.UtcNow;
        }
    }
}
