param(
  [int]$Bytes = 32,
  [switch]$Hex,
  [switch]$Base64
)

$bytes = New-Object byte[] $Bytes
$rng = New-Object System.Security.Cryptography.RNGCryptoServiceProvider
$rng.GetBytes($bytes)

if ($Hex) {
  $token = ([System.BitConverter]::ToString($bytes)).Replace("-", "").ToLower()
} else {
  $token = [Convert]::ToBase64String($bytes)
}

Write-Host ("Generated ADMIN_TOKEN: {0}" -f $token) -ForegroundColor Green
Write-Host "Set this in your Render service Env Vars as ADMIN_TOKEN." -ForegroundColor Yellow
Write-Host "Example: curl -i https://<your-service>.onrender.com/admin/overview -H \"x-admin-token: $token\"" -ForegroundColor Yellow