// NativeSimConnectClient.cs
// Implémentation réelle de ISimClient via le SDK officiel SimConnect (MSFS 2024).
//
// Fonctionne UNIQUEMENT sous Windows avec la DLL SimConnect installée (via MSFS SDK).
// Ce fichier est compilé conditionnellement (voir csproj: Windows_NT uniquement).
//
// Architecture :
//   - Thread dédié avec message pump Win32 (SimConnect exige WndProc)
//   - Enregistre les SimVars nécessaires dans un struct
//   - Demande les données à 1 Hz (SIMCONNECT_PERIOD.SECOND)
//   - Retry connexion toutes les 5s si MSFS n'est pas lancé
//   - Émet DataReceived à chaque snapshot, ConnectionChanged sur open/quit

#if HAS_SIMCONNECT

using System.Runtime.InteropServices;
using Microsoft.FlightSimulator.SimConnect;

namespace Thrustline.Bridge.SimConnect;

public class NativeSimConnectClient : ISimClient
{
    private const int WM_USER_SIMCONNECT = 0x0402;

    private readonly ILogger<NativeSimConnectClient> _log;
    private readonly SimBridgeOptions _options;
    private CancellationTokenSource? _cts;
    private Thread? _thread;

    private Microsoft.FlightSimulator.SimConnect.SimConnect? _sc;
    private IntPtr _hWnd;

    public bool IsConnected { get; private set; }
    public SimData? Latest { get; private set; }

    public event EventHandler<SimData>? DataReceived;
    public event EventHandler<bool>? ConnectionChanged;

    // Enum IDs pour SimConnect
    private enum DataDefinitionId { SimVars }
    private enum RequestId { SimVarsRequest }

    // Struct miroir des SimVars demandées — l'ordre DOIT matcher les AddToDataDefinition
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi, Pack = 1)]
    private struct SimVarsStruct
    {
        public double Latitude;
        public double Longitude;
        public double AltitudeFt;
        public double GroundSpeedKts;
        public double IndicatedAirspeedKts;
        public double HeadingDeg;
        public double VerticalSpeedFpm;
        public double FuelTotalGal;
        public int OnGround; // SIMCONNECT bool = int (0 or 1)
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 256)]
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
        Disconnect();
        return Task.CompletedTask;
    }

    public async ValueTask DisposeAsync()
    {
        await StopAsync(CancellationToken.None);
        _cts?.Dispose();
    }

    /// <summary>
    /// Thread dédié : boucle infinie qui tente de se connecter à SimConnect,
    /// puis pompe les messages Win32 (GetMessage/DispatchMessage) tant que MSFS tourne.
    /// Si la connexion est perdue, attend 5s et retente.
    /// </summary>
    private void RunMessagePump()
    {
        _log.LogInformation("NativeSimConnectClient message pump thread started.");

        while (_cts is { IsCancellationRequested: false })
        {
            try
            {
                // Crée une fenêtre invisible pour le message pump
                _hWnd = CreateHiddenWindow();
                if (_hWnd == IntPtr.Zero)
                {
                    _log.LogError("Failed to create hidden window for SimConnect message pump.");
                    Thread.Sleep(5000);
                    continue;
                }

                // Tentative de connexion SimConnect
                _sc = new Microsoft.FlightSimulator.SimConnect.SimConnect(
                    "Thrustline.Bridge", _hWnd, WM_USER_SIMCONNECT, null, 0);

                RegisterDataDefinition();
                RegisterEventHandlers();

                SetConnected(true);
                _log.LogInformation("SimConnect connected to MSFS.");

                // Demande les données à 1 Hz
                _sc.RequestDataOnSimObject(
                    RequestId.SimVarsRequest,
                    DataDefinitionId.SimVars,
                    Microsoft.FlightSimulator.SimConnect.SimConnect.SIMCONNECT_OBJECT_ID_USER,
                    SIMCONNECT_PERIOD.SECOND,
                    SIMCONNECT_DATA_REQUEST_FLAG.DEFAULT,
                    0, 0, 0);

                // Message pump loop
                while (_cts is { IsCancellationRequested: false } && IsConnected)
                {
                    // ReceiveMessage déclenche les callbacks enregistrés
                    _sc.ReceiveMessage();
                    Thread.Sleep(_options.PollingIntervalMs);
                }
            }
            catch (COMException ex)
            {
                _log.LogWarning("SimConnect connection failed (MSFS not running?): {Msg}", ex.Message);
            }
            catch (BadImageFormatException ex)
            {
                _log.LogError(ex, "SimConnect DLL load failed (missing native SimConnect.dll next to exe?). Stopping retries.");
                break;
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _log.LogError(ex, "SimConnect unexpected error.");
            }
            finally
            {
                Disconnect();
            }

            if (_cts is { IsCancellationRequested: false })
            {
                _log.LogInformation("Retrying SimConnect in 5 seconds...");
                Thread.Sleep(5000);
            }
        }

        _log.LogInformation("NativeSimConnectClient message pump thread exiting.");
    }

    private void RegisterDataDefinition()
    {
        if (_sc is null) return;

        // L'ordre DOIT matcher le struct SimVarsStruct
        _sc.AddToDataDefinition(DataDefinitionId.SimVars, "PLANE LATITUDE",            "degrees",          SIMCONNECT_DATATYPE.FLOAT64, 0, Microsoft.FlightSimulator.SimConnect.SimConnect.SIMCONNECT_UNUSED);
        _sc.AddToDataDefinition(DataDefinitionId.SimVars, "PLANE LONGITUDE",           "degrees",          SIMCONNECT_DATATYPE.FLOAT64, 0, Microsoft.FlightSimulator.SimConnect.SimConnect.SIMCONNECT_UNUSED);
        _sc.AddToDataDefinition(DataDefinitionId.SimVars, "PLANE ALTITUDE",            "feet",             SIMCONNECT_DATATYPE.FLOAT64, 0, Microsoft.FlightSimulator.SimConnect.SimConnect.SIMCONNECT_UNUSED);
        _sc.AddToDataDefinition(DataDefinitionId.SimVars, "GPS GROUND SPEED",          "knots",            SIMCONNECT_DATATYPE.FLOAT64, 0, Microsoft.FlightSimulator.SimConnect.SimConnect.SIMCONNECT_UNUSED);
        _sc.AddToDataDefinition(DataDefinitionId.SimVars, "AIRSPEED INDICATED",        "knots",            SIMCONNECT_DATATYPE.FLOAT64, 0, Microsoft.FlightSimulator.SimConnect.SimConnect.SIMCONNECT_UNUSED);
        _sc.AddToDataDefinition(DataDefinitionId.SimVars, "PLANE HEADING DEGREES TRUE","degrees",          SIMCONNECT_DATATYPE.FLOAT64, 0, Microsoft.FlightSimulator.SimConnect.SimConnect.SIMCONNECT_UNUSED);
        _sc.AddToDataDefinition(DataDefinitionId.SimVars, "VERTICAL SPEED",            "feet per minute",  SIMCONNECT_DATATYPE.FLOAT64, 0, Microsoft.FlightSimulator.SimConnect.SimConnect.SIMCONNECT_UNUSED);
        _sc.AddToDataDefinition(DataDefinitionId.SimVars, "FUEL TOTAL QUANTITY",       "gallons",          SIMCONNECT_DATATYPE.FLOAT64, 0, Microsoft.FlightSimulator.SimConnect.SimConnect.SIMCONNECT_UNUSED);
        _sc.AddToDataDefinition(DataDefinitionId.SimVars, "SIM ON GROUND",             "bool",             SIMCONNECT_DATATYPE.INT32,   0, Microsoft.FlightSimulator.SimConnect.SimConnect.SIMCONNECT_UNUSED);
        _sc.AddToDataDefinition(DataDefinitionId.SimVars, "TITLE",                     null,               SIMCONNECT_DATATYPE.STRING256,0, Microsoft.FlightSimulator.SimConnect.SimConnect.SIMCONNECT_UNUSED);

        _sc.RegisterDataDefineStruct<SimVarsStruct>(DataDefinitionId.SimVars);
    }

    private void RegisterEventHandlers()
    {
        if (_sc is null) return;

        _sc.OnRecvSimobjectData += (sender, data) =>
        {
            if (data.dwRequestID != (uint)RequestId.SimVarsRequest) return;

            var raw = (SimVarsStruct)data.dwData[0];
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
        };

        _sc.OnRecvQuit += (sender, data) =>
        {
            _log.LogWarning("MSFS quit detected via SimConnect.");
            SetConnected(false);
        };

        _sc.OnRecvException += (sender, data) =>
        {
            _log.LogWarning("SimConnect exception: {Exception} (sendID={SendID})",
                data.dwException, data.dwSendID);
        };
    }

    private void Disconnect()
    {
        if (_sc is not null)
        {
            try { _sc.Dispose(); } catch { /* best effort */ }
            _sc = null;
        }
        SetConnected(false);

        if (_hWnd != IntPtr.Zero)
        {
            DestroyWindow(_hWnd);
            _hWnd = IntPtr.Zero;
        }
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
        // HWND_MESSAGE parent = message-only window (invisible, no rendering)
        const uint WS_OVERLAPPED = 0x00000000;
        var hWnd = CreateWindowEx(0, "STATIC", "ThrustlineSimConnect",
            WS_OVERLAPPED, 0, 0, 0, 0,
            new IntPtr(-3) /* HWND_MESSAGE */, IntPtr.Zero, IntPtr.Zero, IntPtr.Zero);
        return hWnd;
    }
}

#endif
