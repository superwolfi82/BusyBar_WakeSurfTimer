<#
.SYNOPSIS
  Package, install and launch the Wakesurf Timer app on a BUSY Bar.

.DESCRIPTION
  Builds dist\<app id>.tgz from src\ with busy-cli (needs Node.js) and installs it through
  the device HTTP API (apps/stage -> apps/install -> apps/launch).

  The firmware marks the app install endpoints as local-only, so connect the BUSY Bar
  via USB (default address 10.0.4.20). Over Wi-Fi these calls return 403.

.EXAMPLE
  .\deploy.ps1                 # package + install + launch over USB
  .\deploy.ps1 -PackageOnly    # only build the .tgz
  .\deploy.ps1 -Launch         # just (re)launch the installed app
  .\deploy.ps1 -Quit           # stop the running app
#>
param(
    [string]$Addr = "10.0.4.20",
    [string]$Token = "",
    [switch]$PackageOnly,
    [switch]$Launch,
    [switch]$Quit
)

$ErrorActionPreference = "Stop"
$AppId = "io.github.superwolfi82.wakesurf"
$Root = $PSScriptRoot
$Dist = Join-Path $Root "dist"
$Pkg = Join-Path $Dist "$AppId.tgz"
$Base = "http://$Addr/api"

$Headers = @{}
if ($Token) { $Headers["X-API-Token"] = $Token }

function Invoke-Busy([string]$Method, [string]$Path, $Body = $null, [string]$ContentType = "application/json") {
    $params = @{ Method = $Method; Uri = "$Base/$Path"; Headers = $Headers; TimeoutSec = 30 }
    if ($null -ne $Body) { $params.Body = $Body; $params.ContentType = $ContentType }
    Invoke-RestMethod @params
}

if ($Quit) {
    Invoke-Busy Post "apps/quit" | Out-Null
    Write-Host "App stopped."
    return
}

if (-not $Launch) {
    New-Item -ItemType Directory -Force $Dist | Out-Null
    if (Test-Path $Pkg) { Remove-Item $Pkg -Force -Confirm:$false }
    # same build the app catalog uses: src/main.js + src/appmeta -> dist/<id>.tgz
    Push-Location $Root
    try {
        if (-not (Test-Path (Join-Path $Root "node_modules"))) { & npm ci --no-fund --no-audit; if ($LASTEXITCODE -ne 0) { throw "npm ci failed" } }
        & npx busy-cli build
        if ($LASTEXITCODE -ne 0) { throw "busy-cli build failed" }
    } finally { Pop-Location }
    Write-Host "Packaged $Pkg ($((Get-Item $Pkg).Length) bytes)"
    if ($PackageOnly) { return }

    Write-Host "Uploading to $Addr ..."
    $bytes = [System.IO.File]::ReadAllBytes($Pkg)
    $stage = Invoke-Busy Post "apps/stage" $bytes "application/octet-stream"
    Write-Host "Staged $($stage.staged.id) $($stage.staged.version)"
    Invoke-Busy Post "apps/install?install_key=$($stage.install_key)" | Out-Null
    Write-Host "Installed."
    # installing sometimes restarts the app by itself; give that start time to finish before
    # quitting, otherwise the bar logs "SyntaxError: Interrupted"
    Start-Sleep -Seconds 3
}

try { Invoke-Busy Post "apps/quit" | Out-Null } catch { }  # no app running is fine
Invoke-Busy Post "apps/launch?app_id=$AppId" | Out-Null
Write-Host "Launched $AppId."
