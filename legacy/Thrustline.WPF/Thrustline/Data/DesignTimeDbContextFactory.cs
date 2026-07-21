using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Thrustline.Data;

public class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<ThrustlineDbContext>
{
    public ThrustlineDbContext CreateDbContext(string[] args)
    {
        var options = new DbContextOptionsBuilder<ThrustlineDbContext>()
            .UseSqlite("Data Source=thrustline-design.db")
            .Options;

        return new ThrustlineDbContext(options);
    }
}
