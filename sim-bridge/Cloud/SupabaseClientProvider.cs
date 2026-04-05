using Supabase;

namespace Thrustline.Bridge.Cloud;

/// <summary>
/// Singleton qui init le client supabase-csharp une fois au boot et l'expose aux services.
/// Utilise la service_role key : les écritures contournent RLS (sim-bridge écrit pour le
/// compte de n'importe quel utilisateur qui a ouvert une session).
/// </summary>
public interface ISupabaseClientProvider
{
    bool IsConfigured { get; }
    Client Client { get; }
    Task EnsureInitializedAsync(CancellationToken ct = default);
}

public class SupabaseClientProvider : ISupabaseClientProvider
{
    private readonly SupabaseOptions _options;
    private readonly ILogger<SupabaseClientProvider> _log;
    private readonly SemaphoreSlim _initLock = new(1, 1);
    private Client? _client;
    private bool _initialized;

    public SupabaseClientProvider(SupabaseOptions options, ILogger<SupabaseClientProvider> log)
    {
        _options = options;
        _log = log;
    }

    public bool IsConfigured => !string.IsNullOrEmpty(_options.Url) && !string.IsNullOrEmpty(_options.ServiceRoleKey);

    public Client Client
    {
        get
        {
            if (_client is null)
                throw new InvalidOperationException(
                    "Supabase client not initialized. Call EnsureInitializedAsync() first " +
                    "or check ISupabaseClientProvider.IsConfigured.");
            return _client;
        }
    }

    public async Task EnsureInitializedAsync(CancellationToken ct = default)
    {
        if (_initialized) return;

        await _initLock.WaitAsync(ct);
        try
        {
            if (_initialized) return;
            if (!IsConfigured)
            {
                _log.LogWarning("Supabase not configured (missing Url or ServiceRoleKey). " +
                                "Landing writes will be skipped.");
                return;
            }

            _log.LogInformation("Initializing Supabase client → {Url}", _options.Url);
            var clientOptions = new Supabase.SupabaseOptions
            {
                AutoConnectRealtime = false,
                AutoRefreshToken = false,
            };
            _client = new Client(_options.Url, _options.ServiceRoleKey, clientOptions);
            await _client.InitializeAsync();
            _initialized = true;
            _log.LogInformation("Supabase client ready.");
        }
        finally
        {
            _initLock.Release();
        }
    }
}
