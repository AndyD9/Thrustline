using CommunityToolkit.Mvvm.ComponentModel;
using Thrustline.ViewModels;

namespace Thrustline.Services.Navigation;

public interface INavigationService
{
    ViewModelBase? CurrentViewModel { get; }
    event Action? Navigated;
    void NavigateTo<T>() where T : ViewModelBase;
    void NavigateTo(ViewModelBase viewModel);
}

public partial class NavigationService : ObservableObject, INavigationService
{
    private readonly IServiceProvider _serviceProvider;

    [ObservableProperty]
    private ViewModelBase? _currentViewModel;

    public event Action? Navigated;

    public NavigationService(IServiceProvider serviceProvider) => _serviceProvider = serviceProvider;

    public void NavigateTo<T>() where T : ViewModelBase
    {
        var vm = (T)_serviceProvider.GetService(typeof(T))!;
        CurrentViewModel = vm;
        _ = vm.InitializeAsync();
        Navigated?.Invoke();
    }

    public void NavigateTo(ViewModelBase viewModel)
    {
        CurrentViewModel = viewModel;
        _ = viewModel.InitializeAsync();
        Navigated?.Invoke();
    }
}
