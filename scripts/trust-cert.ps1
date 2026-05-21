# Trust BTV's local self-signed certificate (Windows, admin required)
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$CertPath = Join-Path $Root "data\certs\cert.pem"

if (-not (Test-Path $CertPath)) {
  Write-Host "Certificate not found. Start BTV once (pnpm dev) to generate: $CertPath"
  exit 1
}

Write-Host "Importing certificate to Current User Trusted Root..."
Import-Certificate -FilePath $CertPath -CertStoreLocation Cert:\CurrentUser\Root | Out-Null
Write-Host "Done. Restart your browser and OBS, then reload overlay sources."
