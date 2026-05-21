# Start BTV Streaming Hub (hub + overlay server)
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

. "$PSScriptRoot\ensure-node.ps1"
Ensure-NodeInPath

$pnpm = "pnpm"
if (Test-Path "$Root\pnpm.exe") {
  $pnpm = "$Root\pnpm.exe"
} elseif (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
  Write-Error "pnpm is required. Install Node.js, then: npm install -g pnpm"
  exit 1
}

Write-Host "Freeing ports 4781-4783 if in use..."
powershell -NoProfile -ExecutionPolicy Bypass -File "$PSScriptRoot\free-ports.ps1"

Write-Host "Starting BTV Hub at http://127.0.0.1:4781"
Write-Host "Overlays (HTTP):  http://127.0.0.1:4782"
Write-Host "OAuth (HTTPS):    https://127.0.0.1:4783"
& $pnpm dev
