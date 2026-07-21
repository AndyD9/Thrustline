using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using Thrustline.Services.Auth;
using Thrustline.Services.Company;
using Thrustline.Services.Navigation;

namespace Thrustline.ViewModels;

public partial class SettingsViewModel : ViewModelBase
{
    private readonly CompanyService _companyService;
    private readonly SupabaseAuthService _auth;
    private readonly INavigationService _nav;
    private readonly string _userId;

    [ObservableProperty] private string _companyName = "";
    [ObservableProperty] private string _hubIcao = "";
    [ObservableProperty] private string _airlineCode = "";
    [ObservableProperty] private string _simbriefUsername = "";

    public SettingsViewModel(CompanyService companyService, SupabaseAuthService auth, INavigationService nav, string userId)
    {
        _companyService = companyService;
        _auth = auth;
        _nav = nav;
        _userId = userId;
    }

    public override async Task InitializeAsync()
    {
        var company = await _companyService.GetCompanyAsync(_userId);
        if (company == null) return;
        CompanyName = company.Name;
        HubIcao = company.HubIcao ?? "";
        AirlineCode = company.AirlineCode;
        SimbriefUsername = company.SimbriefUsername ?? "";
    }

    [RelayCommand]
    private async Task SaveAsync()
    {
        await _companyService.UpdateCompanyAsync(_userId, CompanyName, HubIcao, AirlineCode, SimbriefUsername);
    }

    [RelayCommand]
    private async Task ResetAsync()
    {
        await _companyService.ResetCompanyDataAsync(_userId);
        await InitializeAsync();
    }

    [RelayCommand]
    private async Task SignOutAsync()
    {
        await _auth.SignOutAsync();
        _nav.NavigateTo<AuthViewModel>();
    }
}
