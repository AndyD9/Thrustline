using Microsoft.AspNetCore.SignalR;
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
    private readonly PassengerExperienceService _passengers;
    private readonly IHubContext<SimHub> _hub;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ISessionStore _session;
    private readonly ILogger<SimConnectWorker> _log;

    public SimConnectWorker(
        ISimClient client,
        FlightDetector detector,
        AcarsService acars,
        PassengerExperienceService passengers,
        IHubContext<SimHub> hub,
        IServiceScopeFactory scopeFactory,
        ISessionStore session,
        ILogger<SimConnectWorker> log)
    {
        _client = client;
        _detector = detector;
        _acars = acars;
        _passengers = passengers;
        _hub = hub;
        _scopeFactory = scopeFactory;
        _session = session;
        _log = log;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _client.DataReceived += OnData;
        _client.ConnectionChanged += OnConnectionChanged;

        _detector.Takeoff += (_, data) =>
        {
            _passengers.PrepareFlight(data.Timestamp);
            _ = _hub.Clients.All.SendAsync("takeoff", data, stoppingToken);

            var context = _session.FlightContext;
            if (context is not null)
            {
                _acars.StartFlight(context.DispatchId, context.CompanyId);
                _passengers.StartFlight(context.EconomyPassengers, context.BusinessPassengers, data.Timestamp);
            }
        };

        _detector.Landing += async (_, evt) =>
        {
            var passengerExperience = _passengers.CompleteFlight(evt.LandingVsFpm, evt.Touchdown.Timestamp);
            // Broadcast UI d'abord (instant feedback)
            await _hub.Clients.All.SendAsync("landing", new
            {
                evt.Takeoff,
                evt.Touchdown,
                evt.DistanceNm,
                evt.FuelUsedGal,
                evt.DurationMin,
                evt.LandingVsFpm,
                PassengerExperience = passengerExperience,
            }, stoppingToken);

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
        if (data.IsSimActive)
        {
            _acars.Ingest(data);
            _passengers.Ingest(data);
        }
        _ = _hub.Clients.All.SendAsync("simData", data);
    }

    private void OnConnectionChanged(object? sender, bool connected)
    {
        _log.LogInformation("Sim connection → {State}", connected ? "connected" : "disconnected");
        _ = _hub.Clients.All.SendAsync("connectionChanged", connected);
    }
}
