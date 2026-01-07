param(
  [string]$FrontendPath = "snooker-standalone/frontend",
  [string]$PagesRepoPath = "deploy-pages",
  [string]$AdminUrl = "https://snookerlivehk-elton.github.io/admin?apiUrl=https://snooker-standalone-backend-production.up.railway.app&socketUrl=https://snooker-standalone-backend-production.up.railway.app&socketPath=/socket.io&token=wwww5678",
  [switch]$SkipBuild
)

$ErrorActionPreference = 'Stop'

function Invoke-Block($Message, [ScriptBlock]$Action) {
  Write-Host $Message -ForegroundColor Cyan
  & $Action
}

if (-not $SkipBuild) {
  Invoke-Block "[Build] Installing deps and building frontend" {
    Push-Location $FrontendPath
    if (Test-Path package-lock.json) { npm ci } else { npm install }
    npm run build
    Pop-Location
  }
}

Invoke-Block "[Sync] Copy dist to Pages repo" {
  $dist = Join-Path $FrontendPath 'dist'
  if (-not (Test-Path $dist)) { throw "Build output not found: $dist" }
  if (-not (Test-Path $PagesRepoPath)) { throw "Pages repo path not found: $PagesRepoPath" }
  Copy-Item -Path (Join-Path $dist '*') -Destination $PagesRepoPath -Recurse -Force
}

Invoke-Block "[Commit] Commit and push Pages repo" {
  Push-Location $PagesRepoPath
  git add -A
  $hasChanges = (git status --porcelain) -ne ''
  if ($hasChanges) {
    git commit -m "chore: update pages assets"
    git push
  } else {
    Write-Host "No changes to push." -ForegroundColor Yellow
  }
  Pop-Location
}

Invoke-Block "[Verify] Running admin link verification" {
  $verifier = "snooker-standalone/scripts/verify-admin-entry.ps1"
  if (-not (Test-Path $verifier)) { throw "Verifier script not found: $verifier" }
  & $verifier -AdminUrl $AdminUrl
}

Write-Host "Deploy + Verify completed successfully." -ForegroundColor Green