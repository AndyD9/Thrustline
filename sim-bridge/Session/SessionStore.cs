namespace Thrustline.Bridge.Session;

public sealed record AuthenticatedSession(Guid UserId, string AccessToken, Uri SupabaseUrl);
public sealed record ActiveFlightContext(Guid DispatchId, Guid CompanyId, int EconomyPassengers, int BusinessPassengers);

public interface ISessionStore
{
    AuthenticatedSession? Current { get; }
    ActiveFlightContext? FlightContext { get; }
    Guid? CurrentUserId => Current?.UserId;
    bool HasSession => Current is not null;
    void Set(AuthenticatedSession session);
    void SetFlightContext(ActiveFlightContext context);
    void Clear();
    event EventHandler<Guid?>? UserChanged;
}

public sealed class SessionStore(ILogger<SessionStore> log) : ISessionStore
{
    private readonly object _gate = new();
    private AuthenticatedSession? _current;
    private ActiveFlightContext? _flightContext;
    public AuthenticatedSession? Current { get { lock (_gate) return _current; } }
    public ActiveFlightContext? FlightContext { get { lock (_gate) return _flightContext; } }
    public event EventHandler<Guid?>? UserChanged;

    public void Set(AuthenticatedSession session)
    {
        lock (_gate) _current = session;
        log.LogInformation("Authenticated backend session established for {UserId}", session.UserId);
        UserChanged?.Invoke(this, session.UserId);
    }

    public void SetFlightContext(ActiveFlightContext context)
    {
        lock (_gate) _flightContext = context;
        log.LogInformation("Active flight context set for dispatch {DispatchId}", context.DispatchId);
    }

    public void Clear()
    {
        lock (_gate) { _current = null; _flightContext = null; }
        log.LogInformation("Backend session cleared");
        UserChanged?.Invoke(this, null);
    }
}
