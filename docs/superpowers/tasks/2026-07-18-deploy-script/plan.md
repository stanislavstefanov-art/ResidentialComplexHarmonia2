# deploy.ps1 — First-Deployment Automation Script Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create `deploy.ps1` at the repo root — a one-shot PowerShell 7 script that provisions Azure infrastructure, generates and stores VAPID keys and ACS secrets in Key Vault, and sets five GitHub Actions secrets, so that every subsequent push to master triggers the CD pipeline with no further manual steps.

**Architecture:** Single script, four sequential phases (pre-flight → inputs → Bicep deploy → KV secrets → GitHub secrets). `$ErrorActionPreference = 'Stop'` ensures any `az` or `gh` failure aborts immediately. VAPID keys are generated in-process using .NET `ECDsa` (P-256) — no external tools. The KV secret write is idempotent by default (skips VAPID if already present); use `-Force` to regenerate.

**Tech Stack:** PowerShell 7 (`pwsh`), Azure CLI (`az`), GitHub CLI (`gh`), .NET `System.Security.Cryptography.ECDsa`.

---

## File map

| File | Action |
|---|---|
| `deploy.ps1` | Create at repo root |

---

### Task 1: Create `deploy.ps1`

**Files:**
- Create: `deploy.ps1`

No automated tests exist for this script (it talks to live Azure and GitHub). Verification is by structural inspection only — do NOT attempt to run the script against real Azure resources.

- [ ] **Step 1: Create `deploy.ps1` with the complete content below**

```powershell
#Requires -Version 7
[CmdletBinding()]
param(
    [switch]$Force
)

$ErrorActionPreference = 'Stop'

# ── Constants ────────────────────────────────────────────────────────────────
$ResourceGroup  = 'rg-residence-harmonia-prod'
$Location       = 'westeurope'
$KeyVaultName   = 'harmoniakv'
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

$SqlAdminPasswordSecure = Read-Host 'SQL admin password' -AsSecureString
$VapidSubject           = Read-Host 'VAPID subject (e.g. mailto:ops@harmonia.example)'
$AcsConnectionString    = Read-Host 'ACS connection string'
$AcsSenderAddress       = Read-Host 'ACS sender address'

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
```

- [ ] **Step 2: Verify by inspection — check all of the following**

Read `deploy.ps1` and confirm:

1. First line is `#Requires -Version 7`
2. `$ErrorActionPreference = 'Stop'` is set before any phase
3. Phase 0 checks `az account show` AND `gh auth status` AND creates the resource group
4. Phase 1 uses `Read-Host -AsSecureString` for the SQL password and plain `Read-Host` for the other three
5. Phase 2 calls `ConvertFrom-SecureString $SqlAdminPasswordSecure -AsPlainText` into `$sqlPass`, passes it to `az deployment group create`, and calls `Remove-Variable sqlPass` immediately after (both in the try and catch blocks)
6. Phase 3 checks `LASTEXITCODE` after `az keyvault secret show` to determine `$skipVapid` — does NOT use a try/catch for the existence check
7. Phase 3 VAPID generation: `[byte[]]@(0x04) + $params.Q.X + $params.Q.Y` for the public key, `$params.D` for the private key
8. `ConvertTo-Base64Url` trims `=` padding and replaces `+`→`-` and `/`→`_`
9. Phase 3 always writes the 2 ACS secrets regardless of `$skipVapid`
10. Phase 4 sets exactly 5 GitHub secrets: `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`, `ANGULAR_SWA_DEPLOY_TOKEN`, `REACT_SWA_DEPLOY_TOKEN`
11. `$clientId` comes from `$deployOutput.properties.outputs.managedIdentityClientId.value` (Phase 2), not from `az account show`
12. The success message at the end reads: `"All done. Push a commit to master to trigger the first CD run."`

- [ ] **Step 3: Commit**

```bash
git add deploy.ps1
git commit -m "feat(ops): add deploy.ps1 first-deployment automation script"
```

---

## Post-implementation notes (for the human running the script)

**Prerequisites before running `deploy.ps1`:**
- `az login` (logged in to the correct Azure subscription)
- `gh auth login` (logged in to the GitHub account that owns the repo)
- PowerShell 7 (`pwsh`)
- Azure CLI and GitHub CLI installed

**Run from repo root:**
```powershell
pwsh -File deploy.ps1
```

**Re-run safely:**
```powershell
pwsh -File deploy.ps1          # skips VAPID if already in Key Vault
pwsh -File deploy.ps1 -Force   # regenerates VAPID keys
```

**What the script does NOT do:**
- Provision the ACS resource (user must create it separately and paste the connection string)
- Configure Entra B2C (deferred per ADR-0001)
- Push code or trigger CI/CD (just push any commit to master after running the script)
