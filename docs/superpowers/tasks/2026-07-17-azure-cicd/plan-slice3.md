# Azure CI/CD Slice 3 — Bicep IaC Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create modular Bicep IaC that provisions ACR, Container App (API), SWA × 2, Azure SQL, Key Vault, and OIDC federated identity; and refactor `Program.cs` to use a single `ConnectionStrings:Default`.

**Architecture:** Eight tasks, ordered by dependency: `Program.cs` refactor first (C# change, build-verified), then six Bicep modules written in dependency order (identity → acr/sql/frontend → keyvault → api), each linted with `az bicep build`, then assembled in `main.bicep`. No runtime tests for Bicep — `az bicep build` is the gate per task; an optional `az deployment group what-if` validates against Azure in the final task.

**Tech Stack:** Bicep (via Azure CLI `az bicep`), Azure Container Apps `@2023-05-01`, Azure Container Registry Basic `@2023-07-01`, Azure SQL GP_S_Gen5_1 serverless `@2022-05-01-preview`, Azure Key Vault Standard RBAC `@2023-07-01`, Azure Static Web Apps Standard `@2023-01-01`, .NET 8 minimal API, C#.

---

## File map

| File | Action |
|---|---|
| `src/Harmonia.Api/Program.cs` | Modify — collapse 6 connection strings to `ConnectionStrings:Default` (lines 28–84) |
| `src/Harmonia.Api/appsettings.json` | Modify — replace 6 named keys with single `Default: ""` |
| `infra/modules/identity.bicep` | Create — user-assigned managed identity + OIDC federated credential |
| `infra/modules/acr.bicep` | Create — Azure Container Registry + AcrPull role for API identity |
| `infra/modules/sql.bicep` | Create — SQL Server + serverless database + AllowAzureServices firewall rule |
| `infra/modules/keyvault.bicep` | Create — Key Vault + `ConnectionStrings--Default` secret + Key Vault Secrets User role |
| `infra/modules/frontend.bicep` | Create — Static Web App × 2 (Angular + React) |
| `infra/modules/api.bicep` | Create — Container Apps Environment + Container App with 6 KV secret refs |
| `infra/main.bicep` | Create — orchestrator: all module wiring and outputs |
| `infra/main.parameters.json` | Create — default parameter values (no `sqlAdminPassword`) |

---

### Task 1: `Program.cs` — collapse to single connection string

**Files:**
- Modify: `src/Harmonia.Api/Program.cs` (lines 28–84)
- Modify: `src/Harmonia.Api/appsettings.json` (lines 23–30)

**Context:** `Program.cs` currently reads 6 named connection strings (Reservations, MaintenanceFees, Expenses, Payments, Notifications, Directory), each throwing on missing. Collapse them to one. The integration tests use the `HARMONIA_SQL_CONNSTR` env var directly and instantiate SQL stores without going through `Program.cs`, so they are unaffected by this change.

- [ ] **Step 1: Update `appsettings.json`**

Replace lines 23–30 in `src/Harmonia.Api/appsettings.json`:

Before:
```json
  "ConnectionStrings": {
    "Reservations": "",
    "MaintenanceFees": "",
    "Expenses": "",
    "Payments": "",
    "Notifications": "",
    "Directory": ""
  },
```

After:
```json
  "ConnectionStrings": {
    "Default": ""
  },
```

- [ ] **Step 2: Update `Program.cs` lines 28–84**

Replace the entire block from `var connectionString = builder.Configuration.GetConnectionString("Reservations")` (line 28) through `builder.Services.AddSingleton<IDirectoryStore>(new SqlDirectoryStore(dirConnString));` (line 84) with:

```csharp
var defaultConn = builder.Configuration.GetConnectionString("Default")
    ?? throw new InvalidOperationException(
        "ConnectionStrings:Default is not configured. Supply it via environment " +
        "(ConnectionStrings__Default) or a git-ignored local config file.");

builder.Services.AddSingleton<IReservationStore>(new SqlReservationStore(defaultConn));
builder.Services.AddSingleton<ISlotGrid>(new ConfigSlotGrid(
    builder.Configuration.GetSection("SlotGrid:SlotKeys").Get<string[]>() ?? ["DAY"]));
builder.Services.AddSingleton<IMaintenanceFeeStore>(new SqlMaintenanceFeeStore(defaultConn));
builder.Services.AddSingleton<IExpenseStore>(new SqlExpenseStore(defaultConn));
builder.Services.AddSingleton<IPaymentStore>(new SqlPaymentStore(defaultConn));
builder.Services.AddSingleton<INotificationStore>(new SqlNotificationStore(defaultConn));
builder.Services.AddSingleton<IDirectoryStore>(new SqlDirectoryStore(defaultConn));
```

- [ ] **Step 3: Update your git-ignored local dev config**

Your `src/Harmonia.Api/appsettings.Development.local.json` (git-ignored) currently has 6 named connection strings. Replace the entire `ConnectionStrings` section with:

```json
"ConnectionStrings": {
  "Default": "Server=tcp:localhost,14330;Database=HarmoniaDb;User ID=sa;Password=<your-local-sa-password>;Encrypt=False;TrustServerCertificate=True;"
}
```

Port `14330` matches `dev-start.ps1`. Adjust password to your local SQL Server.

- [ ] **Step 4: Build to verify**

```powershell
dotnet build Harmonia.sln
```

Expected: `Build succeeded.` with 0 errors, 0 warnings (or existing warnings unchanged).

- [ ] **Step 5: Commit**

```powershell
git add src/Harmonia.Api/Program.cs src/Harmonia.Api/appsettings.json
git commit -m "refactor(api): collapse 6 named connection strings to ConnectionStrings:Default"
```

---

### Task 2: `identity.bicep` — managed identity + OIDC federated credential

**Files:**
- Create: `infra/modules/identity.bicep`

**Context:** Creates a user-assigned managed identity (`${namePrefix}-api-id`) and one OIDC federated credential pointing at the GitHub repo `master` branch. GitHub Actions workflows running on `master` can use `az login --federated-token` as this identity — no stored secret needed.

- [ ] **Step 1: Create the `infra/` directory structure**

```powershell
New-Item -ItemType Directory -Path infra\modules -Force
```

Expected: Creates `infra/` and `infra/modules/` at the repo root.

- [ ] **Step 2: Create `infra/modules/identity.bicep`**

```bicep
param namePrefix string
param location string
param githubOrg string
param githubRepo string

resource identity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: '${namePrefix}-api-id'
  location: location
}

resource federatedCredential 'Microsoft.ManagedIdentity/userAssignedIdentities/federatedIdentityCredentials@2023-01-31' = {
  parent: identity
  name: 'github-actions-master'
  properties: {
    issuer: 'https://token.actions.githubusercontent.com'
    subject: 'repo:${githubOrg}/${githubRepo}:ref:refs/heads/master'
    audiences: ['api://AzureADTokenExchange']
  }
}

output identityId string = identity.id
output identityClientId string = identity.properties.clientId
output identityPrincipalId string = identity.properties.principalId
```

- [ ] **Step 3: Lint**

```powershell
az bicep build --file infra/modules/identity.bicep
```

Expected: No output (exit 0). If `az bicep` is not installed, run `az bicep install` first.

- [ ] **Step 4: Commit**

```powershell
git add infra/modules/identity.bicep
git commit -m "feat(infra): add identity module (managed identity + OIDC federated credential)"
```

---

### Task 3: `acr.bicep` — Container Registry + AcrPull role

**Files:**
- Create: `infra/modules/acr.bicep`

**Context:** Creates `${namePrefix}acr` (Basic SKU, admin disabled). Assigns the built-in `AcrPull` role (definition ID `7f951dda-4ed3-4680-a7ca-43fe172d538d`) to the API managed identity so the Container App can pull images without a registry password. `guid()` produces a stable, deterministic GUID for the role assignment name so reruns are idempotent.

- [ ] **Step 1: Create `infra/modules/acr.bicep`**

```bicep
param namePrefix string
param location string
param identityPrincipalId string

resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: '${namePrefix}acr'
  location: location
  sku: {
    name: 'Basic'
  }
  properties: {
    adminUserEnabled: false
  }
}

var acrPullRoleId = '7f951dda-4ed3-4680-a7ca-43fe172d538d'

resource acrPullAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(acr.id, identityPrincipalId, acrPullRoleId)
  scope: acr
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', acrPullRoleId)
    principalId: identityPrincipalId
    principalType: 'ServicePrincipal'
  }
}

output loginServer string = acr.properties.loginServer
output acrName string = acr.name
```

- [ ] **Step 2: Lint**

```powershell
az bicep build --file infra/modules/acr.bicep
```

Expected: No output (exit 0).

- [ ] **Step 3: Commit**

```powershell
git add infra/modules/acr.bicep
git commit -m "feat(infra): add acr module (Container Registry Basic + AcrPull role)"
```

---

### Task 4: `sql.bicep` — SQL Server + serverless database + firewall

**Files:**
- Create: `infra/modules/sql.bicep`

**Context:** Creates `${namePrefix}-sql` SQL Server (SQL auth, admin `harmonia-admin`) and `${namePrefix}-db` database (GP_S_Gen5_1 serverless — no `useFreeLimit`, unsupported on this subscription). `autoPauseDelay: 60` means the database auto-pauses after 60 minutes of inactivity (cost saving for pilot). `minCapacity: json('0.5')` uses `json()` because Bicep has no native decimal literal. The `AllowAzureServices` firewall rule (0.0.0.0–0.0.0.0) allows the Container App to connect. `requestedBackupStorageRedundancy: 'Local'` is cheapest for a pilot.

- [ ] **Step 1: Create `infra/modules/sql.bicep`**

```bicep
param namePrefix string
param location string
@secure()
param sqlAdminPassword string

resource sqlServer 'Microsoft.Sql/servers@2022-05-01-preview' = {
  name: '${namePrefix}-sql'
  location: location
  properties: {
    administratorLogin: 'harmonia-admin'
    administratorLoginPassword: sqlAdminPassword
    version: '12.0'
  }
}

resource sqlDatabase 'Microsoft.Sql/servers/databases@2022-05-01-preview' = {
  parent: sqlServer
  name: '${namePrefix}-db'
  location: location
  sku: {
    name: 'GP_S_Gen5'
    tier: 'GeneralPurpose'
    family: 'Gen5'
    capacity: 1
  }
  properties: {
    autoPauseDelay: 60
    minCapacity: json('0.5')
    requestedBackupStorageRedundancy: 'Local'
  }
}

resource allowAzureServices 'Microsoft.Sql/servers/firewallRules@2022-05-01-preview' = {
  parent: sqlServer
  name: 'AllowAzureServices'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

output serverFqdn string = sqlServer.properties.fullyQualifiedDomainName
output databaseName string = sqlDatabase.name
```

- [ ] **Step 2: Lint**

```powershell
az bicep build --file infra/modules/sql.bicep
```

Expected: No output (exit 0).

- [ ] **Step 3: Commit**

```powershell
git add infra/modules/sql.bicep
git commit -m "feat(infra): add sql module (GP_S_Gen5_1 serverless, AllowAzureServices firewall)"
```

---

### Task 5: `keyvault.bicep` — Key Vault + secret + role

**Files:**
- Create: `infra/modules/keyvault.bicep`

**Context:** Creates `${namePrefix}kv` (Standard, RBAC-enabled). Bicep constructs the connection string from SQL module outputs and stores it as `ConnectionStrings--Default` (double-dash maps to colon in .NET config, so the .NET key is `ConnectionStrings:Default`). Assigns `Key Vault Secrets User` role (definition ID `4633458b-17de-408a-b874-0445c86b69e6`) to the API managed identity. `softDeleteRetentionInDays: 7` is the minimum (useful to be able to purge and recreate the vault quickly in a pilot). `enableRbacAuthorization: true` means access policies are ignored; role assignments are the only access control mechanism.

The 5 VAPID/ACS secrets are NOT created here — they must be populated manually before the first pipeline run (see pre-deploy checklist).

- [ ] **Step 1: Create `infra/modules/keyvault.bicep`**

```bicep
param namePrefix string
param location string
@secure()
param sqlAdminPassword string
param serverFqdn string
param databaseName string
param identityPrincipalId string

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: '${namePrefix}kv'
  location: location
  properties: {
    sku: {
      family: 'A'
      name: 'standard'
    }
    tenantId: subscription().tenantId
    enableRbacAuthorization: true
    softDeleteRetentionInDays: 7
  }
}

var connectionStringValue = 'Server=tcp:${serverFqdn},1433;Initial Catalog=${databaseName};Persist Security Info=False;User ID=harmonia-admin;Password=${sqlAdminPassword};Encrypt=True;'

resource connStringSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'ConnectionStrings--Default'
  properties: {
    value: connectionStringValue
  }
}

var kvSecretsUserRoleId = '4633458b-17de-408a-b874-0445c86b69e6'

resource kvRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.id, identityPrincipalId, kvSecretsUserRoleId)
  scope: keyVault
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', kvSecretsUserRoleId)
    principalId: identityPrincipalId
    principalType: 'ServicePrincipal'
  }
}

output keyVaultName string = keyVault.name
output keyVaultUri string = keyVault.properties.vaultUri
output connectionStringSecretUri string = connStringSecret.properties.secretUri
```

- [ ] **Step 2: Lint**

```powershell
az bicep build --file infra/modules/keyvault.bicep
```

Expected: No output (exit 0).

- [ ] **Step 3: Commit**

```powershell
git add infra/modules/keyvault.bicep
git commit -m "feat(infra): add keyvault module (KV Standard + ConnectionStrings--Default + KV Secrets User role)"
```

---

### Task 6: `frontend.bicep` — Static Web Apps × 2

**Files:**
- Create: `infra/modules/frontend.bicep`

**Context:** Creates two Standard SKU Static Web Apps. No linked backend — both UIs call the Container App URL directly; CORS is handled by the API's `Cors:AllowedOrigins` config (wired as plain env vars in `api.bicep`). Deployment tokens are deliberately NOT exposed as Bicep outputs — GitHub Actions reads them via `az staticwebapp secrets list` to keep them out of ARM deployment state (where Bicep outputs are stored in plaintext).

- [ ] **Step 1: Create `infra/modules/frontend.bicep`**

```bicep
param namePrefix string
param location string

resource angularSwa 'Microsoft.Web/staticSites@2023-01-01' = {
  name: '${namePrefix}-angular-swa'
  location: location
  sku: {
    name: 'Standard'
    tier: 'Standard'
  }
  properties: {}
}

resource reactSwa 'Microsoft.Web/staticSites@2023-01-01' = {
  name: '${namePrefix}-react-swa'
  location: location
  sku: {
    name: 'Standard'
    tier: 'Standard'
  }
  properties: {}
}

output angularSwaUrl string = 'https://${angularSwa.properties.defaultHostname}'
output reactSwaUrl string = 'https://${reactSwa.properties.defaultHostname}'
```

- [ ] **Step 2: Lint**

```powershell
az bicep build --file infra/modules/frontend.bicep
```

Expected: No output (exit 0).

- [ ] **Step 3: Commit**

```powershell
git add infra/modules/frontend.bicep
git commit -m "feat(infra): add frontend module (Angular + React Static Web Apps Standard)"
```

---

### Task 7: `api.bicep` — Container App

**Files:**
- Create: `infra/modules/api.bicep`

**Context:** Creates a Container Apps Environment (`${namePrefix}-env`) and Container App (`${namePrefix}-api`). The Container App uses the user-assigned managed identity for both ACR pull (via `registries`) and Key Vault secret access (via `identity` on each secret). Six secrets are wired as Key Vault references — `keyVaultUri` ends with a trailing `/` (e.g. `https://harmonykv.vault.azure.net/`), so the URL is formed as `'${keyVaultUri}secrets/<name>'` (no version = always resolves latest). `ASPNETCORE_ENVIRONMENT=Development` as a plain env var activates the DevSession auth shim, bypassing `AddMicrosoftIdentityWebApi` — the 5 AzureAdB2C secrets are not needed until Entra is configured. `minReplicas: 0` allows scale-to-zero for cost in the pilot. The `api` module receives `angularSwaUrl` and `reactSwaUrl` from `main.bicep` (which deploys `frontend` first) — Bicep infers the dependency automatically.

- [ ] **Step 1: Create `infra/modules/api.bicep`**

```bicep
param namePrefix string
param location string
param identityId string
param acrLoginServer string
param containerImageTag string
param keyVaultUri string
param angularSwaUrl string
param reactSwaUrl string

resource containerAppsEnv 'Microsoft.App/managedEnvironments@2023-05-01' = {
  name: '${namePrefix}-env'
  location: location
  properties: {}
}

resource containerApp 'Microsoft.App/containerApps@2023-05-01' = {
  name: '${namePrefix}-api'
  location: location
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${identityId}': {}
    }
  }
  properties: {
    managedEnvironmentId: containerAppsEnv.id
    configuration: {
      ingress: {
        external: true
        targetPort: 8080
        transport: 'auto'
      }
      registries: [
        {
          server: acrLoginServer
          identity: identityId
        }
      ]
      secrets: [
        {
          name: 'conn-default'
          keyVaultUrl: '${keyVaultUri}secrets/ConnectionStrings--Default'
          identity: identityId
        }
        {
          name: 'vapid-subject'
          keyVaultUrl: '${keyVaultUri}secrets/Vapid--Subject'
          identity: identityId
        }
        {
          name: 'vapid-public-key'
          keyVaultUrl: '${keyVaultUri}secrets/Vapid--PublicKey'
          identity: identityId
        }
        {
          name: 'vapid-private-key'
          keyVaultUrl: '${keyVaultUri}secrets/Vapid--PrivateKey'
          identity: identityId
        }
        {
          name: 'acs-conn-string'
          keyVaultUrl: '${keyVaultUri}secrets/Acs--ConnectionString'
          identity: identityId
        }
        {
          name: 'acs-sender'
          keyVaultUrl: '${keyVaultUri}secrets/Acs--SenderAddress'
          identity: identityId
        }
      ]
    }
    template: {
      containers: [
        {
          name: '${namePrefix}-api'
          image: '${acrLoginServer}/${namePrefix}-api:${containerImageTag}'
          env: [
            {
              name: 'ASPNETCORE_ENVIRONMENT'
              value: 'Development'
            }
            {
              name: 'ASPNETCORE_URLS'
              value: 'http://+:8080'
            }
            {
              name: 'Cors__AllowedOrigins__0'
              value: angularSwaUrl
            }
            {
              name: 'Cors__AllowedOrigins__1'
              value: reactSwaUrl
            }
            {
              name: 'ConnectionStrings__Default'
              secretRef: 'conn-default'
            }
            {
              name: 'Vapid__Subject'
              secretRef: 'vapid-subject'
            }
            {
              name: 'Vapid__PublicKey'
              secretRef: 'vapid-public-key'
            }
            {
              name: 'Vapid__PrivateKey'
              secretRef: 'vapid-private-key'
            }
            {
              name: 'Acs__ConnectionString'
              secretRef: 'acs-conn-string'
            }
            {
              name: 'Acs__SenderAddress'
              secretRef: 'acs-sender'
            }
          ]
          resources: {
            cpu: json('0.25')
            memory: '0.5Gi'
          }
        }
      ]
      scale: {
        minReplicas: 0
        maxReplicas: 3
      }
    }
  }
}

output containerAppFqdn string = containerApp.properties.configuration.ingress.fqdn
```

- [ ] **Step 2: Lint**

```powershell
az bicep build --file infra/modules/api.bicep
```

Expected: No output (exit 0).

- [ ] **Step 3: Commit**

```powershell
git add infra/modules/api.bicep
git commit -m "feat(infra): add api module (Container App + 6 KV secret refs + DevSession env)"
```

---

### Task 8: `main.bicep` + `main.parameters.json` + full template lint

**Files:**
- Create: `infra/main.bicep`
- Create: `infra/main.parameters.json`

**Context:** Orchestrator that wires all six modules. Bicep infers most dependencies from output references (e.g. `api` references `keyvault.outputs.keyVaultUri`, so `keyvault` deploys first). The explicit `dependsOn: [keyvault, acr]` on the `api` module ensures the Key Vault Secrets User and AcrPull role assignments are fully settled before the Container App revision starts — role assignment propagation can lag slightly behind resource creation. The `frontend` module has no dependencies (deploys in parallel with `acr` and `sql`), but `api` implicitly depends on `frontend` via the `angularSwaUrl`/`reactSwaUrl` parameter references. `sqlAdminPassword` is intentionally absent from `main.parameters.json` — supply it at deploy time only; never commit it.

- [ ] **Step 1: Create `infra/main.bicep`**

```bicep
param namePrefix string = 'harmonia'
param location string = 'westeurope'
param containerImageTag string = 'latest'
@secure()
param sqlAdminPassword string
param githubOrg string = 'stanislavstefanov-art'
param githubRepo string = 'ResidentialComplexHarmonia2'

module identity 'modules/identity.bicep' = {
  name: 'identity'
  params: {
    namePrefix: namePrefix
    location: location
    githubOrg: githubOrg
    githubRepo: githubRepo
  }
}

module acr 'modules/acr.bicep' = {
  name: 'acr'
  params: {
    namePrefix: namePrefix
    location: location
    identityPrincipalId: identity.outputs.identityPrincipalId
  }
}

module sql 'modules/sql.bicep' = {
  name: 'sql'
  params: {
    namePrefix: namePrefix
    location: location
    sqlAdminPassword: sqlAdminPassword
  }
}

module frontend 'modules/frontend.bicep' = {
  name: 'frontend'
  params: {
    namePrefix: namePrefix
    location: location
  }
}

module keyvault 'modules/keyvault.bicep' = {
  name: 'keyvault'
  params: {
    namePrefix: namePrefix
    location: location
    sqlAdminPassword: sqlAdminPassword
    serverFqdn: sql.outputs.serverFqdn
    databaseName: sql.outputs.databaseName
    identityPrincipalId: identity.outputs.identityPrincipalId
  }
}

module api 'modules/api.bicep' = {
  name: 'api'
  params: {
    namePrefix: namePrefix
    location: location
    identityId: identity.outputs.identityId
    acrLoginServer: acr.outputs.loginServer
    containerImageTag: containerImageTag
    keyVaultUri: keyvault.outputs.keyVaultUri
    angularSwaUrl: frontend.outputs.angularSwaUrl
    reactSwaUrl: frontend.outputs.reactSwaUrl
  }
  dependsOn: [keyvault, acr]
}

output acrLoginServer string = acr.outputs.loginServer
output containerAppFqdn string = api.outputs.containerAppFqdn
output angularSwaUrl string = frontend.outputs.angularSwaUrl
output reactSwaUrl string = frontend.outputs.reactSwaUrl
output managedIdentityClientId string = identity.outputs.identityClientId
output keyVaultName string = keyvault.outputs.keyVaultName
```

- [ ] **Step 2: Create `infra/main.parameters.json`**

```json
{
  "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
  "contentVersion": "1.0.0.0",
  "parameters": {
    "namePrefix": {
      "value": "harmonia"
    },
    "location": {
      "value": "westeurope"
    },
    "containerImageTag": {
      "value": "latest"
    },
    "githubOrg": {
      "value": "stanislavstefanov-art"
    },
    "githubRepo": {
      "value": "ResidentialComplexHarmonia2"
    }
  }
}
```

`sqlAdminPassword` is intentionally absent — supply at deploy time only.

- [ ] **Step 3: Guard against accidental parameter file commits**

Open `.gitignore` and confirm or add:

```
infra/*.local.json
```

This prevents any `main.local.parameters.json` (a common pattern for passing `sqlAdminPassword` locally) from being committed.

- [ ] **Step 4: Lint the full template (validates all module wiring)**

```powershell
az bicep build --file infra/main.bicep
```

Expected: No output (exit 0). This resolves all module imports and validates parameter bindings across all six modules.

- [ ] **Step 5: Optional — what-if preview against Azure**

If you have Azure credentials and a resource group, run a preview to confirm ARM accepts the template:

```powershell
az group create --name harmonia-rg --location westeurope

az deployment group what-if `
  --resource-group harmonia-rg `
  --template-file infra/main.bicep `
  --parameters "@infra/main.parameters.json" `
  --parameters sqlAdminPassword="WhatIfTestP@ss1"
```

Expected: A list of resources that would be created. No errors. Use a throwaway password for the what-if — it is not stored anywhere.

- [ ] **Step 6: Commit**

```powershell
git add infra/main.bicep infra/main.parameters.json .gitignore
git commit -m "feat(infra): add main.bicep orchestrator + parameters (Slice 3 complete)"
```

---

## Pre-deploy checklist (first pipeline run)

Before triggering the CD pipeline, populate these 5 secrets in Key Vault (`harmonykv`) using the Azure Portal or:

```powershell
az keyvault secret set --vault-name harmonykv --name "Vapid--Subject"         --value "mailto:your@email.com"
az keyvault secret set --vault-name harmonykv --name "Vapid--PublicKey"        --value "<base64-public-key>"
az keyvault secret set --vault-name harmonykv --name "Vapid--PrivateKey"       --value "<base64-private-key>"
az keyvault secret set --vault-name harmonykv --name "Acs--ConnectionString"   --value "<acs-connection-string>"
az keyvault secret set --vault-name harmonykv --name "Acs--SenderAddress"      --value "<verified-sender-address>"
```

`ConnectionStrings--Default` is created by `keyvault.bicep` automatically from SQL outputs — no manual step.

The 5 `AzureAdB2C--*` secrets and `ASPNETCORE_ENVIRONMENT=Production` are deferred until Entra B2C is configured (spec section 7).
