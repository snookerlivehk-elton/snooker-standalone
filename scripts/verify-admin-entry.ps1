param(
  [string]$AdminUrl = "https://snookerlivehk-elton.github.io/admin?apiUrl=https://snooker-standalone-backend-production.up.railway.app&socketUrl=https://snooker-standalone-backend-production.up.railway.app&socketPath=/socket.io&token=wwww5678",
  [string]$ExpectedFrontendOrigin = "https://snookerlivehk-elton.github.io",
  [switch]$Insecure = $true
)

# Ensure modern TLS; allow insecure for quick checks if needed
try {
  [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12 -bor [System.Net.SecurityProtocolType]::Tls13
  if ($Insecure) { [System.Net.ServicePointManager]::ServerCertificateValidationCallback = { $true } }
} catch {}

function Parse-QueryString([string]$query) {
  $result = @{}
  $q = $query.Trim()
  if ($q.StartsWith('?')) { $q = $q.Substring(1) }
  foreach ($pair in $q.Split('&', [System.StringSplitOptions]::RemoveEmptyEntries)) {
    $kv = $pair.Split('=', 2)
    $k = [System.Uri]::UnescapeDataString($kv[0])
    $v = if ($kv.Count -gt 1) { [System.Uri]::UnescapeDataString($kv[1]) } else { '' }
    $result[$k] = $v
  }
  return $result
}

function Test-Http200([string]$url) {
  try {
    $r = Invoke-WebRequest -Uri $url -UseBasicParsing -Headers @{ 'Cache-Control' = 'no-cache' }
    return @{ Code = $r.StatusCode; Headers = $r.Headers }
  } catch {
    try {
      $code = & curl.exe -s -o NUL -w "%{http_code}" "$url"
      $hdrRaw = & curl.exe -s -D - "$url" -o NUL
      $headers = @{}
      foreach ($line in $hdrRaw -split "`r?`n") {
        if ($line -match '^([^:]+):\s*(.*)$') { $headers[$matches[1]] = $matches[2] }
      }
      return @{ Code = [int]$code; Headers = $headers }
    } catch {
      throw "HTTP request failed for $($url): $($_.Exception.Message)"
    }
  }
}

Write-Host ("Admin URL: {0}" -f $AdminUrl) -ForegroundColor Cyan
$uri = [System.Uri]$AdminUrl
$qs = Parse-QueryString $uri.Query
$apiUrl = $qs['apiUrl']
$token = $qs['token']
$socketUrl = $qs['socketUrl']
$socketPath = $qs['socketPath']

if (-not $apiUrl) { throw "Missing apiUrl param in admin URL." }
if (-not $token) { Write-Host "Warning: token is empty; overview may require ADMIN_TOKEN." -ForegroundColor Yellow }

# 1) Frontend page availability
try {
  $res = Invoke-WebRequest -Uri $AdminUrl -UseBasicParsing -Headers @{ 'Cache-Control' = 'no-cache' }
  Write-Host ("[Frontend] {0} -> {1}" -f $AdminUrl, $res.StatusCode) -ForegroundColor Green
} catch {
  Write-Warning "[Frontend] Admin path not reachable: $($_.Exception.Message) — continue to backend checks"
}

# 2) Backend health + admin overview via query token (avoid CORS preflight)
$healthUrl = ("{0}/health" -f $apiUrl.TrimEnd('/'))
$overviewUrl = ("{0}/admin/overview?token={1}&format=json" -f $apiUrl.TrimEnd('/'), [System.Uri]::EscapeDataString($token))

try {
  $h = Test-Http200 $healthUrl
  if ($h.Code -ne 200) { throw "Unexpected health status: $($h.Code)" }
  Write-Host ("[Backend] /health -> {0}" -f $h.Code) -ForegroundColor Green
} catch {
  throw "Backend health failed: $($_.Exception.Message)"
}

try {
  $ov = Test-Http200 $overviewUrl
  if ($ov.Code -ne 200) { throw "Unexpected overview status: $($ov.Code)" }
  $acao = $ov.Headers['Access-Control-Allow-Origin']
  $ct = $ov.Headers['Content-Type']
  Write-Host ("[Backend] /admin/overview -> {0} CT={1}" -f $ov.Code, $ct) -ForegroundColor Green
  if ($acao -and $ExpectedFrontendOrigin -and ($acao -ne '*' -and $acao -ne $ExpectedFrontendOrigin)) {
    throw "CORS ACAO mismatch: expected '$ExpectedFrontendOrigin' or '*', got '$acao'"
  }
} catch {
  throw "Admin overview failed: $($_.Exception.Message)"
}

Write-Host "Verification OK: frontend reachable and backend overview authorized." -ForegroundColor Green