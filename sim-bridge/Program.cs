using System.Reflection;
using System.Runtime.InteropServices;
using Thrustline.Bridge.Cloud;
using Thrustline.Bridge.Services;
using Thrustline.Bridge.Session;
using Thrustline.Bridge.SimConnect;

// --- Ensure .NET finds mixed-mode DLLs next to the exe, not just CWD ---
// Tauri may launch the sidecar with a different working directory than the exe location.
// The SimConnect managed DLL is mixed-mode (C++/CLI) and .NET resolves it from CWD by default.
var exeDir = AppContext.BaseDirectory;
if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
{
    Environment.CurrentDirectory = exeDir;
}

var builder = WebApplication.CreateBuilder(args);

// --- Kestrel: bind to localhost:5055 (hardcoded so the sidecar works
//     even without appsettings.json next to the single-file exe) ---
builder.WebHost.ConfigureKestrel(k =>
{
    k.ListenLocalhost(5055);
});

// --- Configuration ---
// Charge user-secrets inconditionnellement (pas seulement en Development) afin que
// `dotnet user-secrets set "Supabase:Url" ...` marche quelle que soit la façon dont
// le projet est lancé. optional: true → no-op si l'utilisateur n'a pas fait `init`.
builder.Configuration.AddUserSecrets(Assembly.GetExecutingAssembly(), optional: true);

var simBridgeConfig = builder.Configuration.GetSection("SimBridge").Get<SimBridgeOptions>() ?? new SimBridgeOptions();
builder.Services.AddSingleton(simBridgeConfig);

var supabaseConfig = builder.Configuration.GetSection("Supabase").Get<SupabaseOptions>() ?? new SupabaseOptions();
builder.Services.AddSingleton(supabaseConfig);

// --- Session (current logged-in user relayed from the React front) ---
builder.Services.AddSingleton<ISessionStore, SessionStore>();

// --- Supabase client ---
builder.Services.AddSingleton<ISupabaseClientProvider, SupabaseClientProvider>();

// --- Business services ---
builder.Services.AddSingleton<YieldService>();
builder.Services.AddSingleton<CashflowService>();
builder.Services.AddSingleton<MaintenanceService>();
builder.Services.AddSingleton<LandingGradeService>();
builder.Services.AddSingleton<FuelValidationService>();
builder.Services.AddSingleton<PaxSatisfactionService>();
builder.Services.AddSingleton<AcarsService>();
builder.Services.AddSingleton<AchievementService>();
builder.Services.AddSingleton<CompanyBonusService>();
builder.Services.AddSingleton<LandingProcessor>();

// --- SimConnect layer ---
builder.Services.AddSingleton<FlightDetector>();
if (OperatingSystem.IsWindows())
    builder.Services.AddSingleton<ISimClient, NativeSimConnectClient>();
else
    builder.Services.AddSingleton<ISimClient, IdleSimClient>();
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

// --- Pre-init Supabase if configured (fire-and-forget, errors are logged inside) ---
_ = app.Services.GetRequiredService<ISupabaseClientProvider>()
    .EnsureInitializedAsync(CancellationToken.None);

// --- REST endpoints ---
app.MapGet("/health", (ISimClient sim, ISupabaseClientProvider supabase, ISessionStore session) => Results.Ok(new
{
    status = "ok",
    version = "0.1.0",
    simConnect = sim is NativeSimConnectClient ? "native" : "idle",
    simConnected = sim.IsConnected,
    simError = sim.LastError,
    supabaseConfigured = supabase.IsConfigured,
    hasSession = session.HasSession,
    time = DateTimeOffset.UtcNow
}));

// --- Session sync from React ---
app.MapPost("/session", (SessionPayload payload, ISessionStore session) =>
{
    if (payload.UserId == Guid.Empty)
        return Results.BadRequest(new { error = "userId is required" });

    session.SetUser(payload.UserId);
    return Results.Ok(new { userId = payload.UserId });
});

app.MapDelete("/session", (ISessionStore session) =>
{
    session.Clear();
    return Results.NoContent();
});

// --- Weather proxy (avoids CORS issues with aviationweather.gov) ---
var httpClient = new HttpClient();
httpClient.DefaultRequestHeaders.Add("User-Agent", "Thrustline/1.0");

app.MapGet("/weather/metar/{icao}", async (string icao) =>
{
    try
    {
        var url = $"https://aviationweather.gov/api/data/metar?ids={icao}&format=raw&taf=false";
        var text = (await httpClient.GetStringAsync(url)).Trim();
        return string.IsNullOrEmpty(text) ? Results.NotFound() : Results.Ok(new { raw = text });
    }
    catch (Exception ex)
    {
        return Results.Problem($"Weather fetch failed: {ex.Message}");
    }
});

app.MapGet("/weather/taf/{icao}", async (string icao) =>
{
    try
    {
        var url = $"https://aviationweather.gov/api/data/taf?ids={icao}&format=raw";
        var text = (await httpClient.GetStringAsync(url)).Trim();
        return string.IsNullOrEmpty(text) ? Results.NotFound() : Results.Ok(new { raw = text });
    }
    catch (Exception ex)
    {
        return Results.Problem($"Weather fetch failed: {ex.Message}");
    }
});

// --- SignalR hub ---
app.MapHub<SimHub>("/hubs/sim");

app.Run();

public class SimBridgeOptions
{
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

public record SessionPayload(Guid UserId);
