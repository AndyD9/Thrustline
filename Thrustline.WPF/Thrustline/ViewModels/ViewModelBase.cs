using CommunityToolkit.Mvvm.ComponentModel;

namespace Thrustline.ViewModels;

public abstract partial class ViewModelBase : ObservableObject
{
    [ObservableProperty]
    private bool _isLoading;

    [ObservableProperty]
    private string? _errorMessage;

    public virtual Task InitializeAsync() => Task.CompletedTask;
}
