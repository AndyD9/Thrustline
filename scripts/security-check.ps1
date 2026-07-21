$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
$violations = [System.Collections.Generic.List[string]]::new()

function Assert-Absent([string]$Path, [string]$Pattern, [string]$Message) {
    $matches = Get-ChildItem (Join-Path $repo $Path) -Recurse -File |
        Where-Object { $_.FullName -notmatch '[\\/](bin|obj|publish|target|node_modules|dist)[\\/]' } |
        Where-Object { $_.Extension -in '.cs', '.ts', '.tsx', '.json', '.toml' } |
        Select-String -Pattern $Pattern -ErrorAction SilentlyContinue
    if ($matches) { $violations.Add("$Message ($($matches[0].Path):$($matches[0].LineNumber))") }
}

Assert-Absent "sim-bridge" "ServiceRoleKey|ISupabaseClientProvider|SupabaseClientProvider" "Privileged Supabase credentials returned to the sidecar"
Assert-Absent "app/src" "p_now" "Client-controlled server clock detected"
Assert-Absent "sim-bridge" "SetIsOriginAllowed\(_ => true\)|AllowAnyOrigin" "Permissive bridge CORS detected"

$tauriConfig = Get-Content -Raw (Join-Path $repo "app/src-tauri/tauri.conf.json")
if ($tauriConfig -match '"csp"\s*:\s*null') { $violations.Add("Tauri CSP is disabled") }
$capability = Get-Content -Raw (Join-Path $repo "app/src-tauri/capabilities/default.json")
if ($capability -match 'shell:allow-(execute|spawn)') { $violations.Add("WebView has process execution permissions") }

if ($violations.Count -gt 0) {
    $violations | ForEach-Object { Write-Error $_ }
    exit 1
}
Write-Host "Security invariants passed."
