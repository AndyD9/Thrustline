using System.IO;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using Microsoft.Win32;
using Thrustline.Models;
using Thrustline.Services.Flights;

namespace Thrustline.ViewModels;

public partial class FlightsViewModel : ViewModelBase
{
    private readonly FlightService _flightService;
    private readonly string _userId;

    [ObservableProperty] private List<Flight> _flights = new();

    public FlightsViewModel(FlightService flightService, string userId)
    {
        _flightService = flightService;
        _userId = userId;
    }

    public override async Task InitializeAsync()
    {
        IsLoading = true;
        try { Flights = await _flightService.GetAllFlightsAsync(_userId); }
        finally { IsLoading = false; }
    }

    [RelayCommand]
    private async Task ExportCsvAsync()
    {
        var dlg = new SaveFileDialog { Filter = "CSV files|*.csv", FileName = "flights.csv" };
        if (dlg.ShowDialog() != true) return;

        var lines = new List<string> { "Date,Departure,Arrival,Duration(min),Distance(nm),VS(fpm),Revenue,FuelCost,LandingFee,Net" };
        foreach (var f in Flights)
            lines.Add($"{f.CreatedAt:yyyy-MM-dd},{f.DepartureIcao},{f.ArrivalIcao},{f.DurationMin},{f.DistanceNm:F1},{f.LandingVsFpm:F0},{f.Revenue:F2},{f.FuelCost:F2},{f.LandingFee:F2},{f.NetResult:F2}");

        await File.WriteAllLinesAsync(dlg.FileName, lines);
    }
}
