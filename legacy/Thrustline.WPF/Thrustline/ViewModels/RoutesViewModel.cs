using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using Thrustline.Models;
using Thrustline.Services.Routes;

namespace Thrustline.ViewModels;

public partial class RoutesViewModel : ViewModelBase
{
    private readonly RouteService _routeService;
    private readonly string _userId;

    [ObservableProperty] private List<DiscoveredRoute> _discoveredRoutes = new();
    [ObservableProperty] private List<Route> _savedRoutes = new();

    public RoutesViewModel(RouteService routeService, string userId)
    {
        _routeService = routeService;
        _userId = userId;
    }

    public override async Task InitializeAsync()
    {
        IsLoading = true;
        try
        {
            DiscoveredRoutes = await _routeService.GetDiscoveredRoutesAsync(_userId);
            SavedRoutes = await _routeService.GetSavedRoutesAsync(_userId);
        }
        finally { IsLoading = false; }
    }

    [RelayCommand]
    private async Task DeleteRouteAsync(string id) { await _routeService.DeleteRouteAsync(id); await InitializeAsync(); }
}
