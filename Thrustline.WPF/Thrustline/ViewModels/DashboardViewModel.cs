using CommunityToolkit.Mvvm.ComponentModel;
using Thrustline.Models;
using Thrustline.Services.Company;
using Thrustline.Services.Flights;
using Thrustline.Services.GameEngine;

namespace Thrustline.ViewModels;

public partial class DashboardViewModel : ViewModelBase
{
    private readonly CompanyService _companyService;
    private readonly FlightService _flightService;
    private readonly string _userId;

    [ObservableProperty] private double _capital;
    [ObservableProperty] private int _totalFlights;
    [ObservableProperty] private int _fleetSize;
    [ObservableProperty] private double _reputationScore;
    [ObservableProperty] private List<Flight> _recentFlights = new();

    public DashboardViewModel(CompanyService companyService, FlightService flightService, string userId)
    {
        _companyService = companyService;
        _flightService = flightService;
        _userId = userId;
    }

    public override async Task InitializeAsync()
    {
        IsLoading = true;
        try
        {
            var company = await _companyService.GetCompanyAsync(_userId);
            if (company != null)
            {
                Capital = company.Capital;
                FleetSize = company.Fleet.Count;
            }
            RecentFlights = await _flightService.GetAllFlightsAsync(_userId, 5);
            TotalFlights = RecentFlights.Count; // simplified
        }
        finally { IsLoading = false; }
    }
}
