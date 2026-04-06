using Microsoft.AspNetCore.SignalR;
using Thrustline.Bridge.Cloud;
using Thrustline.Bridge.Cloud.Models;
using Thrustline.Bridge.Services;
using Thrustline.Bridge.Session;

namespace Thrustline.Bridge.SimConnect;

/// <summary>
/// HostedService qui :
///   1. démarre le ISimClient (mock ou natif) au boot
///   2. route chaque SimData vers FlightDetector (takeoff/landing)
///   3. broadcast chaque SimData sur le SignalR hub /hubs/sim vers la UI
///   4. sur landing, déclenche LandingProcessor pour persister dans Supabase
///   5. arrête proprement à la fermeture
/// </summary>
public class SimConnectWorker : BackgroundService
{
    private readonly ISimClient _client;
    private readonly FlightDetector _detector;
    private readonly AcarsService _acars;
    private readonly IHubContext<SimHub> _hub;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<SimConnectWorker> _log;

    public SimConnectWorker(
        ISimClient client,
        FlightDetector detector,
        AcarsService acars,
        IHubContext<SimHub> hub,
        IServiceScopeFactory scopeFactory,
        ILogger<SimConnectWorker> log)
    {
        _client = client;
        _detector = detector;
        _acars = acars;
        _hub = hub;
        _scopeFactory = scopeFactory;
        _log = log;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _client.DataReceived += OnData;
        _client.ConnectionChanged += OnConnectionChanged;

        _detector.Takeoff += (_, data) =>
        {
            _ = _hub.Clients.All.SendAsync("takeoff", data, stoppingToken);

            // Start ACARS tracking for the active dispatch
            _ = Task.Run(async () =>
            {
                try
                {
                    using var scope = _scopeFactory.CreateScope();
                    var supabase = scope.ServiceProvider.GetRequiredService<ISupabaseClientProvider>();
                    var session = scope.ServiceProvider.GetRequiredService<ISessionStore>();
                    if (!supabase.IsConfigured || session.CurrentUserId is null) return;

                    await supabase.EnsureInitializedAsync(stoppingToken);
                    var client = supabase.Client;

                    var company = (await client.From<CompanyRow>()
                        .Where(c => c.UserId == session.CurrentUserId.Value)
                        .Single(stoppingToken));
                    if (company is null) return;

                    var dispatchResp = await client.From<DispatchRow>()
                        .Where(d => d.CompanyId == company.Id)
                        .Where(d => d.Status == DispatchRow.StatusFlying)
                        .Limit(1)
                        .Get(stoppingToken);
                    var dispatch = dispatchResp.Models.FirstOrDefault();
                    if (dispatch is null) return;

                    _acars.StartFlight(dispatch.Id, company.Id);
                }
                catch (Exception ex)
                {
                    _log.LogError(ex, "Failed to start ACARS on takeoff");
                }
            }, stoppingToken);
        };

        _detector.Landing += async (_, evt) =>
        {
            // Broadcast UI d'abord (instant feedback)
            await _hub.Clients.All.SendAsync("landing", evt, stoppingToken);

            // Puis pipeline métier + persistence Supabase (hors thread SimConnect)
            _ = Task.Run(async () =>
            {
                try
                {
                    var processor = _scopeFactory.CreateScope().ServiceProvider
                        .GetRequiredService<LandingProcessor>();
                    await processor.ProcessAsync(evt, stoppingToken);
                }
                catch (Exception ex)
                {
                    _log.LogError(ex, "LandingProcessor crashed.");
                }
            }, stoppingToken);
        };

        await _client.StartAsync(stoppingToken);
        _log.LogInformation("SimConnectWorker started ({Client})", _client.GetType().Name);

        try
        {
            await Task.Delay(Timeout.Infinite, stoppingToken);
        }
        catch (OperationCanceledException) { /* normal shutdown */ }
        finally
        {
            _client.DataReceived -= OnData;
            _client.ConnectionChanged -= OnConnectionChanged;
            await _client.StopAsync(CancellationToken.None);
        }
    }

    private void OnData(object? sender, SimData data)
    {
        _detector.Ingest(data);
        _acars.Ingest(data);
        _ = _hub.Clients.All.SendAsync("simData", data);
    }

    private void OnConnectionChanged(object? sender, bool connected)
    {
        _log.LogInformation("Sim connection → {State}", connected ? "connected" : "disconnected");
        _ = _hub.Clients.All.SendAsync("connectionChanged", connected);
    }
}
