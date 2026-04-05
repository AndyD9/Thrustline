namespace Thrustline.Bridge.Session;

/// <summary>
/// Stocke en mémoire l'utilisateur actuellement connecté côté front.
///
/// Flow :
///   1. React s'authentifie avec Supabase
///   2. React appelle POST /session {userId} sur sim-bridge au démarrage + à chaque changement
///   3. sim-bridge retient ce userId et l'utilise pour écrire les flights/transactions
///
/// Remarque sécurité : dans cette v1, sim-bridge fait confiance au userId envoyé
/// (localhost only). À terme on pourra valider un JWT Supabase à la place pour durcir.
/// </summary>
public interface ISessionStore
{
    Guid? CurrentUserId { get; }
    bool HasSession => CurrentUserId is not null;

    void SetUser(Guid userId);
    void Clear();

    event EventHandler<Guid?>? UserChanged;
}

public class SessionStore : ISessionStore
{
    private readonly ILogger<SessionStore> _log;
    private Guid? _userId;

    public Guid? CurrentUserId => _userId;

    public event EventHandler<Guid?>? UserChanged;

    public SessionStore(ILogger<SessionStore> log) => _log = log;

    public void SetUser(Guid userId)
    {
        if (_userId == userId) return;
        _userId = userId;
        _log.LogInformation("Session user set → {UserId}", userId);
        UserChanged?.Invoke(this, userId);
    }

    public void Clear()
    {
        if (_userId is null) return;
        _log.LogInformation("Session cleared.");
        _userId = null;
        UserChanged?.Invoke(this, null);
    }
}
