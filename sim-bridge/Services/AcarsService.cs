using Microsoft.AspNetCore.SignalR;
using Thrustline.Bridge.SimConnect;

namespace Thrustline.Bridge.Services;

/// <summary>Keeps ACARS telemetry local; persistence is finalized by the server flight operation.</summary>
public sealed class AcarsService(IHubContext<SimHub> hub)
{
    private string _phase = "preflight";
    private DateTimeOffset _lastReport = DateTimeOffset.MinValue;
    public string CurrentPhase => _phase;

    public void StartFlight(Guid dispatchId, Guid companyId) => SetPhase("takeoff");
    public void EndFlight() => SetPhase("taxi_in");

    public void Ingest(SimData data)
    {
        var phase = data.OnGround
            ? (data.GroundSpeedKts > 3 ? "taxi" : "preflight")
            : data.VerticalSpeedFpm > 500 ? "climb"
            : data.VerticalSpeedFpm < -500 ? "descent"
            : data.AltitudeFt < 3000 ? "approach"
            : "cruise";
        SetPhase(phase);

        if (data.Timestamp - _lastReport < TimeSpan.FromSeconds(30)) return;
        _lastReport = data.Timestamp;
        _ = hub.Clients.All.SendAsync("acarsUpdate", new
        {
            phase = _phase,
            data.Latitude,
            data.Longitude,
            data.AltitudeFt,
            data.GroundSpeedKts,
            data.HeadingDeg,
            fuelGal = data.FuelTotalGal,
            message = _phase.ToUpperInvariant(),
            timestamp = data.Timestamp,
        });
    }

    private void SetPhase(string phase)
    {
        if (_phase == phase) return;
        _phase = phase;
        _ = hub.Clients.All.SendAsync("phaseChange", phase);
    }
}
