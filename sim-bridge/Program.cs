using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
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
builder.Logging.ClearProviders();
builder.Logging.AddConsole();
builder.Logging.AddDebug();

// --- Kestrel: bind to localhost:5055 (hardcoded so the sidecar works
//     even without appsettings.json next to the single-file exe) ---
builder.WebHost.ConfigureKestrel(k =>
{
    k.ListenLocalhost(5055);
});

var simBridgeConfig = builder.Configuration.GetSection("SimBridge").Get<SimBridgeOptions>() ?? new SimBridgeOptions();
builder.Services.AddSingleton(simBridgeConfig);

// --- Session (current logged-in user relayed from the React front) ---
builder.Services.AddSingleton<ISessionStore, SessionStore>();

// --- Business services ---
builder.Services.AddSingleton<YieldService>();
builder.Services.AddSingleton<CashflowService>();
builder.Services.AddSingleton<MaintenanceService>();
builder.Services.AddSingleton<LandingGradeService>();
builder.Services.AddSingleton<FuelValidationService>();
builder.Services.AddSingleton<PaxSatisfactionService>();
builder.Services.AddSingleton<PassengerExperienceService>();
builder.Services.AddSingleton<AcarsService>();
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
builder.Services.AddHttpClient();

// --- CORS: allow the Tauri webview and localhost React dev server ---
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.WithOrigins(
                  "http://tauri.localhost",
                  "https://tauri.localhost",
                  "tauri://localhost",
                  "http://localhost:1420",
                  "http://127.0.0.1:1420")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

var app = builder.Build();

app.UseCors();

var bridgeToken = Environment.GetEnvironmentVariable("THRUSTLINE_BRIDGE_TOKEN");
if (string.IsNullOrWhiteSpace(bridgeToken) && app.Environment.IsDevelopment())
    bridgeToken = "dev-only-bridge-token";
if (string.IsNullOrWhiteSpace(bridgeToken))
    throw new InvalidOperationException("THRUSTLINE_BRIDGE_TOKEN is required outside development.");
var expectedBridgeToken = Encoding.UTF8.GetBytes(bridgeToken);

app.Use(async (context, next) =>
{
    if (HttpMethods.IsOptions(context.Request.Method)) { await next(); return; }
    var supplied = context.Request.Headers["X-Thrustline-Bridge-Token"].FirstOrDefault()
        ?? context.Request.Query["bridge_token"].FirstOrDefault();
    var suppliedBytes = Encoding.UTF8.GetBytes(supplied ?? "");
    if (suppliedBytes.Length != expectedBridgeToken.Length ||
        !CryptographicOperations.FixedTimeEquals(suppliedBytes, expectedBridgeToken))
    {
        context.Response.StatusCode = StatusCodes.Status401Unauthorized;
        return;
    }
    await next();
});

// --- REST endpoints ---
app.MapGet("/health", (ISimClient sim, ISessionStore session) => Results.Ok(new
{
    status = "ok",
    version = "0.2.0",
    simConnect = sim is NativeSimConnectClient ? "native" : "idle",
    simConnected = sim.IsConnected,
    simError = sim.LastError,
    backendConfigured = session.HasSession,
    hasSession = session.HasSession,
    time = DateTimeOffset.UtcNow
}));

// --- Session sync from React ---
app.MapPost("/session", async (
    SessionPayload payload,
    ISessionStore session,
    IHttpClientFactory httpClientFactory,
    CancellationToken ct) =>
{
    if (string.IsNullOrWhiteSpace(payload.AccessToken))
        return Results.BadRequest(new { error = "accessToken is required" });

    if (!Uri.TryCreate(payload.SupabaseUrl, UriKind.Absolute, out var supabaseUrl) ||
        (supabaseUrl.Scheme != Uri.UriSchemeHttps && !supabaseUrl.IsLoopback) ||
        (!supabaseUrl.IsLoopback && !supabaseUrl.Host.EndsWith(".supabase.co", StringComparison.OrdinalIgnoreCase)))
        return Results.BadRequest(new { error = "Invalid Supabase URL" });
    if (string.IsNullOrWhiteSpace(payload.AnonKey))
        return Results.BadRequest(new { error = "anonKey is required" });

    try
    {
        using var request = new HttpRequestMessage(
            HttpMethod.Get,
            new Uri(supabaseUrl, "/auth/v1/user"));
        request.Headers.Authorization = new("Bearer", payload.AccessToken);
        request.Headers.Add("apikey", payload.AnonKey);

        using var response = await httpClientFactory.CreateClient().SendAsync(request, ct);
        if (!response.IsSuccessStatusCode)
            return Results.Unauthorized();

        await using var body = await response.Content.ReadAsStreamAsync(ct);
        using var user = await JsonDocument.ParseAsync(body, cancellationToken: ct);
        if (!user.RootElement.TryGetProperty("id", out var idElement) ||
            !Guid.TryParse(idElement.GetString(), out var authenticatedUserId))
            return Results.Unauthorized();

        session.Set(new AuthenticatedSession(authenticatedUserId, payload.AccessToken, supabaseUrl));
        return Results.Ok(new { userId = authenticatedUserId });
    }
    catch (HttpRequestException)
    {
        return Results.Problem("Supabase authentication is temporarily unavailable.", statusCode: 503);
    }
});

app.MapDelete("/session", (ISessionStore session) =>
{
    session.Clear();
    return Results.NoContent();
});

app.MapPost("/flight/context", (FlightContextPayload payload, ISessionStore session) =>
{
    if (!session.HasSession) return Results.Unauthorized();
    if (payload.DispatchId == Guid.Empty || payload.CompanyId == Guid.Empty ||
        payload.EconomyPassengers < 0 || payload.BusinessPassengers < 0 ||
        payload.EconomyPassengers + payload.BusinessPassengers > 1000)
        return Results.BadRequest(new { error = "Invalid flight context" });
    session.SetFlightContext(new ActiveFlightContext(
        payload.DispatchId, payload.CompanyId, payload.EconomyPassengers, payload.BusinessPassengers));
    return Results.NoContent();
});

// --- Weather proxy (avoids CORS issues with aviationweather.gov) ---
var httpClient = new HttpClient();
httpClient.DefaultRequestHeaders.Add("User-Agent", "Thrustline/1.0");
httpClient.Timeout = TimeSpan.FromSeconds(10);

app.MapGet("/weather/metar/{icao}", async (string icao) =>
{
    icao = icao.Trim().ToUpperInvariant();
    if (icao.Length != 4 || !icao.All(char.IsAsciiLetter)) return Results.BadRequest(new { error = "Invalid ICAO" });
    try
    {
        var url = $"https://aviationweather.gov/api/data/metar?ids={icao}&format=raw&taf=false";
        var text = (await httpClient.GetStringAsync(url)).Trim();
        return string.IsNullOrEmpty(text) ? Results.NotFound() : Results.Ok(new { raw = text });
    }
    catch (Exception)
    {
        return Results.Problem("Weather service unavailable.", statusCode: 502);
    }
});

app.MapGet("/weather/taf/{icao}", async (string icao) =>
{
    icao = icao.Trim().ToUpperInvariant();
    if (icao.Length != 4 || !icao.All(char.IsAsciiLetter)) return Results.BadRequest(new { error = "Invalid ICAO" });
    try
    {
        var url = $"https://aviationweather.gov/api/data/taf?ids={icao}&format=raw";
        var text = (await httpClient.GetStringAsync(url)).Trim();
        return string.IsNullOrEmpty(text) ? Results.NotFound() : Results.Ok(new { raw = text });
    }
    catch (Exception)
    {
        return Results.Problem("Weather service unavailable.", statusCode: 502);
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

public record SessionPayload(string AccessToken, string SupabaseUrl, string AnonKey);
public record FlightContextPayload(Guid DispatchId, Guid CompanyId, int EconomyPassengers, int BusinessPassengers);
