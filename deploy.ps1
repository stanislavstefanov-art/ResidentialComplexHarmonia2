#Requires -Version 7
[CmdletBinding()]
param(
    [switch]$Force
)

$ErrorActionPreference = 'Stop'

# ── Constants ────────────────────────────────────────────────────────────────
$ResourceGroup  = 'rg-residence-harmonia-prod'
$Location       = 'westeurope'
$AngularSwaName = 'harmonia-angular-swa'
$ReactSwaName   = 'harmonia-react-swa'
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

$tmpParam = $null
try {
    $sqlPass   = ConvertFrom-SecureString $SqlAdminPasswordSecure -AsPlainText
    $paramObj  = @{
        '$schema'      = 'https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#'
        contentVersion = '1.0.0.0'
        parameters     = @{ sqlAdminPassword = @{ value = $sqlPass } }
    }
    Remove-Variable sqlPass
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

# ── Phase 3: Key Vault secrets ────────────────────────────────────────────────
Write-Phase 'Phase 3: Populating Key Vault secrets'

az keyvault secret show --vault-name $kvName --name 'Vapid--PublicKey' --output none 2>&1 | Out-Null
$skipVapid = ($LASTEXITCODE -eq 0) -and (-not $Force)

if ($skipVapid) {
    Write-Host '  VAPID secrets already present. Use -Force to regenerate.' -ForegroundColor Yellow
} else {
    try {
        $ecdsa  = [System.Security.Cryptography.ECDsa]::Create(
                      [System.Security.Cryptography.ECCurve]::NamedCurves.nistP256)
        $params = $ecdsa.ExportParameters($true)
        $ecdsa.Dispose()

        $buf = [System.Collections.Generic.List[byte]]::new()
        $buf.Add([byte]0x04)
        $buf.AddRange([byte[]]$params.Q.X)
        $buf.AddRange([byte[]]$params.Q.Y)
        $publicKeyBytes  = $buf.ToArray()
        $privateKeyBytes = [byte[]]$params.D

        $vapidPublicKey  = ConvertTo-Base64Url $publicKeyBytes
        $vapidPrivateKey = ConvertTo-Base64Url $privateKeyBytes
        Remove-Variable publicKeyBytes, privateKeyBytes -ErrorAction SilentlyContinue

        Write-Ok 'VAPID keys generated'

        az keyvault secret set --vault-name $kvName --name 'Vapid--Subject'    --value $VapidSubject    --output none
        Assert-NativeSuccess 'az keyvault secret set Vapid--Subject'
        az keyvault secret set --vault-name $kvName --name 'Vapid--PublicKey'  --value $vapidPublicKey  --output none
        Assert-NativeSuccess 'az keyvault secret set Vapid--PublicKey'
        az keyvault secret set --vault-name $kvName --name 'Vapid--PrivateKey' --value $vapidPrivateKey --output none
        Assert-NativeSuccess 'az keyvault secret set Vapid--PrivateKey'
        Remove-Variable vapidPrivateKey -ErrorAction SilentlyContinue
        Write-Ok '3 VAPID secrets written'
    } catch {
        Write-Error "Phase 3 (VAPID secrets) failed: $_"
        throw
    }
}

Write-Ok 'ACS secrets written by Bicep deployment'

# ── Phase 4: GitHub secrets ───────────────────────────────────────────────────
Write-Phase 'Phase 4: Setting GitHub secrets'

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
    Write-Error "Phase 4 (GitHub secrets) failed: $_"
    throw
}

Write-Host "`nAll done. Push a commit to master to trigger the first CD run." -ForegroundColor Green
