# ─── Signed Build Script ─────────────────────────────────────────────────────
# Loads signing credentials from .env.signing then runs a full signed build.
#
# Usage (from repo root):
#   .\scripts\build-signed.ps1
# ─────────────────────────────────────────────────────────────────────────────

$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot)

$envFile = '.env.signing'
if (-not (Test-Path $envFile)) {
    Write-Error "Missing '$envFile'. Copy '.env.signing.example' and fill in your certificate details."
    exit 1
}

# Load env vars from .env.signing (skip comments and blank lines)
Get-Content $envFile | Where-Object { $_ -match '^\s*[^#]\S+=\S' } | ForEach-Object {
    $parts = $_ -split '=', 2
    $name  = $parts[0].Trim()
    $value = $parts[1].Trim()
    [System.Environment]::SetEnvironmentVariable($name, $value, 'Process')
    Write-Host "  Loaded: $name"
}

Write-Host ""
Write-Host "Building and signing Minecraft Server Manager..."
Write-Host ""

npm run package

Write-Host ""
Write-Host "Build complete. Output is in the 'dist' folder."
Write-Host ""

# Verify the signature on the produced installer
$installer = Get-ChildItem dist -Filter '*.exe' | Select-Object -First 1
if ($installer) {
    Write-Host "Verifying signature on: $($installer.Name)"
    & signtool verify /pa /v $installer.FullName
}
