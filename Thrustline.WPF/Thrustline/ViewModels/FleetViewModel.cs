using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using Thrustline.Data;
using Thrustline.Models;
using Thrustline.Services.Company;

namespace Thrustline.ViewModels;

public partial class FleetViewModel : ViewModelBase
{
    private readonly CompanyService _companyService;
    private readonly string _userId;

    [ObservableProperty] private List<Aircraft> _fleet = new();
    [ObservableProperty] private List<AircraftCatalogEntry> _catalog = AircraftCatalog.All.ToList();
    [ObservableProperty] private string? _activeAircraftId;

    public FleetViewModel(CompanyService companyService, string userId)
    {
        _companyService = companyService;
        _userId = userId;
    }

    public override async Task InitializeAsync()
    {
        IsLoading = true;
        try
        {
            Fleet = await _companyService.GetFleetAsync(_userId);
            var company = await _companyService.GetCompanyAsync(_userId);
            ActiveAircraftId = company?.ActiveAircraftId;
        }
        finally { IsLoading = false; }
    }

    [RelayCommand]
    private async Task LeaseAsync(string icaoType)
    {
        try { await _companyService.LeaseAircraftAsync(icaoType, _userId); await InitializeAsync(); }
        catch (Exception ex) { ErrorMessage = ex.Message; }
    }

    [RelayCommand]
    private async Task PurchaseAsync(string icaoType)
    {
        try { await _companyService.PurchaseAircraftAsync(icaoType, _userId); await InitializeAsync(); }
        catch (Exception ex) { ErrorMessage = ex.Message; }
    }

    [RelayCommand]
    private async Task MaintainAsync(string aircraftId)
    {
        try { await _companyService.MaintainAircraftAsync(aircraftId, _userId); await InitializeAsync(); }
        catch (Exception ex) { ErrorMessage = ex.Message; }
    }

    [RelayCommand]
    private async Task SellAsync(string aircraftId)
    {
        try { await _companyService.SellAircraftAsync(aircraftId, _userId); await InitializeAsync(); }
        catch (Exception ex) { ErrorMessage = ex.Message; }
    }

    [RelayCommand]
    private async Task ActivateAsync(string aircraftId)
    {
        await _companyService.SetActiveAircraftAsync(_userId, aircraftId);
        await InitializeAsync();
    }
}
