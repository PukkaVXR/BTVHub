# Ensures node.exe is on PATH for this PowerShell session.
$MinimumNodeVersion = [Version]"22.5.0"

function Test-NodeVersion {
  param(
    [Parameter(Mandatory = $true)]
    [string]$NodeExe
  )

  try {
    $raw = & $NodeExe -p "process.versions.node"
    return [Version]$raw
  } catch {
    return $null
  }
}

function Ensure-NodeInPath {
  if (Get-Command node -ErrorAction SilentlyContinue) {
    $current = Test-NodeVersion -NodeExe "node"
    if ($current -and $current -ge $MinimumNodeVersion) {
      return
    }
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
      $version = Test-NodeVersion -NodeExe "$dir\node.exe"
      if ($version -and $version -ge $MinimumNodeVersion) {
        $env:PATH = "$dir;$env:PATH"
        Write-Host "Using Node.js from $dir ($(& "$dir\node.exe" -v))"
        return
      }
    }
  }

  Write-Host ""
  Write-Host "ERROR: Node.js was not found on your PATH." -ForegroundColor Red
  Write-Host ""
  Write-Host "BTV requires Node.js 22.5 or newer."
  Write-Host "  1. Install from https://nodejs.org/ (LTS recommended)"
  Write-Host "  2. Close and reopen PowerShell"
  Write-Host "  3. Run: node -v"
  Write-Host "  4. Run: .\scripts\start.ps1"
  Write-Host ""
  exit 1
}
