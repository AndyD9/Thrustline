// This file requires the SimConnect managed SDK (Microsoft.FlightSimulator.SimConnect.dll).
// It is NOT available as a NuGet package — it ships with MSFS 2024 SDK installation.
//
// To enable real SimConnect:
// 1. Install the MSFS 2024 SDK
// 2. Copy Microsoft.FlightSimulator.SimConnect.dll to this project (or reference it)
// 3. Add <DefineConstants>SIMCONNECT</DefineConstants> to Thrustline.csproj
//
// Without the SDK, the app uses MockSimConnectService as a fallback.

#if SIMCONNECT

using System.Runtime.InteropServices;
using System.Windows.Interop;
using System.Windows.Threading;

namespace Thrustline.Services.SimConnect;

public class SimConnectService : ISimConnectService, IDisposable
{
    public event Action<SimData>? SimDataReceived;
    public string Status { get; private set; } = "disconnected";

    private Microsoft.FlightSimulator.SimConnect.SimConnect? _simConnect;
    private HwndSource? _hwndSource;
    private DispatcherTimer? _numericTimer;
    private DispatcherTimer? _stringTimer;
    private string _currentIcaoType = string.Empty;

    private const int WM_USER_SIMCONNECT = 0x0402;

    private enum DataDefinitionId { Numeric = 0, AircraftString = 1 }
    private enum RequestId { Numeric = 0, AircraftString = 1 }

    [StructLayout(LayoutKind.Sequential, Pack = 1)]
    private struct NumericData
    {
        public double Latitude;
        public double Longitude;
        public double Altitude;
        public double GroundSpeed;
        public double VerticalSpeed;
        public double FuelQuantity;
        public int SimOnGround;
        public double GroundTrack;
        public double Heading;
    }

    [StructLayout(LayoutKind.Sequential, Pack = 1, CharSet = CharSet.Ansi)]
    private struct AircraftTypeData
    {
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)]
        public string AtcModel;
    }

    public void Start()
    {
        try
        {
            _hwndSource = new HwndSource(new HwndSourceParameters("ThrustlineSimConnect")
            {
                Width = 0, Height = 0, PositionX = -100, PositionY = -100, WindowStyle = 0,
            });
            _hwndSource.AddHook(WndProc);

            _simConnect = new Microsoft.FlightSimulator.SimConnect.SimConnect(
                "Thrustline", _hwndSource.Handle, WM_USER_SIMCONNECT, null, 0);

            _simConnect.AddToDataDefinition(DataDefinitionId.Numeric, "PLANE LATITUDE", "degrees", Microsoft.FlightSimulator.SimConnect.SIMCONNECT_DATATYPE.FLOAT64, 0, 0);
            _simConnect.AddToDataDefinition(DataDefinitionId.Numeric, "PLANE LONGITUDE", "degrees", Microsoft.FlightSimulator.SimConnect.SIMCONNECT_DATATYPE.FLOAT64, 0, 0);
            _simConnect.AddToDataDefinition(DataDefinitionId.Numeric, "PLANE ALTITUDE", "feet", Microsoft.FlightSimulator.SimConnect.SIMCONNECT_DATATYPE.FLOAT64, 0, 0);
            _simConnect.AddToDataDefinition(DataDefinitionId.Numeric, "GROUND VELOCITY", "knots", Microsoft.FlightSimulator.SimConnect.SIMCONNECT_DATATYPE.FLOAT64, 0, 0);
            _simConnect.AddToDataDefinition(DataDefinitionId.Numeric, "VERTICAL SPEED", "feet per minute", Microsoft.FlightSimulator.SimConnect.SIMCONNECT_DATATYPE.FLOAT64, 0, 0);
            _simConnect.AddToDataDefinition(DataDefinitionId.Numeric, "FUEL TOTAL QUANTITY", "gallons", Microsoft.FlightSimulator.SimConnect.SIMCONNECT_DATATYPE.FLOAT64, 0, 0);
            _simConnect.AddToDataDefinition(DataDefinitionId.Numeric, "SIM ON GROUND", "bool", Microsoft.FlightSimulator.SimConnect.SIMCONNECT_DATATYPE.INT32, 0, 0);
            _simConnect.AddToDataDefinition(DataDefinitionId.Numeric, "GPS GROUND TRUE TRACK", "degrees", Microsoft.FlightSimulator.SimConnect.SIMCONNECT_DATATYPE.FLOAT64, 0, 0);
            _simConnect.AddToDataDefinition(DataDefinitionId.Numeric, "PLANE HEADING DEGREES TRUE", "degrees", Microsoft.FlightSimulator.SimConnect.SIMCONNECT_DATATYPE.FLOAT64, 0, 0);
            _simConnect.AddToDataDefinition(DataDefinitionId.AircraftString, "ATC MODEL", null, Microsoft.FlightSimulator.SimConnect.SIMCONNECT_DATATYPE.STRING32, 0, 0);

            _simConnect.RegisterDataDefineStruct<NumericData>(DataDefinitionId.Numeric);
            _simConnect.RegisterDataDefineStruct<AircraftTypeData>(DataDefinitionId.AircraftString);

            _simConnect.OnRecvSimobjectData += OnRecvSimObjectData;
            _simConnect.OnRecvQuit += (_, _) => { Status = "disconnected"; };

            _numericTimer = new DispatcherTimer { Interval = TimeSpan.FromSeconds(1) };
            _numericTimer.Tick += (_, _) =>
            {
                _simConnect?.RequestDataOnSimObject(RequestId.Numeric, DataDefinitionId.Numeric,
                    Microsoft.FlightSimulator.SimConnect.SimConnect.SIMCONNECT_OBJECT_ID_USER, 0, 0, 0);
            };
            _numericTimer.Start();

            _stringTimer = new DispatcherTimer { Interval = TimeSpan.FromSeconds(5) };
            _stringTimer.Tick += (_, _) =>
            {
                _simConnect?.RequestDataOnSimObject(RequestId.AircraftString, DataDefinitionId.AircraftString,
                    Microsoft.FlightSimulator.SimConnect.SimConnect.SIMCONNECT_OBJECT_ID_USER, 0, 0, 0);
            };
            _stringTimer.Start();

            Status = "connected";
        }
        catch { Status = "disconnected"; }
    }

    private void OnRecvSimObjectData(Microsoft.FlightSimulator.SimConnect.SimConnect sender,
        Microsoft.FlightSimulator.SimConnect.SIMCONNECT_RECV_SIMOBJECT_DATA data)
    {
        if (data.dwRequestID == (uint)RequestId.AircraftString)
        {
            try
            {
                var atcData = (AircraftTypeData)data.dwData[0];
                _currentIcaoType = atcData.AtcModel?.Trim().ToUpperInvariant() ?? string.Empty;
            }
            catch { }
            return;
        }

        if (data.dwRequestID == (uint)RequestId.Numeric)
        {
            var nd = (NumericData)data.dwData[0];
            SimDataReceived?.Invoke(new SimData
            {
                Latitude = nd.Latitude, Longitude = nd.Longitude, Altitude = nd.Altitude,
                GroundSpeed = nd.GroundSpeed, VerticalSpeed = nd.VerticalSpeed,
                FuelQuantity = nd.FuelQuantity, SimOnGround = nd.SimOnGround == 1,
                GroundTrack = nd.GroundTrack, Heading = nd.Heading,
                Timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
                AircraftIcaoType = _currentIcaoType,
            });
        }
    }

    private IntPtr WndProc(IntPtr hwnd, int msg, IntPtr wParam, IntPtr lParam, ref bool handled)
    {
        if (msg == WM_USER_SIMCONNECT) { _simConnect?.ReceiveMessage(); handled = true; }
        return IntPtr.Zero;
    }

    public void Stop()
    {
        _numericTimer?.Stop();
        _stringTimer?.Stop();
        _simConnect?.Dispose();
        _simConnect = null;
        _hwndSource?.Dispose();
        _hwndSource = null;
        Status = "disconnected";
    }

    public void Dispose() { Stop(); GC.SuppressFinalize(this); }
}

#endif
