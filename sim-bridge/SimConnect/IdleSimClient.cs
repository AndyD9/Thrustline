namespace Thrustline.Bridge.SimConnect;

/// <summary>
/// No-op ISimClient used when SimConnect SDK is not available (macOS, Linux, CI).
/// Stays idle — never connects, never emits data.
/// </summary>
public class IdleSimClient : ISimClient
{
    private readonly ILogger<IdleSimClient> _log;

    public bool IsConnected => false;
    public SimData? Latest => null;

#pragma warning disable CS0067 // Events are required by ISimClient but never raised in idle mode
    public event EventHandler<SimData>? DataReceived;
    public event EventHandler<bool>? ConnectionChanged;
#pragma warning restore CS0067

    public IdleSimClient(ILogger<IdleSimClient> log) => _log = log;

    public Task StartAsync(CancellationToken ct)
    {
        _log.LogInformation("IdleSimClient: no SimConnect available on this platform. Standing by.");
        return Task.CompletedTask;
    }

    public Task StopAsync(CancellationToken ct) => Task.CompletedTask;

    public ValueTask DisposeAsync() => ValueTask.CompletedTask;
}
