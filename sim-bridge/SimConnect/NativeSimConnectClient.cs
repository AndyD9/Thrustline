// NativeSimConnectClient.cs
// Implémentation de ISimClient via SimConnect.NET (NuGet).
//
// Fonctionne UNIQUEMENT sous Windows avec SimConnect.dll disponible
// (installé avec MSFS 2024, ou copié manuellement).
//
// Architecture :
//   - Thread dédié avec message pump Win32 (requis par SimConnect)
//   - Struct décoré [SimConnect] pour les SimVars
//   - Subscription à 1 Hz via SimVarManager
//   - Auto-reconnect géré par SimConnect.NET
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

    // Struct miroir des SimVars — décoré avec [SimConnect] pour SimConnect.NET
    [StructLayout(LayoutKind.Sequential)]
    private struct SimVarsStruct
    {
        [SimConnect("PLANE LATITUDE", "degrees")]
        public double Latitude;

        [SimConnect("PLANE LONGITUDE", "degrees")]
        public double Longitude;

        [SimConnect("PLANE ALTITUDE", "feet")]
        public double AltitudeFt;

        [SimConnect("GROUND VELOCITY", "knots")]
        public double GroundSpeedKts;

        [SimConnect("AIRSPEED INDICATED", "knots")]
        public double IndicatedAirspeedKts;

        [SimConnect("PLANE HEADING DEGREES TRUE", "degrees")]
        public double HeadingDeg;

        [SimConnect("VERTICAL SPEED", "feet per minute")]
        public double VerticalSpeedFpm;

        [SimConnect("FUEL TOTAL QUANTITY", "gallons")]
        public double FuelTotalGal;

        [SimConnect("SIM ON GROUND")]
        public double OnGround; // 0 ou 1

        [SimConnect("TITLE", SimConnectDataType.String256)]
        public string AircraftTitle;
    }

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
            ISimVarSubscription? subscription = null;

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
                    _log.LogWarning("SimConnect error: {Error}", args);
                };

                // Connexion (bloquant si MSFS pas lancé → exception)
                client.ConnectAsync(hWnd, WM_USER_SIMCONNECT, 0, _cts.Token)
                    .GetAwaiter().GetResult();

                SetConnected(true);
                LastError = null;
                _log.LogInformation("SimConnect connected to MSFS.");

                // Subscription aux SimVars à 1 Hz
                subscription = client.SimVars.Subscribe<SimVarsStruct>(
                    SimConnectPeriod.Second,
                    raw =>
                    {
                        var simData = new SimData
                        {
                            Latitude = raw.Latitude,
                            Longitude = raw.Longitude,
                            AltitudeFt = raw.AltitudeFt,
                            GroundSpeedKts = raw.GroundSpeedKts,
                            IndicatedAirspeedKts = raw.IndicatedAirspeedKts,
                            HeadingDeg = raw.HeadingDeg,
                            VerticalSpeedFpm = raw.VerticalSpeedFpm,
                            FuelTotalGal = raw.FuelTotalGal,
                            OnGround = raw.OnGround != 0,
                            AircraftTitle = raw.AircraftTitle?.Trim('\0'),
                        };

                        Latest = simData;
                        DataReceived?.Invoke(this, simData);
                    });

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
                subscription?.Dispose();
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
