#Requires -Version 7
[CmdletBinding()]
param(
    [switch]$Force
)

$ErrorActionPreference = 'Stop'

# ── Constants ────────────────────────────────────────────────────────────────
$ResourceGroup  = 'rg-residence-harmonia-prod'
$Location       = 'westeurope'
$AngularSwaName = 'residenceharmonia-angular-swa'
$ReactSwaName   = 'residenceharmonia-react-swa'
$KeyVaultName   = 'residenceharmoniakv'
$AcrName        = 'residenceharmoniaacr'
$AcrImageName   = 'residenceharmonia-api'
$DeploymentName = 'harmonia-main'

# ── Helpers ──────────────────────────────────────────────────────────────────
function Write-Phase([string]$title) {
    Write-Host "`n=== $title ===" -ForegroundColor Cyan
}

function Write-Ok([string]$msg) {
    Write-Host "  [OK] $msg" -ForegroundColor Green
}

function ConvertTo-Base64Url([byte[]]$bytes) {
    [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
}

function Assert-NativeSuccess([string]$context) {
    if ($LASTEXITCODE -ne 0) { throw "$context failed (exit $LASTEXITCODE)" }
}

# ── Phase 0: Pre-flight ───────────────────────────────────────────────────────
Write-Phase 'Phase 0: Pre-flight checks'

try {
    $account = az account show --output json | ConvertFrom-Json
    Write-Ok "Azure CLI authenticated (subscription: $($account.name))"
} catch {
    Write-Error "Run 'az login' first. ($_)"
    throw
}

try {
    $ghStatusOut = gh auth status 2>&1
    if ($LASTEXITCODE -ne 0) { throw $ghStatusOut }
    Write-Ok 'GitHub CLI authenticated'
} catch {
    Write-Error "Run 'gh auth login' first. ($_)"
    throw
}

try {
    az group create --name $ResourceGroup --location $Location --output none
    Assert-NativeSuccess 'az group create'
    Write-Ok "Resource group '$ResourceGroup' ready"
} catch {
    Write-Error "Phase 0 (resource group) failed: $_"
    throw
}

# ── Phase 1: Collect inputs ───────────────────────────────────────────────────
Write-Phase 'Phase 1: Collecting inputs'

try {
    $SqlAdminPasswordSecure = Read-Host 'SQL admin password' -AsSecureString
    $VapidSubject           = Read-Host 'VAPID subject (e.g. mailto:ops@harmonia.example)'
} catch {
    Write-Error "Phase 1 (collect inputs) failed: $_"
    throw
}

# ── Phase 2: Bicep deployment ─────────────────────────────────────────────────
Write-Phase 'Phase 2: Deploying infrastructure (this may take several minutes)'

# VAPID keys must exist in Key Vault before the Container App revision is created,
# so we generate (or re-read) them here and pass as Bicep secure parameters.
az keyvault secret show --vault-name $KeyVaultName --name 'Vapid--PublicKey' --output none 2>&1 | Out-Null
$vapidExists = ($LASTEXITCODE -eq 0)

if ($vapidExists -and (-not $Force)) {
    Write-Host '  Reading existing VAPID keys from Key Vault (use -Force to regenerate).' -ForegroundColor Yellow
    try {
        $vapidPublicKey  = az keyvault secret show --vault-name $KeyVaultName --name 'Vapid--PublicKey'  --query value -o tsv
        Assert-NativeSuccess 'az keyvault secret show (Vapid--PublicKey)'
        $vapidPrivateKey = az keyvault secret show --vault-name $KeyVaultName --name 'Vapid--PrivateKey' --query value -o tsv
        Assert-NativeSuccess 'az keyvault secret show (Vapid--PrivateKey)'
    } catch {
        Write-Error "Failed to read existing VAPID keys from Key Vault: $_"
        throw
    }
} else {
    try {
        $ecdsa  = [System.Security.Cryptography.ECDsa]::Create(
                      [System.Security.Cryptography.ECCurve+NamedCurves]::nistP256)
        $ecParams = $ecdsa.ExportParameters($true)
        $ecdsa.Dispose()

        $buf = [System.Collections.Generic.List[byte]]::new()
        $buf.Add([byte]0x04)
        $buf.AddRange([byte[]]$ecParams.Q.X)
        $buf.AddRange([byte[]]$ecParams.Q.Y)
        $publicKeyBytes  = $buf.ToArray()
        $privateKeyBytes = [byte[]]$ecParams.D

        $vapidPublicKey  = ConvertTo-Base64Url $publicKeyBytes
        $vapidPrivateKey = ConvertTo-Base64Url $privateKeyBytes
        Remove-Variable publicKeyBytes, privateKeyBytes -ErrorAction SilentlyContinue
        Write-Ok 'VAPID keys generated'
    } catch {
        Write-Error "VAPID key generation failed: $_"
        throw
    }
}

# Container App requires an image in ACR at revision-creation time.
# On first deploy ACR is empty, so we use a public placeholder and let CI/CD replace it.
az acr repository show --name $AcrName --repository $AcrImageName --output none 2>&1 | Out-Null
$useBootstrapImage = ($LASTEXITCODE -ne 0)
if ($useBootstrapImage) {
    Write-Host '  ACR image not found — deploying with placeholder image.' -ForegroundColor Yellow
    Write-Host '  Push a commit to master after this script completes to trigger CI/CD and deploy the real image.' -ForegroundColor Yellow
}

$tmpParam = $null
try {
    $sqlPass  = ConvertFrom-SecureString $SqlAdminPasswordSecure -AsPlainText
    $paramObj = @{
        '$schema'      = 'https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#'
        contentVersion = '1.0.0.0'
        parameters     = @{
            sqlAdminPassword  = @{ value = $sqlPass }
            vapidSubject      = @{ value = $VapidSubject }
            vapidPublicKey    = @{ value = $vapidPublicKey }
            vapidPrivateKey   = @{ value = $vapidPrivateKey }
            useBootstrapImage = @{ value = $useBootstrapImage }
        }
    }
    Remove-Variable sqlPass, vapidPrivateKey -ErrorAction SilentlyContinue
    $tmpParam = [System.IO.Path]::GetTempFileName() + '.json'
    ConvertTo-Json $paramObj -Depth 5 -Compress | Set-Content -Path $tmpParam -Encoding utf8
    Remove-Variable paramObj
    $deployOutput = az deployment group create `
        --name $DeploymentName `
        --resource-group $ResourceGroup `
        --template-file infra/main.bicep `
        --parameters "@infra/main.parameters.json" `
        --parameters "@$tmpParam" `
        --output json | ConvertFrom-Json
} catch {
    Write-Error "Phase 2 (Bicep deployment) failed: $_"
    throw
} finally {
    if ($tmpParam -and (Test-Path $tmpParam)) { Remove-Item $tmpParam -Force }
}

$kvName   = $deployOutput.properties.outputs.keyVaultName.value
$clientId = $deployOutput.properties.outputs.managedIdentityClientId.value
if ([string]::IsNullOrWhiteSpace($kvName)) {
    throw "Deployment did not return 'keyVaultName' output — check infra/main.bicep outputs."
}
if ([string]::IsNullOrWhiteSpace($clientId)) {
    throw "Deployment did not return 'managedIdentityClientId' output — check infra/main.bicep outputs."
}
Write-Ok "Deployment complete. Key Vault: $kvName, Client ID: $clientId"
Write-Ok 'All secrets (VAPID + ACS + SQL connection string) written by Bicep'

# ── Phase 3: GitHub secrets ───────────────────────────────────────────────────
Write-Phase 'Phase 3: Setting GitHub secrets'

try {
    $tenantId       = az account show --query tenantId -o tsv
    Assert-NativeSuccess 'az account show (tenantId)'
    $subscriptionId = az account show --query id -o tsv
    Assert-NativeSuccess 'az account show (subscriptionId)'
    $angularToken   = az staticwebapp secrets list `
                          --name $AngularSwaName `
                          --resource-group $ResourceGroup `
                          --query 'properties.apiKey' -o tsv
    Assert-NativeSuccess 'az staticwebapp secrets list (angular)'
    $reactToken     = az staticwebapp secrets list `
                          --name $ReactSwaName `
                          --resource-group $ResourceGroup `
                          --query 'properties.apiKey' -o tsv
    Assert-NativeSuccess 'az staticwebapp secrets list (react)'

    gh secret set 'AZURE_CLIENT_ID'          --body $clientId
    Assert-NativeSuccess 'gh secret set AZURE_CLIENT_ID'
    gh secret set 'AZURE_TENANT_ID'          --body $tenantId
    Assert-NativeSuccess 'gh secret set AZURE_TENANT_ID'
    gh secret set 'AZURE_SUBSCRIPTION_ID'    --body $subscriptionId
    Assert-NativeSuccess 'gh secret set AZURE_SUBSCRIPTION_ID'
    gh secret set 'ANGULAR_SWA_DEPLOY_TOKEN' --body $angularToken
    Assert-NativeSuccess 'gh secret set ANGULAR_SWA_DEPLOY_TOKEN'
    gh secret set 'REACT_SWA_DEPLOY_TOKEN'   --body $reactToken
    Assert-NativeSuccess 'gh secret set REACT_SWA_DEPLOY_TOKEN'

    Write-Ok '5 GitHub secrets set'
} catch {
    Write-Error "Phase 3 (GitHub secrets) failed: $_"
    throw
}

Write-Host "`nAll done. Push a commit to master to trigger the first CD run." -ForegroundColor Green
