using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using CommunityToolkit.Mvvm.Messaging;
using Thrustline.Messages;
using Thrustline.Services.Navigation;
using Thrustline.Services.SimConnect;

namespace Thrustline.ViewModels;

public partial class MainViewModel : ViewModelBase,
    IRecipient<SimStatusMessage>,
    IRecipient<SyncStatusMessage>,
    IRecipient<FlightStartedMessage>,
    IRecipient<FlightEndedMessage>,
    IRecipient<SimDataMessage>
{
    private readonly INavigationService _nav;

    [ObservableProperty] private ViewModelBase? _currentPage;
    [ObservableProperty] private int _selectedNavIndex;
    [ObservableProperty] private string _simStatus = "disconnected";
    [ObservableProperty] private string _syncStatus = "idle";
    [ObservableProperty] private bool _isFlying;

    // Live flight data
    [ObservableProperty] private double _altitude;
    [ObservableProperty] private double _groundSpeed;
    [ObservableProperty] private string _departureIcao = "";
    [ObservableProperty] private string _currentAircraftType = "";

    public MainViewModel(INavigationService nav)
    {
        _nav = nav;
        WeakReferenceMessenger.Default.RegisterAll(this);
        _nav.Navigated += () => CurrentPage = _nav.CurrentViewModel;
    }

    [RelayCommand]
    private void Navigate(string page)
    {
        switch (page)
        {
            case "Dashboard": _nav.NavigateTo<DashboardViewModel>(); SelectedNavIndex = 0; break;
            case "Flights": _nav.NavigateTo<FlightsViewModel>(); SelectedNavIndex = 1; break;
            case "Finances": _nav.NavigateTo<FinancesViewModel>(); SelectedNavIndex = 2; break;
            case "Fleet": _nav.NavigateTo<FleetViewModel>(); SelectedNavIndex = 3; break;
            case "Crew": _nav.NavigateTo<CrewViewModel>(); SelectedNavIndex = 4; break;
            case "Routes": _nav.NavigateTo<RoutesViewModel>(); SelectedNavIndex = 5; break;
            case "Dispatch": _nav.NavigateTo<DispatchViewModel>(); SelectedNavIndex = 6; break;
            case "Settings": _nav.NavigateTo<SettingsViewModel>(); SelectedNavIndex = 7; break;
        }
    }

    public void Receive(SimStatusMessage message) => SimStatus = message.Status;
    public void Receive(SyncStatusMessage message) => SyncStatus = message.Status;
    public void Receive(FlightStartedMessage message) { IsFlying = true; DepartureIcao = message.DepartureIcao; }
    public void Receive(FlightEndedMessage message) => IsFlying = false;

    public void Receive(SimDataMessage message)
    {
        Altitude = message.Data.Altitude;
        GroundSpeed = message.Data.GroundSpeed;
        CurrentAircraftType = message.Data.AircraftIcaoType;
    }
}
