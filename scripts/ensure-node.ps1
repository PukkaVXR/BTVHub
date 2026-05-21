# Ensures node.exe is on PATH for this PowerShell session.
function Ensure-NodeInPath {
  if (Get-Command node -ErrorAction SilentlyContinue) {
    return
  }

  $candidates = @(
    "$env:ProgramFiles\nodejs",
    "${env:ProgramFiles(x86)}\nodejs",
    "$env:LOCALAPPDATA\Programs\node"
  )

  if ($env:NVM_SYMLINK -and (Test-Path "$env:NVM_SYMLINK\node.exe")) {
    $candidates = @($env:NVM_SYMLINK) + $candidates
  }

  if ($env:NVM_HOME) {
    $active = Get-ChildItem "$env:NVM_HOME" -Filter "node.exe" -Recurse -ErrorAction SilentlyContinue |
      Select-Object -First 1
    if ($active) {
      $candidates = @($active.DirectoryName) + $candidates
    }
  }

  foreach ($dir in $candidates) {
    if ($dir -and (Test-Path "$dir\node.exe")) {
      $env:PATH = "$dir;$env:PATH"
      Write-Host "Using Node.js from $dir ($(& "$dir\node.exe" -v))"
      return
    }
  }

  Write-Host ""
  Write-Host "ERROR: Node.js was not found on your PATH." -ForegroundColor Red
  Write-Host ""
  Write-Host "BTV requires Node.js 20 or newer."
  Write-Host "  1. Install from https://nodejs.org/ (LTS recommended)"
  Write-Host "  2. Close and reopen PowerShell"
  Write-Host "  3. Run: node -v"
  Write-Host "  4. Run: .\scripts\start.ps1"
  Write-Host ""
  exit 1
}
