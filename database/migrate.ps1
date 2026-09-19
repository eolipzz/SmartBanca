$ErrorActionPreference = "Stop"
$projectRoot = Split-Path $PSScriptRoot -Parent
$envFile = Join-Path $projectRoot ".env.local"
if (!(Test-Path $envFile)) { throw ".env.local não encontrado." }
$databaseUrl = ((Get-Content $envFile | Where-Object { $_ -match '^DATABASE_URL=' } | Select-Object -First 1) -replace '^DATABASE_URL=','').Trim('"')
if (!$databaseUrl) { throw "DATABASE_URL não configurada." }
$psql = (Get-Command psql -ErrorAction SilentlyContinue).Source
if (!$psql) { $psql = "C:\Program Files\PostgreSQL\18\bin\psql.exe" }
Get-ChildItem (Join-Path $PSScriptRoot "migrations\*.sql") | Sort-Object Name | ForEach-Object { & $psql $databaseUrl -v ON_ERROR_STOP=1 -f $_.FullName }
