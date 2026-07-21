using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using Thrustline.Models;
using Thrustline.Services.Crew;

namespace Thrustline.ViewModels;

public partial class CrewViewModel : ViewModelBase
{
    private readonly CrewService _crewService;
    private readonly string _userId;

    [ObservableProperty] private List<CrewMember> _crew = new();
    [ObservableProperty] private List<CrewCandidate> _pool = new();

    public CrewViewModel(CrewService crewService, string userId)
    {
        _crewService = crewService;
        _userId = userId;
    }

    public override async Task InitializeAsync()
    {
        IsLoading = true;
        try { Crew = await _crewService.GetCrewAsync(_userId); Pool = CrewService.GeneratePool(); }
        finally { IsLoading = false; }
    }

    [RelayCommand] private async Task HireAsync(CrewCandidate c) { try { await _crewService.HireAsync(_userId, c); await InitializeAsync(); } catch (Exception ex) { ErrorMessage = ex.Message; } }
    [RelayCommand] private async Task FireAsync(string id) { await _crewService.FireAsync(id); await InitializeAsync(); }
    [RelayCommand] private async Task AssignAsync((string crewId, string aircraftId) p) { await _crewService.AssignAsync(p.crewId, p.aircraftId); await InitializeAsync(); }
    [RelayCommand] private async Task UnassignAsync(string crewId) { await _crewService.UnassignAsync(crewId); await InitializeAsync(); }
    [RelayCommand] private void RefreshPool() => Pool = CrewService.GeneratePool();
}
