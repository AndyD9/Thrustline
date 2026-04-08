using System.Reflection;
using Thrustline.Bridge.Cloud;
using Thrustline.Bridge.Services;
using Thrustline.Bridge.Session;
using Thrustline.Bridge.SimConnect;

var builder = WebApplication.CreateBuilder(args);

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
if (simBridgeConfig.UseMockSimConnect || !OperatingSystem.IsWindows())
{
    builder.Services.AddSingleton<ISimClient, MockSimClient>();
}
else
{
#if HAS_SIMCONNECT
    builder.Services.AddSingleton<ISimClient, NativeSimConnectClient>();
#else
    builder.Services.AddSingleton<ISimClient, MockSimClient>();
#endif
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

// --- Pre-init Supabase if configured (fire-and-forget, errors are logged inside) ---
_ = app.Services.GetRequiredService<ISupabaseClientProvider>()
    .EnsureInitializedAsync(CancellationToken.None);

// --- REST endpoints ---
app.MapGet("/health", (ISupabaseClientProvider supabase, ISessionStore session) => Results.Ok(new
{
    status = "ok",
    version = "0.1.0",
    simConnect = simBridgeConfig.UseMockSimConnect ? "mock" : "native",
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

// --- Mock flight trigger (only in mock mode) ---
if (simBridgeConfig.UseMockSimConnect || !OperatingSystem.IsWindows())
{
    app.MapPost("/mock/start-flight", (MockFlightPayload payload, ISimClient client) =>
    {
        if (client is not MockSimClient mock)
            return Results.BadRequest(new { error = "Not in mock mode" });

        var waypoints = payload.Waypoints?
            .Select(w => new LatLon(w.Lat, w.Lon))
            .ToList() ?? new List<LatLon>();

        mock.StartFlight(new MockFlightPlan
        {
            OriginIcao = payload.OriginIcao,
            DestIcao = payload.DestIcao,
            IcaoType = payload.IcaoType,
            OriginLat = payload.OriginLat,
            OriginLon = payload.OriginLon,
            OriginElevFt = payload.OriginElevFt,
            DestLat = payload.DestLat,
            DestLon = payload.DestLon,
            DestElevFt = payload.DestElevFt,
            CruiseAltFt = payload.CruiseAltFt,
            CruiseSpeedKts = payload.CruiseSpeedKts,
            FuelGal = payload.FuelGal,
            DurationSeconds = payload.DurationSeconds > 0 ? payload.DurationSeconds : 120,
            Waypoints = waypoints,
        });
        return Results.Ok(new { status = "mock flight started" });
    });
}

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

public record SessionPayload(Guid UserId);

public record MockWaypointPayload(double Lat, double Lon);

public record MockFlightPayload(
    string OriginIcao,
    string DestIcao,
    string IcaoType,
    double OriginLat,
    double OriginLon,
    double OriginElevFt,
    double DestLat,
    double DestLon,
    double DestElevFt,
    double CruiseAltFt,
    double CruiseSpeedKts,
    double FuelGal,
    double DurationSeconds,
    List<MockWaypointPayload>? Waypoints
);
