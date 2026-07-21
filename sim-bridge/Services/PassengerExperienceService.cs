using Microsoft.AspNetCore.SignalR;
using Thrustline.Bridge.SimConnect;

namespace Thrustline.Bridge.Services;

public record PassengerCohortSnapshot(string CabinClass, int PassengerCount, double Satisfaction,
    double Comfort, double Stress, double Nausea, double Entertainment);

public record PassengerExperienceSnapshot(DateTimeOffset Timestamp, bool IsActive, double Satisfaction,
    double Comfort, double Stress, double Nausea, double Entertainment, string CurrentEvent, string Trend,
    int AffectedPassengers, int AbruptManeuvers, double TurbulenceSeconds, string BestMoment, string WorstMoment,
    PassengerCohortSnapshot Economy, PassengerCohortSnapshot Business);

/// <summary>Frame-rate independent passenger simulation driven by aircraft motion.</summary>
public class PassengerExperienceService
{
    private readonly object _gate = new();
    private readonly IHubContext<SimHub> _hub;
    private DateTimeOffset? _lastTick;
    private DateTimeOffset _lastBroadcast;
    private double _smoothedMotion;
    private double _previousSatisfaction = 85;
    private double _economyComfort = 86, _economyStress = 10, _economyNausea, _economyEntertainment = 82;
    private double _businessComfort = 92, _businessStress = 7, _businessNausea, _businessEntertainment = 92;
    private int _economyCount, _businessCount, _abruptManeuvers;
    private double _turbulenceSeconds;
    private string _currentEvent = "Cabin ready", _bestMoment = "Cabin ready", _worstMoment = "None";
    private double _bestScore = double.MinValue, _worstScore = double.MaxValue;
    private bool _active, _wasAbrupt;

    public PassengerExperienceSnapshot? Latest { get; private set; }
    public PassengerExperienceSnapshot? Completed { get; private set; }

    public PassengerExperienceService(IHubContext<SimHub> hub) => _hub = hub;

    public void PrepareFlight(DateTimeOffset timestamp)
    {
        lock (_gate)
        {
            _active = false;
            _lastTick = timestamp;
            Latest = null;
            Completed = null;
        }
    }

    public void StartFlight(int economyCount, int businessCount, DateTimeOffset timestamp)
    {
        lock (_gate)
        {
            _economyCount = Math.Max(0, economyCount); _businessCount = Math.Max(0, businessCount);
            _economyComfort = 86; _economyStress = 10; _economyNausea = 0; _economyEntertainment = 82;
            _businessComfort = 92; _businessStress = 7; _businessNausea = 0; _businessEntertainment = 92;
            _smoothedMotion = 0; _abruptManeuvers = 0; _turbulenceSeconds = 0; _wasAbrupt = false;
            _currentEvent = "Takeoff"; _bestMoment = "Takeoff"; _worstMoment = "None";
            _bestScore = double.MinValue; _worstScore = double.MaxValue;
            _lastTick = timestamp; _lastBroadcast = DateTimeOffset.MinValue;
            _previousSatisfaction = 85; _active = true; Completed = null;
            Latest = BuildSnapshot(timestamp, true);
        }
        Broadcast(Latest!);
    }

    public void Ingest(SimData data)
    {
        PassengerExperienceSnapshot? snapshot = null;
        lock (_gate)
        {
            if (!_active || _lastTick is null || !data.IsSimActive) return;
            var dt = Math.Clamp((data.Timestamp - _lastTick.Value).TotalSeconds, 0, 0.5);
            _lastTick = data.Timestamp;
            if (dt <= 0) return;
            var rotation = Math.Sqrt(data.RotationVelocityBodyX * data.RotationVelocityBodyX +
                data.RotationVelocityBodyY * data.RotationVelocityBodyY + data.RotationVelocityBodyZ * data.RotationVelocityBodyZ);
            var lateralG = Math.Sqrt(data.AccelerationBodyX * data.AccelerationBodyX +
                data.AccelerationBodyY * data.AccelerationBodyY) / 32.174;
            var rawMotion = Math.Clamp(Math.Abs(data.GForce - 1) * 2.2 + lateralG * 1.4 + rotation * 1.8, 0, 2);
            _smoothedMotion += (rawMotion - _smoothedMotion) * Math.Min(1, dt * 2.5);

            var turbulent = _smoothedMotion >= 0.35;
            var abrupt = _smoothedMotion >= 0.95;
            if (turbulent) _turbulenceSeconds += dt;
            if (abrupt && !_wasAbrupt) _abruptManeuvers++;
            _wasAbrupt = abrupt;
            _currentEvent = abrupt ? "Abrupt maneuver" : _smoothedMotion >= 0.75 ? "Severe turbulence" :
                turbulent ? "Light turbulence" : "Smooth flight";

            UpdateCohort(ref _economyComfort, ref _economyStress, ref _economyNausea, ref _economyEntertainment,
                dt, _smoothedMotion, 1.10, data.SeatbeltsOn);
            UpdateCohort(ref _businessComfort, ref _businessStress, ref _businessNausea, ref _businessEntertainment,
                dt, _smoothedMotion, 0.85, data.SeatbeltsOn);
            Latest = BuildSnapshot(data.Timestamp, true);
            if (Latest.Satisfaction > _bestScore) { _bestScore = Latest.Satisfaction; _bestMoment = _currentEvent; }
            if (Latest.Satisfaction < _worstScore) { _worstScore = Latest.Satisfaction; _worstMoment = _currentEvent; }
            if (data.Timestamp - _lastBroadcast >= TimeSpan.FromMilliseconds(500))
            { _lastBroadcast = data.Timestamp; snapshot = Latest; }
        }
        if (snapshot is not null) Broadcast(snapshot);
    }

    public PassengerExperienceSnapshot? CompleteFlight(double landingVsFpm, DateTimeOffset timestamp)
    {
        PassengerExperienceSnapshot? snapshot;
        lock (_gate)
        {
            if (!_active) return Completed;
            var penalty = Math.Clamp((Math.Abs(landingVsFpm) - 150) / 25, 0, 30);
            _economyComfort = Clamp(_economyComfort - penalty); _businessComfort = Clamp(_businessComfort - penalty * 0.9);
            _economyStress = Clamp(_economyStress + penalty * 0.65); _businessStress = Clamp(_businessStress + penalty * 0.55);
            _currentEvent = penalty > 12 ? "Hard landing" : penalty > 3 ? "Firm landing" : "Smooth landing";
            snapshot = BuildSnapshot(timestamp, false);
            if (snapshot.Satisfaction < _worstScore) _worstMoment = _currentEvent;
            if (snapshot.Satisfaction > _bestScore) _bestMoment = _currentEvent;
            _active = false; snapshot = BuildSnapshot(timestamp, false); Completed = snapshot; Latest = snapshot;
        }
        Broadcast(snapshot);
        return snapshot;
    }

    private void Broadcast(PassengerExperienceSnapshot snapshot) =>
        _ = _hub.Clients.All.SendAsync("passengerExperience", snapshot);

    private static void UpdateCohort(ref double comfort, ref double stress, ref double nausea, ref double entertainment,
        double dt, double motion, double sensitivity, bool seatbeltsOn)
    {
        var disturbance = Math.Max(0, motion - 0.18) * sensitivity;
        comfort = Clamp(comfort + (disturbance > 0 ? -disturbance * 5.2 : 0.20) * dt);
        stress = Clamp(stress + (disturbance > 0 ? disturbance * (seatbeltsOn ? 3.2 : 4.4) : -0.32) * dt);
        nausea = Clamp(nausea + (disturbance > 0 ? disturbance * 2.2 : -0.12) * dt);
        entertainment = Clamp(entertainment - (0.025 + disturbance * 0.08) * dt);
    }

    private PassengerExperienceSnapshot BuildSnapshot(DateTimeOffset timestamp, bool active)
    {
        var economy = BuildCohort("economy", _economyCount, _economyComfort, _economyStress, _economyNausea, _economyEntertainment);
        var business = BuildCohort("business", _businessCount, _businessComfort, _businessStress, _businessNausea, _businessEntertainment);
        var total = _economyCount + _businessCount;
        double Weighted(Func<PassengerCohortSnapshot, double> selector) => total == 0
            ? (selector(economy) + selector(business)) / 2
            : (selector(economy) * _economyCount + selector(business) * _businessCount) / total;
        var satisfaction = Weighted(c => c.Satisfaction);
        var trend = satisfaction > _previousSatisfaction + 0.15 ? "up" : satisfaction < _previousSatisfaction - 0.15 ? "down" : "stable";
        _previousSatisfaction = satisfaction;
        var affected = (int)Math.Round(total * Math.Clamp((_smoothedMotion - 0.15) / 0.85, 0, 1));
        return new(timestamp, active, Round(satisfaction), Round(Weighted(c => c.Comfort)), Round(Weighted(c => c.Stress)),
            Round(Weighted(c => c.Nausea)), Round(Weighted(c => c.Entertainment)), _currentEvent, trend, affected,
            _abruptManeuvers, Round(_turbulenceSeconds), _bestMoment, _worstMoment, economy, business);
    }

    private static PassengerCohortSnapshot BuildCohort(string cabinClass, int count, double comfort, double stress,
        double nausea, double entertainment)
    {
        var satisfaction = comfort * 0.45 + (100 - stress) * 0.25 + entertainment * 0.15 + (100 - nausea) * 0.15;
        return new(cabinClass, count, Round(satisfaction), Round(comfort), Round(stress), Round(nausea), Round(entertainment));
    }

    private static double Clamp(double value) => Math.Clamp(value, 0, 100);
    private static double Round(double value) => Math.Round(value, 1);
}
