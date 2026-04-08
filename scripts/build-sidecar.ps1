# build-sidecar.ps1
# Publie le sim-bridge en single-file self-contained pour Windows x64
# et copie l'exe dans le dossier Tauri externalBin.
#
# Usage: .\scripts\build-sidecar.ps1
# Depuis la racine du repo.

$ErrorActionPreference = "Stop"

$RepoRoot   = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
$BridgeDir  = Join-Path $RepoRoot "sim-bridge"
$PublishDir = Join-Path $BridgeDir "publish"
$TargetDir  = Join-Path (Join-Path (Join-Path $RepoRoot "app") "src-tauri") "binaries"

Write-Host "=== Building sim-bridge (win-x64, single-file, self-contained) ===" -ForegroundColor Cyan

dotnet publish "$BridgeDir" `
    -c Release `
    -r win-x64 `
    --self-contained `
    -o "$PublishDir"

if ($LASTEXITCODE -ne 0) {
    Write-Host "dotnet publish failed!" -ForegroundColor Red
    exit 1
}

# Cree le dossier binaries s'il n'existe pas, sinon nettoie les anciens artefacts
if (-not (Test-Path $TargetDir)) {
    New-Item -ItemType Directory -Path $TargetDir -Force | Out-Null
} else {
    Remove-Item (Join-Path $TargetDir "*") -Recurse -Force -ErrorAction SilentlyContinue
}

# Copie uniquement l'exe single-file, renomme pour le target triple Tauri
$SrcExe = Join-Path $PublishDir "sim-bridge.exe"
$DstExe = Join-Path $TargetDir "sim-bridge-x86_64-pc-windows-msvc.exe"
Copy-Item $SrcExe $DstExe -Force

$Size = [math]::Round((Get-Item $DstExe).Length / 1MB, 1)
Write-Host ('=== Sidecar ready: ' + $DstExe + ' - ' + $Size + ' megabytes ===') -ForegroundColor Green
