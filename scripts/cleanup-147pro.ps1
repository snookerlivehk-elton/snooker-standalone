param(
  [string[]]$GithubRepos = @(),
  [string[]]$RailwayProjects = @(),
  [switch]$DryRun
)

$ghExists = (Get-Command gh -ErrorAction SilentlyContinue) -ne $null
$rwExists = (Get-Command railway -ErrorAction SilentlyContinue) -ne $null

if ($GithubRepos.Count -gt 0 -and $ghExists) {
  foreach ($repo in $GithubRepos) {
    if ($DryRun) { Write-Host "gh repo delete $repo --yes" }
    else { gh repo delete $repo --yes }
  }
}

if ($RailwayProjects.Count -gt 0 -and $rwExists) {
  foreach ($proj in $RailwayProjects) {
    if ($DryRun) { Write-Host "railway project delete --project $proj --yes" }
    else { railway project delete --project $proj --yes }
  }
}

Write-Host "Completed."
