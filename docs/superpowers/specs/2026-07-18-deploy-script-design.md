# deploy.ps1 — First-Deployment Automation Script Design

**Date:** 2026-07-18
**Branch:** feat/deploy-script

---

## Goal

A single PowerShell script (`deploy.ps1`) at the repo root that automates all three manual prerequisites for first Azure deployment: provisioning infrastructure, populating Key Vault secrets, and setting GitHub Actions secrets. After running the script, every push to master triggers the CD pipeline with no further manual steps.

---

## 1. File

```
deploy.ps1     — repo root, new file
```

No changes to existing Bicep, CI/CD, or application files.

---

## 2. Script signature

```powershell
[CmdletBinding()]
param(
    [switch]$Force   # re-generate VAPID keys even if they already exist in Key Vault
)
```

The four sensitive inputs are collected interactively during the run (never as parameters, never in shell history).

---

## 3. Fixed constants (derived from Bicep namePrefix = "harmonia")

```powershell
$ResourceGroup    = 'rg-residence-harmonia-prod'
$Location         = 'westeurope'
$KeyVaultName     = 'harmoniakv'
$AngularSwaName   = 'harmonia-angular-swa'
$ReactSwaName     = 'harmonia-react-swa'
$DeploymentName   = 'harmonia-main'
```

---

## 4. Phases

### Phase 0 — Pre-flight

1. `az account show` — fail with `"Run 'az login' first."` if not authenticated.
2. `gh auth status` — fail with `"Run 'gh auth login' first."` if not authenticated.
3. `az group create --name $ResourceGroup --location $Location` — idempotent; no-op if the group already exists.

### Phase 1 — Collect inputs

```
SQL admin password  : Read-Host -AsSecureString
VAPID subject       : Read-Host  (e.g. mailto:ops@harmonia.example)
ACS connection string : Read-Host
ACS sender address  : Read-Host
```

All four are kept in memory only. The SQL password is converted to plaintext immediately before the `az deployment group create` call and the variable is cleared afterwards.

### Phase 2 — Bicep deployment

```powershell
az deployment group create `
  --name $DeploymentName `
  --resource-group $ResourceGroup `
  --template-file infra/main.bicep `
  --parameters "@infra/main.parameters.json" `
  --parameters "sqlAdminPassword=$sqlPass"
```

Extract from deployment outputs:
- `keyVaultName` — used in Phase 3 (`az keyvault secret set`)
- `managedIdentityClientId` — used in Phase 4 as `AZURE_CLIENT_ID`

### Phase 3 — Key Vault secrets

**Idempotency check:** if `Vapid--PublicKey` already exists in Key Vault and `-Force` is not set, skip VAPID generation and secret writes with a notice: `"VAPID secrets already present. Use -Force to regenerate."`. ACS secrets are always written (user provided values for this run).

**VAPID key generation (PowerShell .NET crypto):**

```powershell
$ecdsa  = [System.Security.Cryptography.ECDsa]::Create(
              [System.Security.Cryptography.ECCurve]::NamedCurves.nistP256)
$params = $ecdsa.ExportParameters($true)

# Private key: 32-byte D scalar, base64url
$privateKeyBytes = $params.D

# Public key: uncompressed EC point — 0x04 || X (32 bytes) || Y (32 bytes), base64url
$publicKeyBytes  = [byte[]]@(0x04) + $params.Q.X + $params.Q.Y

function ConvertTo-Base64Url([byte[]]$bytes) {
    [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+','-').Replace('/','_')
}

$vapidPublicKey  = ConvertTo-Base64Url $publicKeyBytes
$vapidPrivateKey = ConvertTo-Base64Url $privateKeyBytes
```

**Secrets written** (5 total):

| Secret name | Value |
|---|---|
| `Vapid--Subject` | `$VapidSubject` (user input) |
| `Vapid--PublicKey` | generated base64url EC public key |
| `Vapid--PrivateKey` | generated base64url EC private key |
| `Acs--ConnectionString` | `$AcsConnectionString` (user input) |
| `Acs--SenderAddress` | `$AcsSenderAddress` (user input) |

All written with:
```powershell
az keyvault secret set --vault-name $KeyVaultName --name '<name>' --value '<value>'
```

### Phase 4 — GitHub secrets

Collect values:
```powershell
$tenantId        = az account show --query tenantId -o tsv
$subscriptionId  = az account show --query id -o tsv
$angularToken    = az staticwebapp secrets list --name $AngularSwaName `
                     --resource-group $ResourceGroup --query "properties.apiKey" -o tsv
$reactToken      = az staticwebapp secrets list --name $ReactSwaName `
                     --resource-group $ResourceGroup --query "properties.apiKey" -o tsv
```

`managedIdentityClientId` comes from Phase 2 deployment outputs.

**Secrets set** (5 total):

| GitHub secret | Value |
|---|---|
| `AZURE_CLIENT_ID` | `managedIdentityClientId` (deployment output) |
| `AZURE_TENANT_ID` | `$tenantId` |
| `AZURE_SUBSCRIPTION_ID` | `$subscriptionId` |
| `ANGULAR_SWA_DEPLOY_TOKEN` | `$angularToken` |
| `REACT_SWA_DEPLOY_TOKEN` | `$reactToken` |

All written with:
```powershell
gh secret set '<name>' --body '<value>'
```

---

## 5. Error handling

`$ErrorActionPreference = 'Stop'` at the top of the script.

Each phase is wrapped in a try/catch block. On failure, the catch block prints which phase failed and re-throws so the caller sees a non-zero exit code:

```powershell
catch {
    Write-Error "Phase 2 (Bicep deployment) failed: $_"
    throw
}
```

---

## 6. Progress output

Each phase prints a clear header on start and a completion line on success:

```
=== Phase 0: Pre-flight checks ===
  ✓ Azure CLI authenticated (subscription: ...)
  ✓ GitHub CLI authenticated
  ✓ Resource group ready

=== Phase 1: Collecting inputs ===
  ...

=== Phase 2: Deploying infrastructure ===
  ✓ Deployment complete. Key Vault: harmoniakv

=== Phase 3: Populating Key Vault secrets ===
  ✓ VAPID keys generated
  ✓ 5 secrets written to harmoniakv

=== Phase 4: Setting GitHub secrets ===
  ✓ 5 GitHub secrets set

All done. Push a commit to master to trigger the first CD run.
```

---

## 7. Security notes

- The SQL admin password is stored in a `SecureString`, converted to plaintext only for the `az` call, and the plaintext variable is cleared immediately after (`Remove-Variable sqlPass`).
- VAPID private key and ACS connection string are never written to disk. They go directly into Key Vault via the Azure CLI.
- The script must not be committed with any hardcoded secrets. The repo already has `*.env` and connection string patterns in `.gitignore`; no additional gitignore changes are needed.
- The script is safe to run multiple times: Phase 2 is an incremental deployment (no-op for unchanged resources), Phase 3 skips VAPID generation if already present, Phase 4 overwrites GitHub secrets (safe to repeat).

---

## 8. Out of scope

- ACS resource provisioning (the ACS instance is assumed to already exist)
- Entra B2C setup (deferred per ADR-0001)
- Rollback / destroy script
- CI/CD triggering from within the script
- Validation of the ACS connection string format
