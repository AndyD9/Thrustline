using Microsoft.AspNetCore.SignalR;

namespace Thrustline.Bridge.SimConnect;

/// <summary>
/// HostedService qui :
///   1. démarre le ISimClient (mock ou natif) au boot
///   2. route chaque SimData vers FlightDetector (takeoff/landing)
///   3. broadcast chaque SimData sur le SignalR hub /hubs/sim vers la UI
///   4. arrête proprement à la fermeture
/// </summary>
public class SimConnectWorker : BackgroundService
{
    private readonly ISimClient _client;
    private readonly FlightDetector _detector;
    private readonly IHubContext<SimHub> _hub;
    private readonly ILogger<SimConnectWorker> _log;

    public SimConnectWorker(
        ISimClient client,
        FlightDetector detector,
        IHubContext<SimHub> hub,
        ILogger<SimConnectWorker> log)
    {
        _client = client;
        _detector = detector;
        _hub = hub;
        _log = log;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _client.DataReceived += OnData;
        _client.ConnectionChanged += OnConnectionChanged;
        _detector.Takeoff += (_, data) =>
            _ = _hub.Clients.All.SendAsync("takeoff", data, stoppingToken);
        _detector.Landing += (_, evt) =>
            _ = _hub.Clients.All.SendAsync("landing", evt, stoppingToken);

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
        _ = _hub.Clients.All.SendAsync("simData", data);
    }

    private void OnConnectionChanged(object? sender, bool connected)
    {
        _log.LogInformation("Sim connection → {State}", connected ? "connected" : "disconnected");
        _ = _hub.Clients.All.SendAsync("connectionChanged", connected);
    }
}
