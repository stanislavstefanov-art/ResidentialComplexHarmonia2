#Requires -Version 7
<#
.SYNOPSIS
    Idempotent local dev startup for Harmonia.
    Run once to set everything up; run again after a reboot to restart everything.

.DESCRIPTION
    1. Starts (or creates) the SQL Server Podman container.
    2. Waits until SQL Server accepts connections.
    3. Creates the Harmonia database and applies db/schema.sql (both idempotent).
    4. Generates src/Harmonia.Api/appsettings.Development.local.json if missing,
       including auto-generated VAPID keys.
    5. Launches the API, Angular, and React servers in separate terminal windows.
#>

$ErrorActionPreference = 'Stop'

$RepoRoot    = $PSScriptRoot
$SchemaFile  = Join-Path $RepoRoot 'db\schema.sql'
$LocalConfig = Join-Path $RepoRoot 'src\Harmonia.Api\appsettings.Development.local.json'

$SA_PASSWORD = 'Dev_Password1'
$DB_NAME     = 'Harmonia'
$CONTAINER   = 'harmonia-sql'
$SQLCMD      = '/opt/mssql-tools18/bin/sqlcmd'

function Write-Step([string]$Label) {
    Write-Host "`n$Label" -ForegroundColor Cyan
}

function Invoke-SqlCmd([string]$Query, [string]$Database = 'master') {
    podman exec $CONTAINER $SQLCMD `
        -S localhost -U sa -P $SA_PASSWORD -No `
        -d $Database -Q $Query | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "SQL failed: $Query" }
}

# ── 1. SQL Server container ────────────────────────────────────────────────
Write-Step '[1/5] SQL Server container'

$state = podman inspect --format '{{.State.Status}}' $CONTAINER 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host '  Container not found — creating...'
    podman run -d --name $CONTAINER `
        -e ACCEPT_EULA=Y `
        -e MSSQL_SA_PASSWORD=$SA_PASSWORD `
        -p 127.0.0.1:1433:1433 `
        mcr.microsoft.com/mssql/server:2022-latest | Out-Null
    Write-Host '  Created.'
} elseif ($state.Trim() -ne 'running') {
    Write-Host '  Container exists but is stopped — starting...'
    podman start $CONTAINER | Out-Null
    Write-Host '  Started.'
} else {
    Write-Host '  Already running.'
}

# ── 2. Wait for SQL Server to accept connections ───────────────────────────
Write-Step '[2/5] Waiting for SQL Server'

$ready = $false
for ($i = 1; $i -le 30; $i++) {
    podman exec $CONTAINER $SQLCMD `
        -S localhost -U sa -P $SA_PASSWORD -No -Q 'SELECT 1' 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) { $ready = $true; break }
    Write-Host "  Not ready yet ($i/30) — retrying in 2 s..."
    Start-Sleep 2
}
if (-not $ready) { throw 'SQL Server did not become ready within 60 s.' }
Write-Host '  Ready.'

# ── 3. Database + schema ───────────────────────────────────────────────────
Write-Step '[3/5] Database + schema'

Invoke-SqlCmd "IF DB_ID('$DB_NAME') IS NULL CREATE DATABASE [$DB_NAME]"
Write-Host "  Database '$DB_NAME' ensured."

podman cp $SchemaFile "${CONTAINER}:/tmp/schema.sql" | Out-Null
podman exec $CONTAINER $SQLCMD `
    -S localhost -U sa -P $SA_PASSWORD -No `
    -d $DB_NAME -i /tmp/schema.sql | Out-Null
Write-Host '  Schema applied (all statements are idempotent).'

# ── 4. Local config (connection strings + VAPID keys) ─────────────────────
Write-Step '[4/5] Local config'

if (Test-Path $LocalConfig) {
    Write-Host "  $LocalConfig already exists — skipping."
} else {
    Write-Host '  Generating VAPID keys via web-push...'
    $vapidLines = @(npx --yes web-push generate-vapid-keys 2>$null) |
                  ForEach-Object { $_.Trim() } |
                  Where-Object    { $_ -ne '' }

    $publicKey = $privateKey = ''
    for ($i = 0; $i -lt $vapidLines.Count; $i++) {
        if ($vapidLines[$i] -eq 'Public Key:')  { $publicKey  = $vapidLines[$i + 1] }
        if ($vapidLines[$i] -eq 'Private Key:') { $privateKey = $vapidLines[$i + 1] }
    }
    if (-not $publicKey -or -not $privateKey) {
        throw 'Could not parse VAPID keys from web-push output.'
    }

    $cs = "Server=127.0.0.1,1433;Database=$DB_NAME;User Id=sa;Password=$SA_PASSWORD;TrustServerCertificate=True;"

    @{
        ConnectionStrings = @{
            Reservations    = $cs
            MaintenanceFees = $cs
            Expenses        = $cs
            Payments        = $cs
            Notifications   = $cs
            Directory       = $cs
        }
        Vapid = @{
            Subject    = 'mailto:dev@example.com'
            PublicKey  = $publicKey
            PrivateKey = $privateKey
        }
        Acs = @{
            ConnectionString = 'placeholder'
            SenderAddress    = 'noreply@example.com'
        }
    } | ConvertTo-Json -Depth 4 | Set-Content $LocalConfig -Encoding UTF8

    Write-Host "  Created $LocalConfig"
}

# ── 5. Launch servers ──────────────────────────────────────────────────────
Write-Step '[5/5] Launching servers'

$launch = {
    param($Title, $WorkDir, $Command)
    Start-Process pwsh -ArgumentList @(
        '-NoProfile', '-NoExit', '-Command',
        "& { `$host.UI.RawUI.WindowTitle = '$Title'; Set-Location '$WorkDir'; $Command }"
    )
}

& $launch 'Harmonia API'     $RepoRoot                                'dotnet run --project src/Harmonia.Api'
& $launch 'Harmonia Angular' "$RepoRoot\ui\angular-prototype"         'npm start'
& $launch 'Harmonia React'   "$RepoRoot\ui\react-prototype"           'npm start'

Write-Host @"

  Three windows are starting up:

    API     → http://localhost:5000   (takes ~5 s to compile)
    Angular → http://localhost:4200   (opens browser automatically)
    React   → http://localhost:3000   (opens browser automatically)

  To stop: close the three server windows and run:
    podman stop $CONTAINER
"@ -ForegroundColor Green
