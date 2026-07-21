using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using System.Diagnostics;
using Thrustline.Services.Dispatch;

namespace Thrustline.ViewModels;

public partial class DispatchViewModel : ViewModelBase
{
    private readonly DispatchService _dispatchService;
    private readonly string _userId;

    [ObservableProperty] private List<Models.Dispatch> _dispatches = new();
    [ObservableProperty] private string _originIcao = "";
    [ObservableProperty] private string _destIcao = "";
    [ObservableProperty] private double _distanceNm;

    public DispatchViewModel(DispatchService dispatchService, string userId)
    {
        _dispatchService = dispatchService;
        _userId = userId;
    }

    public override async Task InitializeAsync()
    {
        IsLoading = true;
        try { Dispatches = await _dispatchService.GetDispatchesAsync(_userId); }
        finally { IsLoading = false; }
    }

    [RelayCommand]
    private async Task CreateAsync()
    {
        try
        {
            await _dispatchService.CreateDispatchAsync(_userId, OriginIcao, DestIcao, DistanceNm);
            OriginIcao = ""; DestIcao = ""; DistanceNm = 0;
            await InitializeAsync();
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
    }

    [RelayCommand]
    private async Task DeleteAsync(string id) { await _dispatchService.DeleteDispatchAsync(id); await InitializeAsync(); }

    [RelayCommand]
    private void OpenSimBrief(Models.Dispatch dispatch)
    {
        var url = DispatchService.BuildSimbriefUrl(dispatch, "THL");
        Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
    }
}
