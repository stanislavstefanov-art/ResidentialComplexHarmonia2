# Entra External ID Auth — Slice 1: Infra + API Hardening

**Status:** Approved  
**Branch:** feat/entra-auth  
**Depends on:** Entra External ID tenant created manually in Azure Portal (hard human gate)

---

## Goal

Fix the production API so it runs `EntraSession` (JWT validation) instead of `DevSession` (hardcoded stub), and wire all endpoints to require authentication by default. Ship the config skeleton so the deployed app is ready to accept real Entra JWTs the moment the Entra tenant exists.

---

## Scope

Five files. No new abstractions. No UI changes (Slices 2 and 3).

| File | Change |
|------|--------|
| `infra/modules/api.bicep` | Fix `ASPNETCORE_ENVIRONMENT`; add 5 KV secret refs + env vars |
| `infra/modules/keyvault.bicep` | Add 5 `@secure()` params + 5 KV secret resources |
| `infra/main.bicep` | Pass 5 new params to keyvault module |
| `deploy.ps1` | Phase 1: collect 5 Entra values; Phase 2: pass to Bicep |
| `src/Harmonia.Api/Program.cs` | Fallback auth policy; `.AllowAnonymous()` on `/healthz`; remove 4 redundant guards |

---

## Decisions

### ASPNETCORE_ENVIRONMENT

Change `'Development'` → `'Production'` in `api.bicep`. This is the root cause: the `IsDevelopment()` branch in `Program.cs` registers `DevSession` and skips JWT middleware entirely, so every deployed request runs as a hardcoded resident.

### AzureAdB2C config keys

`Microsoft.Identity.Web` reads the `AzureAdB2C` section. Five named Key Vault secrets, following the existing `--` separator convention:

| KV secret name | Env var (Container App) | Description |
|----------------|------------------------|-------------|
| `AzureAdB2C--Instance` | `AzureAdB2C__Instance` | Login URL base, e.g. `https://<tenant>.b2clogin.com/` |
| `AzureAdB2C--ClientId` | `AzureAdB2C__ClientId` | Entra app registration client ID |
| `AzureAdB2C--Domain` | `AzureAdB2C__Domain` | Tenant domain, e.g. `<tenant>.onmicrosoft.com` |
| `AzureAdB2C--SignUpSignInPolicyId` | `AzureAdB2C__SignUpSignInPolicyId` | User flow name, e.g. `B2C_1_SignUpSignIn` |
| `AzureAdB2C--TenantId` | `AzureAdB2C__TenantId` | Entra tenant GUID |

### Endpoint authorization strategy

Use a **fallback policy** (`RequireAuthenticatedUser`) set on `AddAuthorization()`. This is deny-by-default: every new endpoint is protected unless explicitly opted out. Only `/healthz` gets `.AllowAnonymous()` (required for the Container App liveness probe). The 4 existing `.RequireAuthorization()` calls on the DELETE directory endpoints become redundant and are removed.

---

## Changes in detail

### `infra/modules/api.bicep`

1. Change `ASPNETCORE_ENVIRONMENT` value from `'Development'` to `'Production'`.
2. Add to `configuration.secrets` array — 5 new entries with `keyVaultUrl` + `identity` pattern identical to the existing VAPID/ACS entries:
   - `entra-instance` → `${keyVaultUri}secrets/AzureAdB2C--Instance`
   - `entra-client-id` → `${keyVaultUri}secrets/AzureAdB2C--ClientId`
   - `entra-domain` → `${keyVaultUri}secrets/AzureAdB2C--Domain`
   - `entra-policy` → `${keyVaultUri}secrets/AzureAdB2C--SignUpSignInPolicyId`
   - `entra-tenant-id` → `${keyVaultUri}secrets/AzureAdB2C--TenantId`
3. Add to `template.containers[0].env` array — 5 new `secretRef` env vars mapping to the above.

### `infra/modules/keyvault.bicep`

1. Add 5 `@secure()` params: `entraInstance`, `entraClientId`, `entraDomain`, `entraSignUpSignInPolicyId`, `entraTenantId`.
2. Add 5 `Microsoft.KeyVault/vaults/secrets` resources with `parent: keyVault` — same pattern as `vapidSubjectSecret` etc.

### `infra/main.bicep`

Pass the 5 new params through to the `keyvault` module call.

### `deploy.ps1`

In Phase 1 (collect inputs), add an Entra block after the existing VAPID/SQL prompts:

```powershell
$EntraInstance          = Read-Host 'Entra instance URL (e.g. https://<tenant>.b2clogin.com/)'
$EntraClientId          = Read-Host 'Entra client ID (app registration GUID)'
$EntraDomain            = Read-Host 'Entra domain (e.g. <tenant>.onmicrosoft.com)'
$EntraSignUpSignInPolicy = Read-Host 'Sign-up/sign-in policy ID (e.g. B2C_1_SignUpSignIn)'
$EntraTenantId          = Read-Host 'Entra tenant ID (GUID)'
```

In Phase 2, include these in `$paramObj.parameters`.  
Clear variables after use (`Remove-Variable`) consistent with how SQL password is handled.

### `src/Harmonia.Api/Program.cs`

In the `else` branch (non-Development):

```csharp
builder.Services.AddAuthorization(options =>
    options.FallbackPolicy = new AuthorizationPolicyBuilder()
        .RequireAuthenticatedUser()
        .Build());
```

On the `/healthz` endpoint:

```csharp
app.MapGet("/healthz", () => Results.Ok()).AllowAnonymous();
```

Remove `.RequireAuthorization()` from the 4 DELETE directory endpoints (now redundant).

---

## Testing

**Existing:** 6 unit tests for `EntraSession` in `tests/Harmonia.UnitTests/Api/EntraSessionTests.cs` remain unchanged — no modification to that class.

**New test:** `tests/Harmonia.UnitTests/Api/AuthorizationPolicyTests.cs` — a `WebApplicationFactory`-based test using a fake `ISession` that returns `null` (unauthenticated). Asserts `GET /directory` returns HTTP 401. Asserts `GET /healthz` returns HTTP 200.

---

## Human gate

The Entra External ID tenant must be created in Azure Portal before `deploy.ps1` can be run with real values and before end-to-end JWT validation works. The code ships first; the tenant is configured separately.

Steps for the human gate (out of scope for this slice):
1. Create Entra External ID tenant
2. Register the API app, configure `extension_householdRef` and `extension_role` custom attributes
3. Create `B2C_1_SignUpSignIn` user flow with Google/Microsoft social IdPs
4. Collect the 5 config values and run `deploy.ps1`

---

## Out of scope

- MSAL login UI in Angular or React (Slice 2 and 3)
- Automated Entra tenant provisioning via Bicep/Terraform
- Token refresh handling (UI concern, Slices 2–3)
- Role-based authorization policies beyond `RequireAuthenticatedUser` (the application layer already enforces `IsAdmin`/`IsResident` via `ISession`)
