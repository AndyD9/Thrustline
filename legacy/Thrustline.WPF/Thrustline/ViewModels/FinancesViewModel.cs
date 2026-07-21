using System.IO;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using Microsoft.Win32;
using Thrustline.Models;
using Thrustline.Services.Company;

namespace Thrustline.ViewModels;

public partial class FinancesViewModel : ViewModelBase
{
    private readonly CompanyService _companyService;
    private readonly string _userId;

    [ObservableProperty] private double _capital;
    [ObservableProperty] private Loan? _loan;
    [ObservableProperty] private List<Transaction> _transactions = new();

    public FinancesViewModel(CompanyService companyService, string userId)
    {
        _companyService = companyService;
        _userId = userId;
    }

    public override async Task InitializeAsync()
    {
        IsLoading = true;
        try
        {
            var company = await _companyService.GetCompanyAsync(_userId);
            Capital = company?.Capital ?? 0;
            Loan = await _companyService.GetActiveLoanAsync(_userId);
            Transactions = await _companyService.GetTransactionsAsync(_userId);
        }
        finally { IsLoading = false; }
    }

    [RelayCommand]
    private async Task ExportCsvAsync()
    {
        var dlg = new SaveFileDialog { Filter = "CSV files|*.csv", FileName = "transactions.csv" };
        if (dlg.ShowDialog() != true) return;

        var lines = new List<string> { "Date,Type,Amount,Description" };
        foreach (var t in Transactions)
            lines.Add($"{t.CreatedAt:yyyy-MM-dd},{t.Type},{t.Amount:F2},\"{t.Description}\"");

        await File.WriteAllLinesAsync(dlg.FileName, lines);
    }
}
