# build-sidecar.ps1
# Publie le sim-bridge self-contained pour Windows x64
# et copie le resultat dans le dossier Tauri externalBin.
#
# Usage: .\scripts\build-sidecar.ps1
# Depuis la racine du repo.

$ErrorActionPreference = "Stop"

$RepoRoot   = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
$BridgeDir  = Join-Path $RepoRoot "sim-bridge"
$PublishDir = Join-Path $BridgeDir "publish"
$TargetDir  = Join-Path (Join-Path (Join-Path $RepoRoot "app") "src-tauri") "binaries"

Write-Host "=== Building sim-bridge (win-x64, self-contained) ===" -ForegroundColor Cyan

dotnet publish "$BridgeDir" `
    -c Release `
    -r win-x64 `
    --self-contained `
    -o "$PublishDir"

if ($LASTEXITCODE -ne 0) {
    Write-Host "dotnet publish failed!" -ForegroundColor Red
    exit 1
}

# Cree le dossier binaries s'il n'existe pas
if (-not (Test-Path $TargetDir)) {
    New-Item -ItemType Directory -Path $TargetDir -Force | Out-Null
}

# Copie tout le contenu du publish vers binaries
Copy-Item (Join-Path $PublishDir "*") $TargetDir -Recurse -Force
Write-Host "Publish output copied to binaries/" -ForegroundColor Yellow

# Renomme l'exe pour matcher le target triple attendu par Tauri
$SrcExe = Join-Path $TargetDir "sim-bridge.exe"
$DstExe = Join-Path $TargetDir "sim-bridge-x86_64-pc-windows-msvc.exe"
if (Test-Path $SrcExe) {
    Move-Item $SrcExe $DstExe -Force
}

# Copie la DLL native SimConnect depuis le SDK
# (la DLL managee est deja dans le publish output via la reference csproj)
$SdkPath = $env:MSFS_SDK
if ($SdkPath) {
    $SimConnectNative = Join-Path $SdkPath "SimConnect SDK\lib\SimConnect.dll"
    if (Test-Path $SimConnectNative) {
        Copy-Item $SimConnectNative $TargetDir -Force
        Write-Host "SimConnect native DLL copied to binaries/" -ForegroundColor Yellow
    } else {
        Write-Host "WARNING: SimConnect native DLL not found at $SimConnectNative" -ForegroundColor Yellow
    }
} else {
    Write-Host "WARNING: MSFS_SDK env var not set - SimConnect native DLL not copied" -ForegroundColor Yellow
}

$Size = [math]::Round((Get-Item $DstExe).Length / 1MB, 1)
Write-Host ('=== Sidecar ready: ' + $DstExe + ' - ' + $Size + ' megabytes ===') -ForegroundColor Green
