using System.Windows;
using Thrustline.ViewModels;

namespace Thrustline;

public partial class MainWindow : Window
{
    public MainWindow(MainViewModel viewModel)
    {
        InitializeComponent();
        DataContext = viewModel;
    }
}
