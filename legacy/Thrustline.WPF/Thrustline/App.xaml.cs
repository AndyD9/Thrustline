using System.IO;
using System.Windows;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Thrustline.Data;
using Thrustline.Services;
using Thrustline.Services.Auth;
using Thrustline.Services.Company;
using Thrustline.Services.Crew;
using Thrustline.Services.Dispatch;
using Thrustline.Services.Flights;
using Thrustline.Services.GameEngine;
using Thrustline.Services.Navigation;
using Thrustline.Services.Routes;
using Thrustline.Services.SimConnect;
using Thrustline.Services.Sync;
using Thrustline.ViewModels;

namespace Thrustline;

public partial class App : Application
{
    private IServiceProvider _services = null!;

    protected override void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);

        var config = new ConfigurationBuilder()
            .SetBasePath(AppDomain.CurrentDomain.BaseDirectory)
            .AddJsonFile("appsettings.json", optional: false)
            .Build();

        // Database path
        var appData = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "Thrustline");
        Directory.CreateDirectory(appData);
        var dbPath = Path.Combine(appData, "thrustline.db");

        var services = new ServiceCollection();

        // EF Core
        services.AddDbContextFactory<ThrustlineDbContext>(options =>
            options.UseSqlite($"Data Source={dbPath};Foreign Keys=True"));

        // Supabase config
        var supaUrl = config["Supabase:Url"] ?? "";
        var supaKey = config["Supabase:AnonKey"] ?? "";

        // Services — singletons
        services.AddSingleton<AirportService>();
        services.AddSingleton<SupabaseAuthService>(_ => new SupabaseAuthService(supaUrl, supaKey));
        services.AddSingleton<SyncEngine>(sp => new SyncEngine(
            sp.GetRequiredService<IDbContextFactory<ThrustlineDbContext>>(), supaUrl, supaKey));
        services.AddSingleton<MonthlyTickService>();
        services.AddSingleton<LandingProcessor>();
        services.AddSingleton<FlightDetector>(sp => new FlightDetector(sp.GetRequiredService<AirportService>()));

        // SimConnect — use mock on non-Windows or when MSFS is not running
        services.AddSingleton<ISimConnectService, MockSimConnectService>();

        // Domain services
        services.AddSingleton<CompanyService>();
        services.AddSingleton<CrewService>();
        services.AddSingleton<DispatchService>();
        services.AddSingleton<FlightService>();
        services.AddSingleton<RouteService>();

        // Navigation
        services.AddSingleton<INavigationService, NavigationService>();

        // ViewModels — transient (new instance each navigation)
        services.AddTransient<MainViewModel>();
        services.AddTransient<AuthViewModel>();
        services.AddTransient<OnboardingViewModel>(sp => new OnboardingViewModel(
            sp.GetRequiredService<CompanyService>(),
            sp.GetRequiredService<INavigationService>(), "local"));
        services.AddTransient<DashboardViewModel>(sp => new DashboardViewModel(
            sp.GetRequiredService<CompanyService>(),
            sp.GetRequiredService<FlightService>(), "local"));
        services.AddTransient<FlightsViewModel>(sp => new FlightsViewModel(
            sp.GetRequiredService<FlightService>(), "local"));
        services.AddTransient<FleetViewModel>(sp => new FleetViewModel(
            sp.GetRequiredService<CompanyService>(), "local"));
        services.AddTransient<CrewViewModel>(sp => new CrewViewModel(
            sp.GetRequiredService<CrewService>(), "local"));
        services.AddTransient<DispatchViewModel>(sp => new DispatchViewModel(
            sp.GetRequiredService<DispatchService>(), "local"));
        services.AddTransient<FinancesViewModel>(sp => new FinancesViewModel(
            sp.GetRequiredService<CompanyService>(), "local"));
        services.AddTransient<RoutesViewModel>(sp => new RoutesViewModel(
            sp.GetRequiredService<RouteService>(), "local"));
        services.AddTransient<SettingsViewModel>(sp => new SettingsViewModel(
            sp.GetRequiredService<CompanyService>(),
            sp.GetRequiredService<SupabaseAuthService>(),
            sp.GetRequiredService<INavigationService>(), "local"));

        // MainWindow
        services.AddTransient<MainWindow>();

        _services = services.BuildServiceProvider();

        // Initialize
        InitializeApp();
    }

    private async void InitializeApp()
    {
        try
        {
            // Migrate database
            var dbFactory = _services.GetRequiredService<IDbContextFactory<ThrustlineDbContext>>();
            await using var db = await dbFactory.CreateDbContextAsync();
            await db.Database.MigrateAsync();

            // Load airports
            var airports = _services.GetRequiredService<AirportService>();
            airports.Load();

            // Start SimConnect
            var sim = _services.GetRequiredService<ISimConnectService>();
            var detector = _services.GetRequiredService<FlightDetector>();
            sim.SimDataReceived += detector.Update;
            sim.Start();

            // Wire up flight detection → landing processing
            var processor = _services.GetRequiredService<LandingProcessor>();
            detector.OnLanding += record =>
            {
                _ = processor.ProcessAsync(record, "local-company", "local");
            };

            // Show main window
            var mainWindow = _services.GetRequiredService<MainWindow>();
            mainWindow.Show();

            // Navigate to dashboard
            var nav = _services.GetRequiredService<INavigationService>();
            nav.NavigateTo<DashboardViewModel>();
        }
        catch (Exception ex)
        {
            MessageBox.Show($"Startup failed: {ex.Message}", "Thrustline", MessageBoxButton.OK, MessageBoxImage.Error);
            Shutdown(1);
        }
    }
}
