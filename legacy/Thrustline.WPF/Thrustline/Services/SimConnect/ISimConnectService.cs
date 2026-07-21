namespace Thrustline.Services.SimConnect;

public interface ISimConnectService
{
    event Action<SimData>? SimDataReceived;
    string Status { get; } // "connected" | "mock" | "disconnected"
    void Start();
    void Stop();
}
