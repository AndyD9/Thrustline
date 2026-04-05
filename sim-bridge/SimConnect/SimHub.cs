using Microsoft.AspNetCore.SignalR;

namespace Thrustline.Bridge.SimConnect;

/// <summary>
/// SignalR hub qui stream les SimVars et événements de vol vers la UI React.
/// Messages broadcastés par SimConnectWorker :
///   - "simData"            (SimData)
///   - "takeoff"            (SimData)
///   - "landing"            (LandingEvent)
///   - "connectionChanged"  (bool)
/// </summary>
public class SimHub : Hub
{
    /// <summary>
    /// Handshake : le client peut appeler hub.invoke("getLatest") au connect
    /// pour récupérer immédiatement le dernier snapshot sans attendre le prochain tick.
    /// </summary>
    public SimData? GetLatest(ISimClient sim) => sim.Latest;
}
