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
$PublishedExe = Join-Path (Join-Path $BridgeDir "publish") "sim-bridge.exe"
Copy-Item $PublishedExe $TargetFile -Force

$Size = [math]::Round((Get-Item $TargetFile).Length / 1MB, 1)
Write-Host "=== Sidecar ready: $TargetFile ($Size MB) ===" -ForegroundColor Green
