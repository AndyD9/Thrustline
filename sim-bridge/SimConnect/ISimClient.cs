namespace Thrustline.Bridge.SimConnect;

/// <summary>
/// Abstraction au-dessus du SDK SimConnect Windows.
/// Implémentations : NativeSimConnectClient (Windows + MSFS 2024)
/// et IdleSimClient (no-op sur macOS/Linux/CI).
/// </summary>
public interface ISimClient : IAsyncDisposable
{
    /// <summary>Connecté au sim ? (false = en attente de MSFS)</summary>
    bool IsConnected { get; }

    /// <summary>Dernière erreur rencontrée, ou null si tout va bien.</summary>
    string? LastError { get; }

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
