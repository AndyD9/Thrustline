# build-sidecar.ps1
# Publie le sim-bridge en single-file self-contained pour Windows x64
# et copie le binaire dans le dossier Tauri externalBin.
#
# Usage: .\scripts\build-sidecar.ps1
# Depuis la racine du repo.

$ErrorActionPreference = "Stop"

$RepoRoot   = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
$BridgeDir  = Join-Path $RepoRoot "sim-bridge"
$TargetDir  = Join-Path (Join-Path (Join-Path $RepoRoot "app") "src-tauri") "binaries"
$TargetFile = Join-Path $TargetDir "sim-bridge-x86_64-pc-windows-msvc.exe"

Write-Host "=== Building sim-bridge (win-x64, self-contained, single-file) ===" -ForegroundColor Cyan

dotnet publish "$BridgeDir" `
    -c Release `
    -r win-x64 `
    --self-contained `
    -p:PublishSingleFile=true `
    -p:IncludeNativeLibrariesForSelfExtract=true `
    -o "$BridgeDir\publish"

if ($LASTEXITCODE -ne 0) {
    Write-Host "dotnet publish failed!" -ForegroundColor Red
    exit 1
}

# Crée le dossier binaries s'il n'existe pas
if (-not (Test-Path $TargetDir)) {
    New-Item -ItemType Directory -Path $TargetDir -Force | Out-Null
}

# Copie le binaire
$PublishDir  = Join-Path $BridgeDir "publish"
$PublishedExe = Join-Path $PublishDir "sim-bridge.exe"
Copy-Item $PublishedExe $TargetFile -Force

# Copie les DLLs SimConnect depuis le SDK (requises a cote de l'exe)
# - Microsoft.FlightSimulator.SimConnect.dll (managee, wrapper .NET)
# - SimConnect.dll (native C++, appelee via P/Invoke par la managee)
# dotnet publish en single-file peut embarquer la managee dans l'exe,
# donc on la copie directement depuis le SDK pour etre sur.
$SdkPath = $env:MSFS_SDK
if ($SdkPath) {
    $SimConnectManaged = Join-Path $SdkPath "SimConnect SDK\lib\managed\Microsoft.FlightSimulator.SimConnect.dll"
    $SimConnectNative  = Join-Path $SdkPath "SimConnect SDK\lib\SimConnect.dll"

    if (Test-Path $SimConnectManaged) {
        Copy-Item $SimConnectManaged $TargetDir -Force
        Write-Host "SimConnect managed DLL copied to binaries/" -ForegroundColor Yellow
    } else {
        Write-Host "WARNING: SimConnect managed DLL not found at $SimConnectManaged" -ForegroundColor Yellow
    }

    if (Test-Path $SimConnectNative) {
        Copy-Item $SimConnectNative $TargetDir -Force
        Write-Host "SimConnect native DLL copied to binaries/" -ForegroundColor Yellow
    } else {
        Write-Host "WARNING: SimConnect native DLL not found at $SimConnectNative" -ForegroundColor Yellow
    }
} else {
    Write-Host "WARNING: MSFS_SDK env var not set - SimConnect DLLs not copied, sidecar will run in idle mode" -ForegroundColor Yellow
}

$Size = [math]::Round((Get-Item $TargetFile).Length / 1MB, 1)
Write-Host ('=== Sidecar ready: ' + $TargetFile + ' - ' + $Size + ' megabytes ===') -ForegroundColor Green
