// NativeSimConnectClient.cs
// Implémentation de ISimClient via SimConnect.NET (NuGet).
//
// Fonctionne UNIQUEMENT sous Windows avec SimConnect.dll disponible
// (installé avec MSFS 2024, ou copié manuellement).
//
// Architecture :
//   - Thread dédié avec message pump Win32 (requis par SimConnect)
//   - Subscriptions individuelles par SimVar (pas de struct)
//   - Auto-reconnect avec boucle de retry manuelle
//   - Émet DataReceived à chaque snapshot, ConnectionChanged sur open/quit

using System.Runtime.InteropServices;
using SimConnect.NET;
using SimConnect.NET.Events;
using SimConnect.NET.SimVar;

namespace Thrustline.Bridge.SimConnect;

public class NativeSimConnectClient : ISimClient
{
    private const int WM_USER_SIMCONNECT = 0x0402;

    private readonly ILogger<NativeSimConnectClient> _log;
    private readonly SimBridgeOptions _options;
    private CancellationTokenSource? _cts;
    private Thread? _thread;

    public bool IsConnected { get; private set; }
    public string? LastError { get; private set; }
    public SimData? Latest { get; private set; }

    public event EventHandler<SimData>? DataReceived;
    public event EventHandler<bool>? ConnectionChanged;

    public NativeSimConnectClient(ILogger<NativeSimConnectClient> log, SimBridgeOptions options)
    {
        _log = log;
        _options = options;
    }

    public Task StartAsync(CancellationToken ct)
    {
        _cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
        _thread = new Thread(RunMessagePump)
        {
            Name = "SimConnect-MessagePump",
            IsBackground = true
        };
        _thread.Start();
        return Task.CompletedTask;
    }

    public Task StopAsync(CancellationToken ct)
    {
        _cts?.Cancel();
        return Task.CompletedTask;
    }

    public async ValueTask DisposeAsync()
    {
        await StopAsync(CancellationToken.None);
        _cts?.Dispose();
    }

    /// <summary>
    /// Thread dédié : crée une fenêtre Win32 invisible, connecte SimConnect.NET,
    /// souscrit aux SimVars à 1 Hz, puis pompe les messages.
    /// </summary>
    private void RunMessagePump()
    {
        _log.LogInformation("NativeSimConnectClient message pump thread started.");

        while (_cts is { IsCancellationRequested: false })
        {
            SimConnectClient? client = null;
            IntPtr hWnd = IntPtr.Zero;
            var subs = new List<ISimVarSubscription>();
            System.Threading.Timer? titleTimer = null;

            try
            {
                // Fenêtre invisible pour le message pump
                hWnd = CreateHiddenWindow();
                if (hWnd == IntPtr.Zero)
                {
                    LastError = "Failed to create hidden window for SimConnect message pump.";
                    _log.LogError(LastError);
                    Thread.Sleep(5000);
                    continue;
                }

                client = new SimConnectClient("Thrustline.Bridge");
                client.AutoReconnectEnabled = false; // On gère nous-mêmes la boucle de retry

                client.ConnectionStatusChanged += (_, args) =>
                {
                    if (args.IsDisconnected)
                    {
                        _log.LogWarning("SimConnect disconnected.");
                        SetConnected(false);
                    }
                };

                client.ErrorOccurred += (_, args) =>
                {
                    _log.LogDebug("SimConnect error: {Error} ctx={Ctx}", args.Error, args.Context);
                };

                // Connexion (bloquant si MSFS pas lancé → exception)
                client.ConnectAsync(hWnd, WM_USER_SIMCONNECT, 0, _cts.Token)
                    .GetAwaiter().GetResult();

                SetConnected(true);
                LastError = null;
                _log.LogInformation("SimConnect connected to MSFS.");

                // ── Subscriptions individuelles par SimVar à 1 Hz ────────────
                // On accumule les valeurs et émet un snapshot complet à chaque
                // mise à jour de latitude (qui arrive en premier à chaque tick).

                double latitude = 0, longitude = 0, altitude = 0;
                double groundSpeed = 0, ias = 0, heading = 0;
                double vs = 0, fuel = 0, onGround = 0;
                double flaps = 0, gear = 0, parkBrake = 0, spoilers = 0, groundTrack = 0;
                double simDisabled = 1; // 1 = menus, 0 = in-flight
                string? title = null;

                void EmitSnapshot()
                {
                    var simData = new SimData
                    {
                        Latitude = latitude,
                        Longitude = longitude,
                        AltitudeFt = altitude,
                        GroundSpeedKts = groundSpeed,
                        IndicatedAirspeedKts = ias,
                        HeadingDeg = heading,
                        VerticalSpeedFpm = vs,
                        FuelTotalGal = fuel,
                        OnGround = onGround != 0,
                        AircraftTitle = title,
                        FlapsAnglePct = flaps,
                        GearPosition = gear,
                        ParkingBrake = parkBrake != 0,
                        SpoilersPct = spoilers,
                        GroundTrackDeg = groundTrack,
                    };
                    Latest = simData;
                    DataReceived?.Invoke(this, simData);
                }

                // Numeric SimVars — each subscription updates its field and the
                // last one (SIM ON GROUND) emits the full snapshot.
                subs.Add(client.SimVars.Subscribe<double>("PLANE LATITUDE", "degrees", SimConnectPeriod.Second, v => latitude = v));
                subs.Add(client.SimVars.Subscribe<double>("PLANE LONGITUDE", "degrees", SimConnectPeriod.Second, v => longitude = v));
                subs.Add(client.SimVars.Subscribe<double>("PLANE ALTITUDE", "feet", SimConnectPeriod.Second, v => altitude = v));
                subs.Add(client.SimVars.Subscribe<double>("GROUND VELOCITY", "knots", SimConnectPeriod.Second, v => groundSpeed = v));
                subs.Add(client.SimVars.Subscribe<double>("AIRSPEED INDICATED", "knots", SimConnectPeriod.Second, v => ias = v));
                subs.Add(client.SimVars.Subscribe<double>("PLANE HEADING DEGREES TRUE", "degrees", SimConnectPeriod.Second, v => heading = v));
                subs.Add(client.SimVars.Subscribe<double>("VERTICAL SPEED", "feet per minute", SimConnectPeriod.Second, v => vs = v));
                subs.Add(client.SimVars.Subscribe<double>("FUEL TOTAL QUANTITY", "gallons", SimConnectPeriod.Second, v => fuel = v));
                subs.Add(client.SimVars.Subscribe<double>("SIM ON GROUND", "bool", SimConnectPeriod.Second, v => onGround = v));
                subs.Add(client.SimVars.Subscribe<double>("FLAPS HANDLE PERCENT", "percent", SimConnectPeriod.Second, v => flaps = v));
                subs.Add(client.SimVars.Subscribe<double>("GEAR TOTAL PCT EXTENDED", "percent", SimConnectPeriod.Second, v => gear = v));
                subs.Add(client.SimVars.Subscribe<double>("BRAKE PARKING INDICATOR", "bool", SimConnectPeriod.Second, v => parkBrake = v));
                subs.Add(client.SimVars.Subscribe<double>("SPOILERS HANDLE POSITION", "percent", SimConnectPeriod.Second, v => spoilers = v));
                subs.Add(client.SimVars.Subscribe<double>("GPS GROUND TRUE TRACK", "degrees", SimConnectPeriod.Second, v => groundTrack = v));
                subs.Add(client.SimVars.Subscribe<double>("SIM DISABLED", "bool", SimConnectPeriod.Second, v =>
                {
                    simDisabled = v;
                    if (simDisabled == 0) EmitSnapshot(); // only emit when actually in a flight
                }));

                // Aircraft title — poll every 5 seconds (doesn't change often)
                // Note: TITLE is a string SimVar that doesn't accept a unit parameter
                // via Subscribe<string>, so we poll it with GetAsync instead.
                titleTimer = new System.Threading.Timer(async _ =>
                {
                    try
                    {
                        title = (await client.SimVars.GetAsync<string>("TITLE", "string"))?.Trim('\0');
                    }
                    catch { /* ignore — title stays at last known value */ }
                }, null, 0, 5000);

                _log.LogInformation("Subscribed to {Count} SimVars.", subs.Count);

                // Message pump : traite les messages Win32 de SimConnect
                while (_cts is { IsCancellationRequested: false } && IsConnected)
                {
                    try
                    {
                        client.ProcessNextMessageAsync(_cts.Token)
                            .GetAwaiter().GetResult();
                    }
                    catch (OperationCanceledException)
                    {
                        break;
                    }

                    Thread.Sleep(_options.PollingIntervalMs);
                }
            }
            catch (OperationCanceledException)
            {
                break;
            }
            catch (Exception ex) when (ex is COMException or DllNotFoundException or BadImageFormatException)
            {
                LastError = $"SimConnect connection failed: {ex.Message}";
                _log.LogWarning("SimConnect connection failed (MSFS not running?): {Msg}", ex.Message);
            }
            catch (SimConnectException ex)
            {
                LastError = $"SimConnect error: {ex.Message}";
                _log.LogWarning("SimConnect error: {Msg}", ex.Message);
            }
            catch (Exception ex)
            {
                LastError = ex.Message;
                _log.LogError(ex, "SimConnect unexpected error.");
            }
            finally
            {
                titleTimer?.Dispose();
                foreach (var sub in subs) sub.Dispose();
                subs.Clear();
                SetConnected(false);

                if (client is not null)
                {
                    try { client.DisconnectAsync().GetAwaiter().GetResult(); }
                    catch { /* best effort */ }
                    try { client.Dispose(); }
                    catch { /* best effort */ }
                }

                if (hWnd != IntPtr.Zero)
                {
                    DestroyWindow(hWnd);
                }
            }

            if (_cts is { IsCancellationRequested: false })
            {
                _log.LogInformation("Retrying SimConnect in 5 seconds...");
                Thread.Sleep(5000);
            }
        }

        _log.LogInformation("NativeSimConnectClient message pump thread exiting.");
    }

    private void SetConnected(bool value)
    {
        if (IsConnected == value) return;
        IsConnected = value;
        ConnectionChanged?.Invoke(this, value);
    }

    // ---- Win32 interop pour la fenêtre cachée ----

    [DllImport("user32.dll", SetLastError = true)]
    private static extern IntPtr CreateWindowEx(
        uint dwExStyle, string lpClassName, string lpWindowName,
        uint dwStyle, int x, int y, int nWidth, int nHeight,
        IntPtr hWndParent, IntPtr hMenu, IntPtr hInstance, IntPtr lpParam);

    [DllImport("user32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool DestroyWindow(IntPtr hWnd);

    private static IntPtr CreateHiddenWindow()
    {
        const uint WS_OVERLAPPED = 0x00000000;
        var hWnd = CreateWindowEx(0, "STATIC", "ThrustlineSimConnect",
            WS_OVERLAPPED, 0, 0, 0, 0,
            new IntPtr(-3) /* HWND_MESSAGE */, IntPtr.Zero, IntPtr.Zero, IntPtr.Zero);
        return hWnd;
    }
}
