param(
  [string]$BackendSubdomainUrl = "https://snooker-standalone-backend-production.up.railway.app",
  [string]$BackendCustomUrl = "https://snookerhk.live",
  [string]$AdminToken = "",
  [switch]$Insecure = $true
)

# Enforce modern TLS and optionally skip certificate validation (useful during domain setup)
[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12 -bor [System.Net.SecurityProtocolType]::Tls13
if ($Insecure) { [System.Net.ServicePointManager]::ServerCertificateValidationCallback = { $true } }

function Test-Endpoints {
  param(
    [string]$BaseUrl,
    [string]$AdminToken
  )

  Write-Host ("\n== Testing: {0} ==" -f $BaseUrl) -ForegroundColor Cyan
  $paths = @("/health", "/health/db")
  if ($AdminToken -and $AdminToken.Trim().Length -gt 0) { $paths += "/admin/overview" }

  foreach ($path in $paths) {
    try {
      $uri = ($BaseUrl.TrimEnd('/')) + $path
      $headers = @{}
      if ($path -eq "/admin/overview" -and $AdminToken) { $headers["x-admin-token"] = $AdminToken }
      $resp = Invoke-WebRequest -Uri $uri -Method GET -Headers $headers -UseBasicParsing
      $fallback = $resp.Headers["X-Railway-Fallback"]
      $fallbackMsg = if ($fallback) { " (X-Railway-Fallback: $fallback)" } else { "" }
      Write-Host ("[OK] {0} -> {1}{2}" -f $path, $resp.StatusCode, $fallbackMsg) -ForegroundColor Green
    } catch {
      Write-Host ("[ERR] {0} -> {1}" -f $path, $_.Exception.Message) -ForegroundColor Red
    }
  }

  # Socket.IO probe (polling handshake)
  try {
    $socketUrl = ($BaseUrl.TrimEnd('/')) + "/socket.io/?EIO=4&transport=polling"
    $sresp = Invoke-WebRequest -Uri $socketUrl -Method GET -UseBasicParsing
    Write-Host ("[SOCKET] {0} -> {1}" -f $socketUrl, $sresp.StatusCode) -ForegroundColor Yellow
  } catch {
    Write-Host ("[SOCKET ERR] {0} -> {1}" -f $socketUrl, $_.Exception.Message) -ForegroundColor Red
  }
}

Write-Host ("Subdomain: {0}" -f $BackendSubdomainUrl) -ForegroundColor Magenta
Test-Endpoints -BaseUrl $BackendSubdomainUrl -AdminToken $AdminToken

Write-Host ("\nCustom Domain: {0}" -f $BackendCustomUrl) -ForegroundColor Magenta
Test-Endpoints -BaseUrl $BackendCustomUrl -AdminToken $AdminToken

Write-Host "\nVerification finished. If you see X-Railway-Fallback or 404, fix Builder/Start/Root/Variables and redeploy." -ForegroundColor Yellow