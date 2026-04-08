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

# Copie la DLL SimConnect native (requise à côté de l'exe, non embarquable en single-file)
$SimConnectDll = Join-Path $PublishDir "Microsoft.FlightSimulator.SimConnect.dll"
if (Test-Path $SimConnectDll) {
    Copy-Item $SimConnectDll $TargetDir -Force
    Write-Host "SimConnect DLL copied to binaries/" -ForegroundColor Yellow
} else {
    Write-Host "WARNING: SimConnect DLL not found in publish output — sidecar will run in mock mode" -ForegroundColor Yellow
}

$Size = [math]::Round((Get-Item $TargetFile).Length / 1MB, 1)
Write-Host "=== Sidecar ready: $TargetFile ($Size MB) ===" -ForegroundColor Green
