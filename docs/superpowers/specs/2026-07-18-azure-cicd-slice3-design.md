# Azure CI/CD Slice 3 — Bicep IaC Design

**Slice:** 3 of 4 (Azure deployment preparation)
**Date:** 2026-07-18
**Branch:** feat/azure-cicd

---

## Goal

Provision the complete Harmonia Azure infrastructure with Bicep IaC: ACR, Container App (API),
Static Web Apps × 2 (Angular + React), Azure SQL, Key Vault, and OIDC federated identity for
GitHub Actions. Includes a companion `Program.cs` refactor to collapse six named connection
strings to one.

---

## 1. File structure

```
infra/
  main.bicep                — orchestrator: parameters, module wiring, outputs
  main.parameters.json      — default parameter values (westeurope, namePrefix=harmonia)
  modules/
    identity.bicep          — user-assigned managed identity + OIDC federated credential
    acr.bicep               — Azure Container Registry (Basic SKU) + AcrPull role
    sql.bicep               — Azure SQL Server + database (GP_S_Gen5_1 serverless)
    keyvault.bicep          — Key Vault + Bicep-created secret + Key Vault Secrets User role
    api.bicep               — Container Apps Environment + Container App
    frontend.bicep          — Static Web App × 2 (Angular + React)
```

Source change:
```
src/Harmonia.Api/Program.cs — collapse 6 named connection strings to ConnectionStrings:Default
```

---

## 2. Parameters (`main.bicep`)

| Parameter | Type | Default | Notes |
|---|---|---|---|
| `namePrefix` | string | `harmonia` | Prefix for all resource names |
| `location` | string | `westeurope` | EU-only (R3 residency constraint) |
| `containerImageTag` | string | `latest` | CI overrides with the pushed image tag |
| `sqlAdminPassword` | securestring | _(none)_ | Must be supplied; never committed |
| `githubOrg` | string | `stanislavstefanov-art` | For OIDC federated credential subject |
| `githubRepo` | string | `ResidentialComplexHarmonia2` | For OIDC federated credential subject |

---

## 3. Module breakdown

### `identity.bicep`

Creates a user-assigned managed identity (`${namePrefix}-api-id`) and one OIDC federated
credential so GitHub Actions can authenticate as the identity without a stored secret.

Federated credential subject filter:
```
repo:${githubOrg}/${githubRepo}:ref:refs/heads/master
```

Outputs: `identityId` (resource ID), `identityClientId` (client ID for `az login`).

---

### `acr.bicep`

Creates `${namePrefix}acr` (ACR, Basic SKU). Assigns `AcrPull` role to `${namePrefix}-api-id`
so the Container App can pull images without a registry password.

Outputs: `loginServer`.

---

### `sql.bicep`

Creates:
- SQL Server: `${namePrefix}-sql` — SQL auth, `sqlAdminLogin = harmonia-admin`
- Database: `${namePrefix}-db` — GP_S_Gen5_1 serverless (no `useFreeLimit`; unsupported on
  this subscription)

Firewall rule: `AllowAzureServices` (`0.0.0.0`–`0.0.0.0`) so the Container App can connect.

Outputs: `serverFqdn`, `databaseName`.

---

### `keyvault.bicep`

Creates `${namePrefix}kv` (Key Vault, standard SKU).

**Bicep-created secrets (1):**

| Secret name | Value source |
|---|---|
| `ConnectionStrings--Default` | Constructed from SQL module outputs: `Server=tcp:${serverFqdn},1433;Initial Catalog=${databaseName};Persist Security Info=False;User ID=harmonia-admin;Password=${sqlAdminPassword};Encrypt=True;` |

The `--` separator maps to `:` in .NET configuration (`ConnectionStrings:Default`).

**Role assignment:** `Key Vault Secrets User` on the Key Vault for `${namePrefix}-api-id`.
This must settle before the Container App starts (enforced via `dependsOn` in `main.bicep`).

Outputs: `keyVaultName`, `keyVaultUri`, `connectionStringSecretUri`.

---

### `api.bicep`

Creates a Container Apps Environment and a Container App (`${namePrefix}-api`).

**Image:** `${acrLoginServer}/${namePrefix}-api:${containerImageTag}`

**Identity:** user-assigned `${namePrefix}-api-id` (for ACR pull + Key Vault secret access).

**Secrets wired as Key Vault references (6 — initial deploy):**

| Container App secret name | Key Vault secret |
|---|---|
| `conn-default` | `ConnectionStrings--Default` |
| `vapid-subject` | `Vapid--Subject` |
| `vapid-public-key` | `Vapid--PublicKey` |
| `vapid-private-key` | `Vapid--PrivateKey` |
| `acs-conn-string` | `Acs--ConnectionString` |
| `acs-sender` | `Acs--SenderAddress` |

**Environment variables mapped from secrets:**

| Env var | Secret ref |
|---|---|
| `ConnectionStrings__Default` | `conn-default` |
| `Vapid__Subject` | `vapid-subject` |
| `Vapid__PublicKey` | `vapid-public-key` |
| `Vapid__PrivateKey` | `vapid-private-key` |
| `Acs__ConnectionString` | `acs-conn-string` |
| `Acs__SenderAddress` | `acs-sender` |

> `.NET` config uses `__` as the section separator for environment variables.
> Key Vault uses `--`. Both are mapped above.

**Plain environment variables:**

| Env var | Value |
|---|---|
| `ASPNETCORE_ENVIRONMENT` | `Development` |
| `ASPNETCORE_URLS` | `http://+:8080` |
| `Cors__AllowedOrigins__0` | Angular SWA URL (from frontend module output) |
| `Cors__AllowedOrigins__1` | React SWA URL (from frontend module output) |

`ASPNETCORE_ENVIRONMENT=Development` activates the DevSession auth shim (ADR-0001). This
bypasses `AddMicrosoftIdentityWebApi` and means the 5 AzureAdB2C secrets are not needed at
startup. **Do not change to `Production` until Entra B2C is configured and all 5 B2C secrets
are in Key Vault.**

**`dependsOn`:** `api` module explicitly depends on `keyvault` module so the Key Vault Secrets
User role assignment is fully settled before the Container App revision starts.

**Ingress:** external, port 8080, HTTPS.

Outputs: `containerAppFqdn`.

---

### `frontend.bicep`

Creates two Static Web Apps:
- `${namePrefix}-angular-swa`
- `${namePrefix}-react-swa`

Both: `Standard` SKU, `westeurope`, no linked backend (UIs call the Container App URL directly;
CORS is handled by the API).

Outputs: `angularSwaUrl`, `reactSwaUrl`, `angularDeploymentToken`, `reactDeploymentToken`.

The deployment tokens are sensitive outputs; GitHub Actions reads them via
`az staticwebapp secrets list` rather than Bicep outputs to avoid storing them in deployment state.

---

## 4. `main.bicep` module wiring and outputs

Module dependency order (enforced via `dependsOn`):
```
identity → acr, sql, keyvault → api → (frontend independent)
```

Explicit `dependsOn`:
- `api` depends on `keyvault` (role assignment must settle first)
- `api` depends on `acr` (AcrPull role must exist before Container App pulls image)

**Outputs:**

| Output | Source |
|---|---|
| `acrLoginServer` | `acr.outputs.loginServer` |
| `containerAppFqdn` | `api.outputs.containerAppFqdn` |
| `angularSwaUrl` | `frontend.outputs.angularSwaUrl` |
| `reactSwaUrl` | `frontend.outputs.reactSwaUrl` |
| `managedIdentityClientId` | `identity.outputs.identityClientId` |
| `keyVaultName` | `keyvault.outputs.keyVaultName` |

---

## 5. `Program.cs` refactor — single connection string

The current `Program.cs` reads 6 named connection strings and throws on any missing one.
This slice collapses them to one.

**Before (lines 28–84):**
```csharp
var reservationsConn = builder.Configuration.GetConnectionString("Reservations")
    ?? throw new InvalidOperationException("...");
// × 6: Reservations, MaintenanceFees, Expenses, Payments, Notifications, Directory
```

**After:**
```csharp
var defaultConn = builder.Configuration.GetConnectionString("Default")
    ?? throw new InvalidOperationException("ConnectionStrings:Default is required.");
```

Each `DbContext` registration that currently receives a named connection string is updated to
use `defaultConn`. All six domain stores share the same SQL Server database and connection string.

The Key Vault secret `ConnectionStrings--Default` maps to `ConnectionStrings:Default` in .NET
configuration via the `__` → `:` convention.

---

## 6. Manual secrets — first-deploy checklist

Before running the pipeline for the first time, populate these 5 secrets in
Key Vault (`${namePrefix}kv`) using the Azure Portal or `az keyvault secret set`:

| Key Vault secret name | .NET config key | Notes |
|---|---|---|
| `Vapid--Subject` | `Vapid:Subject` | `mailto:` URI |
| `Vapid--PublicKey` | `Vapid:PublicKey` | Base64 VAPID public key |
| `Vapid--PrivateKey` | `Vapid:PrivateKey` | Base64 VAPID private key |
| `Acs--ConnectionString` | `Acs:ConnectionString` | ACS connection string |
| `Acs--SenderAddress` | `Acs:SenderAddress` | ACS verified sender address |

`ConnectionStrings--Default` is created by `keyvault.bicep` from SQL outputs — no manual step.

---

## 7. Follow-on: enabling Entra B2C (separate PR)

When Entra B2C is configured:
1. Populate 5 secrets in Key Vault: `AzureAdB2C--Instance`, `--Domain`, `--TenantId`,
   `--ClientId`, `--SignUpSignInPolicyId`.
2. Add those 5 as `secretRef` entries in `api.bicep`.
3. Add the 5 corresponding `ConnectionStrings__*` env var mappings.
4. Change `ASPNETCORE_ENVIRONMENT` from `Development` to `Production`.
5. Deploy updated Bicep. The Container App revision will then use real Entra B2C auth.

---

## 8. Out of scope

- GitHub Actions CD workflow YAML — Slice 4
- Staging environment (parameterized template supports it; a second parameter file adds it later)
- SWA linked backend / API proxy configuration
- Entra B2C tenant setup
- Custom domains / TLS certificates
- Azure Monitor / Log Analytics (add after baseline deploy)
- Per-domain databases or per-module SQL logins (add if architecture evolves)
