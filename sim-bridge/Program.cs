using Thrustline.Bridge.SimConnect;

var builder = WebApplication.CreateBuilder(args);

// --- Configuration ---
var simBridgeConfig = builder.Configuration.GetSection("SimBridge").Get<SimBridgeOptions>() ?? new SimBridgeOptions();
builder.Services.AddSingleton(simBridgeConfig);

var supabaseConfig = builder.Configuration.GetSection("Supabase").Get<SupabaseOptions>() ?? new SupabaseOptions();
builder.Services.AddSingleton(supabaseConfig);

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

// --- SignalR (real-time sim stream towards the React front) ---
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

// --- REST endpoints ---
app.MapGet("/health", () => Results.Ok(new
{
    status = "ok",
    version = "0.1.0",
    simConnect = simBridgeConfig.UseMockSimConnect ? "mock" : "native",
    supabaseConfigured = !string.IsNullOrEmpty(supabaseConfig.Url),
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

public class SupabaseOptions
{
    /// <summary>URL du projet Supabase, ex: https://xxx.supabase.co</summary>
    public string Url { get; set; } = "";

    /// <summary>
    /// Service role key — UNIQUEMENT côté sim-bridge (backend), jamais exposée au front.
    /// Permet d'écrire les flights/transactions en contournant RLS lors des landings.
    /// À mettre dans une variable d'environnement SIM_BRIDGE__SUPABASE__SERVICEROLEKEY
    /// ou dans user secrets, jamais commitée.
    /// </summary>
    public string ServiceRoleKey { get; set; } = "";
}
