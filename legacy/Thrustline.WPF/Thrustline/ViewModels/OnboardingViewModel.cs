using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using Thrustline.Data;
using Thrustline.Services.Company;
using Thrustline.Services.Navigation;

namespace Thrustline.ViewModels;

public partial class OnboardingViewModel : ViewModelBase
{
    private readonly CompanyService _companyService;
    private readonly INavigationService _nav;
    private readonly string _userId;

    [ObservableProperty] private string _companyName = "";
    [ObservableProperty] private string _airlineCode = "";
    [ObservableProperty] private string _hubIcao = "";
    [ObservableProperty] private string _selectedLoanKey = "standard";
    [ObservableProperty] private string? _selectedAircraftType;
    [ObservableProperty] private string _aircraftMode = "lease";
    [ObservableProperty] private string _simbriefUsername = "";
    [ObservableProperty] private int _step = 1;

    public List<LoanOption> LoanOptions { get; } = CompanyService.LoanOptions.ToList();
    public List<AircraftCatalogEntry> AircraftOptions { get; } = AircraftCatalog.All.ToList();

    public OnboardingViewModel(CompanyService companyService, INavigationService nav, string userId)
    {
        _companyService = companyService;
        _nav = nav;
        _userId = userId;
    }

    [RelayCommand] private void NextStep() => Step = Math.Min(4, Step + 1);
    [RelayCommand] private void PrevStep() => Step = Math.Max(1, Step - 1);

    [RelayCommand]
    private async Task ConfirmAsync()
    {
        IsLoading = true;
        ErrorMessage = null;
        try
        {
            await _companyService.SetupCompanyAsync(_userId, new SetupInput(
                CompanyName, AirlineCode, HubIcao, SelectedLoanKey,
                SelectedAircraftType, AircraftMode,
                string.IsNullOrWhiteSpace(SimbriefUsername) ? null : SimbriefUsername));

            _nav.NavigateTo<DashboardViewModel>();
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
        finally { IsLoading = false; }
    }
}
