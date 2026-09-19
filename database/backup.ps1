$ErrorActionPreference = "Stop"
$projectRoot = Split-Path $PSScriptRoot -Parent
$envFile = Join-Path $projectRoot ".env.local"
if (!(Test-Path $envFile)) { throw ".env.local não encontrado." }
$databaseUrl = ((Get-Content $envFile | Where-Object { $_ -match '^DATABASE_URL=' } | Select-Object -First 1) -replace '^DATABASE_URL=','').Trim('"')
$backupDir = Join-Path $projectRoot "backups"
New-Item -ItemType Directory -Force $backupDir | Out-Null
$pgDump = (Get-Command pg_dump -ErrorAction SilentlyContinue).Source
if (!$pgDump) { $pgDump = "C:\Program Files\PostgreSQL\18\bin\pg_dump.exe" }
$target = Join-Path $backupDir ("smartbanca-{0}.dump" -f (Get-Date -Format "yyyyMMdd-HHmmss"))
& $pgDump --format=custom --file=$target $databaseUrl
Write-Host "Backup criado em $target"
