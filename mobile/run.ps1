$envFile = Join-Path (Split-Path $PSScriptRoot -Parent) '.env.local'
if (-not (Test-Path $envFile)) {
  Write-Error '.env.local was not found beside the website.'
  exit 1
}

$url = ''
$key = ''
Get-Content $envFile | ForEach-Object {
  if ($_ -match '^\s*VITE_SUPABASE_URL=(.*)$') { $url = $Matches[1].Trim().Trim('"') }
  if ($_ -match '^\s*VITE_SUPABASE_ANON_KEY=(.*)$') { $key = $Matches[1].Trim().Trim('"') }
}
if (-not $url -or -not $key) {
  Write-Error '.env.local needs VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
  exit 1
}

Set-Location $PSScriptRoot
flutter run --dart-define=SUPABASE_URL=$url --dart-define=SUPABASE_ANON_KEY=$key @args
