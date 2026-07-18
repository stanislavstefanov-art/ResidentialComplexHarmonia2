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

# ── Phase 0: Pre-flight ───────────────────────────────────────────────────────
Write-Phase 'Phase 0: Pre-flight checks'

try {
    $account = az account show --output json | ConvertFrom-Json
    Write-Ok "Azure CLI authenticated (subscription: $($account.name))"
} catch {
    Write-Error "Run 'az login' first."
    throw
}

try {
    gh auth status 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { throw }
    Write-Ok 'GitHub CLI authenticated'
} catch {
    Write-Error "Run 'gh auth login' first."
    throw
}

try {
    az group create --name $ResourceGroup --location $Location --output none
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
    $AcsConnectionString    = Read-Host 'ACS connection string'
    $AcsSenderAddress       = Read-Host 'ACS sender address'
} catch {
    Write-Error "Phase 1 (collect inputs) failed: $_"
    throw
}

# ── Phase 2: Bicep deployment ─────────────────────────────────────────────────
Write-Phase 'Phase 2: Deploying infrastructure (this may take several minutes)'

try {
    $sqlPass = ConvertFrom-SecureString $SqlAdminPasswordSecure -AsPlainText
    $deployOutput = az deployment group create `
        --name $DeploymentName `
        --resource-group $ResourceGroup `
        --template-file infra/main.bicep `
        --parameters "@infra/main.parameters.json" `
        --parameters "sqlAdminPassword=$sqlPass" `
        --output json | ConvertFrom-Json
    Remove-Variable sqlPass
} catch {
    Remove-Variable sqlPass -ErrorAction SilentlyContinue
    Write-Error "Phase 2 (Bicep deployment) failed: $_"
    throw
}

$kvName   = $deployOutput.properties.outputs.keyVaultName.value
$clientId = $deployOutput.properties.outputs.managedIdentityClientId.value
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

        $publicKeyBytes  = [byte[]]@(0x04) + $params.Q.X + $params.Q.Y
        $privateKeyBytes = $params.D

        $vapidPublicKey  = ConvertTo-Base64Url $publicKeyBytes
        $vapidPrivateKey = ConvertTo-Base64Url $privateKeyBytes

        Write-Ok 'VAPID keys generated'

        az keyvault secret set --vault-name $kvName --name 'Vapid--Subject'    --value $VapidSubject    --output none
        az keyvault secret set --vault-name $kvName --name 'Vapid--PublicKey'  --value $vapidPublicKey  --output none
        az keyvault secret set --vault-name $kvName --name 'Vapid--PrivateKey' --value $vapidPrivateKey --output none
        Write-Ok '3 VAPID secrets written'
    } catch {
        Write-Error "Phase 3 (VAPID secrets) failed: $_"
        throw
    }
}

try {
    az keyvault secret set --vault-name $kvName --name 'Acs--ConnectionString' --value $AcsConnectionString --output none
    az keyvault secret set --vault-name $kvName --name 'Acs--SenderAddress'    --value $AcsSenderAddress    --output none
    Write-Ok '2 ACS secrets written'
} catch {
    Write-Error "Phase 3 (ACS secrets) failed: $_"
    throw
}

# ── Phase 4: GitHub secrets ───────────────────────────────────────────────────
Write-Phase 'Phase 4: Setting GitHub secrets'

try {
    $tenantId       = az account show --query tenantId -o tsv
    $subscriptionId = az account show --query id       -o tsv
    $angularToken   = az staticwebapp secrets list `
                          --name $AngularSwaName `
                          --resource-group $ResourceGroup `
                          --query 'properties.apiKey' -o tsv
    $reactToken     = az staticwebapp secrets list `
                          --name $ReactSwaName `
                          --resource-group $ResourceGroup `
                          --query 'properties.apiKey' -o tsv

    gh secret set 'AZURE_CLIENT_ID'          --body $clientId
    gh secret set 'AZURE_TENANT_ID'          --body $tenantId
    gh secret set 'AZURE_SUBSCRIPTION_ID'    --body $subscriptionId
    gh secret set 'ANGULAR_SWA_DEPLOY_TOKEN' --body $angularToken
    gh secret set 'REACT_SWA_DEPLOY_TOKEN'   --body $reactToken

    Write-Ok '5 GitHub secrets set'
} catch {
    Write-Error "Phase 4 (GitHub secrets) failed: $_"
    throw
}

Write-Host "`nAll done. Push a commit to master to trigger the first CD run." -ForegroundColor Green
