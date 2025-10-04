param(
  [string]$BackendUrl = "https://snooker-standalone-backend-production.up.railway.app",
  [string]$AdminToken = "wwww5678",
  [switch]$Insecure = $true
)

if ($Insecure) {
  try {
    # Allow TLS 1.2 and bypass certificate validation for test purposes
    [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12
    [System.Net.ServicePointManager]::ServerCertificateValidationCallback = { $true }
  } catch {}
}

Write-Host "Backend: $BackendUrl" -ForegroundColor Cyan

$global:FallbackDetected = $false
$global:OkCount = 0

function Test-Endpoint($path, $headers = @{}) {
  $url = "$BackendUrl$path"
  try {
    $res = Invoke-WebRequest -Uri $url -Method GET -Headers $headers -ErrorAction Stop -UseBasicParsing
    Write-Host ("`n[OK] {0} -> {1}" -f $path, $res.StatusCode) -ForegroundColor Green
    $fallback = $res.Headers['X-Railway-Fallback']
    if ($fallback) { $global:FallbackDetected = $true; Write-Host ("X-Railway-Fallback: {0}" -f $fallback) -ForegroundColor Yellow }
    if ($res.Content) { Write-Host $res.Content }
    $global:OkCount += 1
  } catch {
    if ($_.Exception.Response) {
      $resp = $_.Exception.Response
      $code = $resp.StatusCode.value__
      Write-Host ("`n[ERR] {0} -> {1}" -f $path, $code) -ForegroundColor Red
      $fallback = $resp.Headers['X-Railway-Fallback']
      if ($fallback) { $global:FallbackDetected = $true; Write-Host ("X-Railway-Fallback: {0}" -f $fallback) -ForegroundColor Yellow }
      try { $sr = New-Object System.IO.StreamReader($resp.GetResponseStream()); $body = $sr.ReadToEnd(); Write-Host $body } catch {}
    } else {
      Write-Host ("`n[ERR] {0} -> {1}" -f $path, $_.Exception.Message) -ForegroundColor Red
    }
  }
}

Test-Endpoint "/health"
Test-Endpoint "/health/db"
Test-Endpoint "/admin/overview" @{ "x-admin-token" = $AdminToken }

if ($global:OkCount -ge 2 -and -not $global:FallbackDetected) {
  Write-Host "`nSummary: Backend looks healthy (no Railway fallback)." -ForegroundColor Green
} elseif ($global:FallbackDetected) {
  Write-Host "`nSummary: Detected X-Railway-Fallback. Service not routed or not started." -ForegroundColor Yellow
  Write-Host "Action: In Railway → Settings → Build, ensure Builder=Dockerfile and path=backend/Dockerfile (Node20). Clear cache and Redeploy. Do not set PORT; set DATABASE_URL/CORS_ORIGIN." -ForegroundColor Yellow
} else {
  Write-Host "`nSummary: Endpoints failing. Check build logs for Node version (should be 20) and Prisma generation." -ForegroundColor Red
}

Write-Host '`nVerification finished. If you see X-Railway-Fallback or 404, check Builder/Start/Root/Variables and redeploy.' -ForegroundColor Yellow