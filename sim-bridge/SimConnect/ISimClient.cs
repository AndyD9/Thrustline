namespace Thrustline.Bridge.SimConnect;

/// <summary>
/// Abstraction au-dessus du SDK SimConnect Windows.
/// Permet d'avoir une implémentation Mock (cross-platform, CI, dev macOS)
/// et une implémentation native (Windows + MSFS 2024).
/// </summary>
public interface ISimClient : IAsyncDisposable
{
    /// <summary>Connecté au sim ? (false = en attente de MSFS ou mode mock)</summary>
    bool IsConnected { get; }

    /// <summary>Dernier snapshot reçu, ou null si rien encore.</summary>
    SimData? Latest { get; }

    /// <summary>Événement émis à chaque nouveau snapshot (1 Hz par défaut).</summary>
    event EventHandler<SimData>? DataReceived;

    /// <summary>Changement de statut connexion sim.</summary>
    event EventHandler<bool>? ConnectionChanged;

    /// <summary>Démarre le polling / l'écoute SimConnect.</summary>
    Task StartAsync(CancellationToken ct);

    /// <summary>Arrête proprement.</summary>
    Task StopAsync(CancellationToken ct);
}
