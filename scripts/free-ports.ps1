# Stop processes listening on BTV ports (4781 hub, 4782 overlay, 4783 oauth)
$ports = @(4781, 4782, 4783)

foreach ($port in $ports) {
  $conns = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
  foreach ($conn in $conns) {
    $processId = $conn.OwningProcess
    if ($processId -and $processId -ne 0) {
      Write-Host "Stopping process $processId on port $port"
      Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
    }
  }
}

Start-Sleep -Milliseconds 500
