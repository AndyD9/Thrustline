using Microsoft.EntityFrameworkCore;
using Thrustline.Bridge.Data;
using Thrustline.Bridge.SimConnect;

var builder = WebApplication.CreateBuilder(args);

// --- Configuration ---
var simBridgeConfig = builder.Configuration.GetSection("SimBridge").Get<SimBridgeOptions>() ?? new SimBridgeOptions();
builder.Services.AddSingleton(simBridgeConfig);

// --- Database (EF Core + SQLite) ---
var sqliteConn = builder.Configuration.GetConnectionString("Sqlite") ?? "Data Source=thrustline.db";
builder.Services.AddDbContext<ThrustlineDbContext>(opt => opt.UseSqlite(sqliteConn));

// --- SimConnect layer ---
builder.Services.AddSingleton<FlightDetector>();
if (simBridgeConfig.UseMockSimConnect || !OperatingSystem.IsWindows())
{
    builder.Services.AddSingleton<ISimClient, MockSimClient>();
}
else
{
    // Real Windows SimConnect client (to be wired once Microsoft.FlightSimulator.SimConnect.dll is referenced)
    builder.Services.AddSingleton<ISimClient, MockSimClient>();
}
builder.Services.AddHostedService<SimConnectWorker>();

// --- SignalR (for real-time sim stream to front) ---
builder.Services.AddSignalR();

// --- CORS: allow the Tauri webview and localhost React dev server ---
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.SetIsOriginAllowed(_ => true)
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

var app = builder.Build();

app.UseCors();

// --- Auto-apply EF migrations on startup ---
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<ThrustlineDbContext>();
    db.Database.EnsureCreated();
    // TODO: switch to db.Database.Migrate() once first migration is generated
}

// --- REST endpoints ---
app.MapGet("/health", () => Results.Ok(new
{
    status = "ok",
    version = "0.1.0",
    simConnect = simBridgeConfig.UseMockSimConnect ? "mock" : "native",
    time = DateTimeOffset.UtcNow
}));

// --- SignalR hub ---
app.MapHub<SimHub>("/hubs/sim");

app.Run();

public class SimBridgeOptions
{
    public bool UseMockSimConnect { get; set; } = true;
    public int PollingIntervalMs { get; set; } = 1000;
    public int GroundDebounceSeconds { get; set; } = 5;
}
