#requires -Version 5.1
# Portable PostgreSQL control for the SI SARPRAS dev database.
# Nothing is installed to C:, no Windows service, no Docker, no admin rights.
#
#   .\scripts\pg.ps1 init        -> initdb into D:\pgsql\data
#   .\scripts\pg.ps1 start       -> start the server on localhost:5432
#   .\scripts\pg.ps1 createdb    -> create the sisarpras database
#   .\scripts\pg.ps1 status      -> show server status
#   .\scripts\pg.ps1 psql        -> open an interactive psql session
#   .\scripts\pg.ps1 stop        -> stop the server
#   .\scripts\pg.ps1 info        -> print configuration
#
# NOTE: keep this file ASCII-only. Windows PowerShell 5.1 reads a BOM-less file
# as ANSI, so UTF-8 punctuation (em dashes, curly quotes) can be mis-parsed.

param(
  [ValidateSet("init", "start", "stop", "status", "createdb", "psql", "reset-password", "info")]
  [string]$Action = "status",

  [string]$Root = "D:\pgsql",
  [string]$BinDir = "D:\pgsql\pgsql\bin",
  [string]$DataDir = "D:\pgsql\data",
  [string]$LogFile = "D:\pgsql\pg.log",

  [int]$Port = 5432,
  [string]$DbName = "sisarpras",
  [string]$DbUser = "postgres",
  [string]$DbPassword = "postgres"
)

$ErrorActionPreference = "Stop"

function Get-PgExe([string]$Name) {
  $path = Join-Path $BinDir $Name
  if (-not (Test-Path $path)) {
    throw "Cannot find '$path'. Extract the PostgreSQL binaries zip to D:\pgsql first."
  }
  return $path
}

function Assert-Cluster {
  if (-not (Test-Path (Join-Path $DataDir "PG_VERSION"))) {
    throw "Cluster is not initialized yet. Run: .\scripts\pg.ps1 init"
  }
}

function Invoke-WithPassword([scriptblock]$Block) {
  $env:PGPASSWORD = $DbPassword
  try { & $Block } finally { Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue }
}

switch ($Action) {

  "info" {
    Write-Output "root     : $Root"
    Write-Output "binaries : $BinDir"
    Write-Output "data     : $DataDir"
    Write-Output "log      : $LogFile"
    Write-Output "port     : $Port"
    Write-Output "database : $DbName (user $DbUser)"
    Write-Output "bin ok   : $(Test-Path (Join-Path $BinDir 'pg_ctl.exe'))"
    Write-Output "data ok  : $(Test-Path (Join-Path $DataDir 'PG_VERSION'))"
    break
  }

  "init" {
    $initdb = Get-PgExe "initdb.exe"
    if (Test-Path (Join-Path $DataDir "PG_VERSION")) {
      Write-Output "Cluster already exists at '$DataDir' - skipped, existing data left untouched."
      break
    }

    New-Item -ItemType Directory -Force -Path $Root | Out-Null

    # initdb reads the superuser password from a file, not an argument, so it
    # never lands in the process list or the log.
    $pwFile = Join-Path $env:TEMP "sisarpras-pg-init.txt"
    Set-Content -Path $pwFile -Value $DbPassword -Encoding ascii -NoNewline

    $initArgs = @(
      "-D", $DataDir,
      "-U", $DbUser,
      "-E", "UTF8",
      "--locale=C",
      "--auth=scram-sha-256",
      "--pwfile=$pwFile"
    )

    Write-Output "initdb -> $DataDir"
    & $initdb @initArgs
    if ($LASTEXITCODE -ne 0) { throw "initdb failed with exit code $LASTEXITCODE" }
    Write-Output "OK: cluster ready."
    break
  }

  "start" {
    $pgCtl = Get-PgExe "pg_ctl.exe"
    Assert-Cluster
    # Started detached (-WindowStyle Hidden): pg_ctl exits once the server is
    # ready, and the server keeps running after this script returns. The port
    # comes from postgresql.conf (5432 by default).
    $ctlArgs = @("-D", $DataDir, "-l", $LogFile, "-w", "start")
    $proc = Start-Process -FilePath $pgCtl -ArgumentList $ctlArgs -WindowStyle Hidden -PassThru
    if (-not $proc.WaitForExit(60000)) {
      Write-Output "pg_ctl is still running; check $LogFile"
    }
    Start-Sleep -Seconds 1
    & $pgCtl -D $DataDir status
    break
  }

  "stop" {
    $pgCtl = Get-PgExe "pg_ctl.exe"
    Assert-Cluster
    & $pgCtl -D $DataDir -m fast -w stop
    Write-Output "OK: PostgreSQL stopped."
    break
  }

  "status" {
    $pgCtl = Get-PgExe "pg_ctl.exe"
    Assert-Cluster
    & $pgCtl -D $DataDir status
    break
  }

  "createdb" {
    $createdb = Get-PgExe "createdb.exe"
    Invoke-WithPassword {
      & $createdb -h localhost -p $Port -U $DbUser $DbName
    }
    if ($LASTEXITCODE -eq 0) {
      Write-Output "OK: database '$DbName' created."
    } else {
      Write-Output "createdb exited with code $LASTEXITCODE (usually because the database already exists)."
    }
    break
  }

  "psql" {
    $psql = Get-PgExe "psql.exe"
    Invoke-WithPassword {
      & $psql -h localhost -p $Port -U $DbUser -d $DbName
    }
    break
  }

  "reset-password" {
    $psql = Get-PgExe "psql.exe"
    $sql = "ALTER USER $DbUser WITH PASSWORD '$DbPassword';"
    Invoke-WithPassword {
      & $psql -h localhost -p $Port -U $DbUser -d postgres -c $sql
    }
    Write-Output "OK: password for '$DbUser' reset."
    break
  }
}
