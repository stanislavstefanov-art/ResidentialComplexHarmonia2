#Requires -Version 7
[CmdletBinding(SupportsShouldProcess)]
param(
    [switch]$SkipGitHubSecrets,
    [switch]$Force
)

$ErrorActionPreference = 'Stop'

# ── Constants ────────────────────────────────────────────────────────────────
$ResourceGroup = 'rg-residence-harmonia-prod'

$GitHubSecrets = @(
    'AZURE_CLIENT_ID'
    'AZURE_TENANT_ID'
    'AZURE_SUBSCRIPTION_ID'
    'ANGULAR_SWA_DEPLOY_TOKEN'
    'REACT_SWA_DEPLOY_TOKEN'
)

# ── Helpers ──────────────────────────────────────────────────────────────────
function Write-Phase([string]$title) {
    Write-Host "`n=== $title ===" -ForegroundColor Cyan
}

function Write-Ok([string]$msg) {
    Write-Host "  [OK] $msg" -ForegroundColor Green
}

function Write-Warn([string]$msg) {
    Write-Host "  [WARN] $msg" -ForegroundColor Yellow
}

# ── Pre-flight ────────────────────────────────────────────────────────────────
Write-Phase 'Pre-flight checks'

try {
    $account        = az account show --output json | ConvertFrom-Json
    $SubscriptionId = $account.id
    Write-Ok "Azure CLI authenticated (subscription: $($account.name) / $SubscriptionId)"
} catch {
    Write-Error "Run 'az login' first. ($_)"
    throw
}

if (-not $SkipGitHubSecrets) {
    try {
        $ghStatusOut = gh auth status 2>&1
        if ($LASTEXITCODE -ne 0) { throw $ghStatusOut }
        Write-Ok 'GitHub CLI authenticated'
    } catch {
        Write-Warn "GitHub CLI not authenticated — will skip GitHub secret removal. ($_)"
        $SkipGitHubSecrets = $true
    }
}

# ── Confirm ───────────────────────────────────────────────────────────────────
Write-Host ''
Write-Host '  This will PERMANENTLY DELETE:' -ForegroundColor Red
Write-Host "    * Resource group '$ResourceGroup' and ALL resources inside it:" -ForegroundColor Red
Write-Host '        - Container App + Container App Environment' -ForegroundColor Red
Write-Host '        - Azure Container Registry (residenceharmoniaacr)' -ForegroundColor Red
Write-Host '        - Azure SQL Server + database' -ForegroundColor Red
Write-Host '        - Key Vault (residenceharmoniakv) — soft-delete will apply' -ForegroundColor Red
Write-Host '        - Azure Communication Services' -ForegroundColor Red
Write-Host '        - Static Web Apps (angular + react)' -ForegroundColor Red
Write-Host '        - Managed Identity' -ForegroundColor Red
if (-not $SkipGitHubSecrets) {
    Write-Host "    * GitHub repository secrets: $($GitHubSecrets -join ', ')" -ForegroundColor Red
}
Write-Host ''

if (-not $Force) {
    $confirmation = Read-Host "  Type 'undeploy' to confirm"
    if ($confirmation -ne 'undeploy') {
        Write-Host '  Aborted.' -ForegroundColor Yellow
        exit 0
    }
}

# ── Delete resource group ────────────────────────────────────────────────────
Write-Phase 'Deleting resource group (this may take several minutes)'

$rgExists = az group exists --name $ResourceGroup --subscription $SubscriptionId | ConvertFrom-Json
if (-not $rgExists) {
    Write-Warn "Resource group '$ResourceGroup' does not exist — nothing to delete."
} else {
    az group delete `
        --name $ResourceGroup `
        --subscription $SubscriptionId `
        --yes `
        --no-wait
    if ($LASTEXITCODE -ne 0) {
        Write-Error "az group delete failed (exit $LASTEXITCODE)"
        throw "Resource group deletion failed."
    }
    Write-Ok "Deletion of '$ResourceGroup' queued (--no-wait). Resources will be gone within a few minutes."
    Write-Warn "Key Vault 'residenceharmoniakv' enters soft-delete (90-day retention). To purge immediately:"
    Write-Host "    az keyvault purge --name residenceharmoniakv --location westeurope --subscription $SubscriptionId" -ForegroundColor Gray
}

# ── Remove GitHub secrets ─────────────────────────────────────────────────────
if (-not $SkipGitHubSecrets) {
    Write-Phase 'Removing GitHub secrets'
    foreach ($secret in $GitHubSecrets) {
        gh secret delete $secret 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-Ok "Removed secret: $secret"
        } else {
            Write-Warn "Secret '$secret' not found or already removed."
        }
    }
}

Write-Host ''
Write-Host 'Undeploy complete.' -ForegroundColor Green
if ($rgExists) {
    Write-Host "Monitor deletion: az group show --name $ResourceGroup --subscription $SubscriptionId --query properties.provisioningState -o tsv" -ForegroundColor Gray
}
