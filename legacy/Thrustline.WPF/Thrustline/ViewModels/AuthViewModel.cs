using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using Thrustline.Services.Auth;
using Thrustline.Services.Navigation;

namespace Thrustline.ViewModels;

public partial class AuthViewModel : ViewModelBase
{
    private readonly SupabaseAuthService _auth;
    private readonly INavigationService _nav;

    [ObservableProperty] private string _email = "";
    [ObservableProperty] private string _password = "";
    [ObservableProperty] private bool _isSignUp;

    public AuthViewModel(SupabaseAuthService auth, INavigationService nav)
    {
        _auth = auth;
        _nav = nav;
    }

    [RelayCommand]
    private async Task SubmitAsync()
    {
        IsLoading = true;
        ErrorMessage = null;
        try
        {
            if (IsSignUp)
                await _auth.SignUpAsync(Email, Password);
            else
                await _auth.SignInWithPasswordAsync(Email, Password);

            // Navigate to onboarding or dashboard
            _nav.NavigateTo<DashboardViewModel>();
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
        finally { IsLoading = false; }
    }

    [RelayCommand]
    private void SignInWithDiscord() => _auth.SignInWithOAuth("discord");

    [RelayCommand]
    private void SignInWithGoogle() => _auth.SignInWithOAuth("google");

    [RelayCommand]
    private void ToggleMode() => IsSignUp = !IsSignUp;
}
