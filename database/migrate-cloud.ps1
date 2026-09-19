$ErrorActionPreference = "Stop"

$databaseUrl = if ($env:DATABASE_URL_UNPOOLED) {
  $env:DATABASE_URL_UNPOOLED
} else {
  $env:DATABASE_URL
}

if (-not $databaseUrl) {
  throw "DATABASE_URL_UNPOOLED ou DATABASE_URL nao foi definida."
}

$psql = "C:\Program Files\PostgreSQL\18\bin\psql.exe"
if (-not (Test-Path -LiteralPath $psql)) {
  $command = Get-Command psql -ErrorAction SilentlyContinue
  if (-not $command) {
    throw "psql nao foi encontrado."
  }
  $psql = $command.Source
}

$schemaExists = (& $psql $databaseUrl -X -q -t -A -c "SELECT to_regclass('public.app_user') IS NOT NULL;").Trim()
if ($LASTEXITCODE -ne 0) {
  throw "Nao foi possivel consultar o banco."
}

if ($schemaExists -ne "t") {
  & $psql $databaseUrl -X -v ON_ERROR_STOP=1 -f "database/schema.sql"
  if ($LASTEXITCODE -ne 0) {
    throw "Falha ao aplicar database/schema.sql."
  }
}

Get-ChildItem -LiteralPath "database/migrations" -Filter "*.sql" |
  Sort-Object Name |
  ForEach-Object {
    & $psql $databaseUrl -X -v ON_ERROR_STOP=1 -f $_.FullName
    if ($LASTEXITCODE -ne 0) {
      throw "Falha ao aplicar $($_.Name)."
    }
  }

$verification = (& $psql $databaseUrl -X -q -t -A -c "SELECT count(*) || ' tabelas; ' || (SELECT count(*) FROM pg_policies WHERE schemaname = 'public') || ' politicas' FROM information_schema.tables WHERE table_schema = 'public';").Trim()
if ($LASTEXITCODE -ne 0) {
  throw "Nao foi possivel verificar o banco."
}

Write-Output "Banco atualizado com sucesso: $verification."
