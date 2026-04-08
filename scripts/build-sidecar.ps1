# build-sidecar.ps1
# Publie le sim-bridge en single-file self-contained pour Windows x64
# et copie le binaire dans le dossier Tauri externalBin.
#
# Usage: .\scripts\build-sidecar.ps1
# Depuis la racine du repo.

$ErrorActionPreference = "Stop"

$RepoRoot   = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
$BridgeDir  = Join-Path $RepoRoot "sim-bridge"
$PublishDir = Join-Path $BridgeDir "publish"
$TargetDir  = Join-Path (Join-Path (Join-Path $RepoRoot "app") "src-tauri") "binaries"

Write-Host "=== Building sim-bridge (win-x64, self-contained, single-file) ===" -ForegroundColor Cyan

dotnet publish "$BridgeDir" `
    -c Release `
    -r win-x64 `
    --self-contained `
    -p:PublishSingleFile=true `
    -p:IncludeNativeLibrariesForSelfExtract=true `
    -o "$PublishDir"

if ($LASTEXITCODE -ne 0) {
    Write-Host "dotnet publish failed!" -ForegroundColor Red
    exit 1
}

# Cree le dossier binaries s'il n'existe pas
if (-not (Test-Path $TargetDir)) {
    New-Item -ItemType Directory -Path $TargetDir -Force | Out-Null
}

# Copie le single-file exe
$PublishedExe = Join-Path $PublishDir "sim-bridge.exe"
$TargetExe   = Join-Path $TargetDir "sim-bridge-x86_64-pc-windows-msvc.exe"
Copy-Item $PublishedExe $TargetExe -Force

# Copie la DLL SimConnect managee depuis le publish output
# (ExcludeFromSingleFile=true dans le csproj empeche son embedding car c'est du mixed-mode C++/CLI)
$ManagedDll = Join-Path $PublishDir "Microsoft.FlightSimulator.SimConnect.dll"
if (Test-Path $ManagedDll) {
    Copy-Item $ManagedDll $TargetDir -Force
    Write-Host "SimConnect managed DLL copied to binaries/" -ForegroundColor Yellow
} else {
    Write-Host "WARNING: SimConnect managed DLL not in publish output" -ForegroundColor Yellow
}

# Copie la DLL native SimConnect depuis le SDK
# (la managee depend de cette DLL via P/Invoke)
$SdkPath = $env:MSFS_SDK
if ($SdkPath) {
    $NativeDll = Join-Path $SdkPath "SimConnect SDK\lib\SimConnect.dll"
    if (Test-Path $NativeDll) {
        Copy-Item $NativeDll $TargetDir -Force
        Write-Host "SimConnect native DLL copied to binaries/" -ForegroundColor Yellow
    } else {
        Write-Host "WARNING: SimConnect native DLL not found at $NativeDll" -ForegroundColor Yellow
    }
} else {
    Write-Host "WARNING: MSFS_SDK env var not set - native DLL not copied" -ForegroundColor Yellow
}

$Size = [math]::Round((Get-Item $TargetExe).Length / 1MB, 1)
Write-Host ('=== Sidecar ready: ' + $TargetExe + ' - ' + $Size + ' megabytes ===') -ForegroundColor Green
